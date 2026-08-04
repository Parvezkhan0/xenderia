"""
FACT System CSV Ingestion

Loads a user-uploaded CSV file into a per-user SQLite database so the existing
SQL query pipeline (SQL_GetSchema + SQL_QueryReadonly, schema-embedded prompt
caching) can query it with no new query logic.

Design decisions (minimal, MVP-scoped):
  - 15 MB upload cap, enforced here regardless of caller.
  - Column type inference: INTEGER / REAL / DATE(ISO text) / TEXT.
  - Comma-strip before numeric inference so "1,200" is treated as numeric
    instead of silently demoting the column to TEXT (which would make SQLite
    SUM() return a plausible-but-wrong number).
  - Leading-zero guard: values like "07001" (zips, IDs, phone numbers) stay
    TEXT so leading zeros are not destroyed by INTEGER coercion.
  - Encoding fallback: utf-8-sig -> latin-1 so Excel/Windows exports don't hard
    fail on decode.
  - Delimiter sniffing via csv.Sniffer (falls back to comma).
  - Re-upload of the same table name OVERWRITES that table (DROP + recreate).

KNOWN, ACCEPTED LIMITATION (MVP):
  Decimal values are stored as SQLite REAL (float). This can introduce tiny
  floating-point rounding on monetary aggregates (e.g. 0.1 + 0.2). Accepted for
  MVP; revisit with integer-cents or NUMERIC-as-text if exact money math is
  required.
"""

import csv
import os
import re
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import structlog

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Limits / constants
# ---------------------------------------------------------------------------
MAX_CSV_BYTES = 15 * 1024 * 1024      # 15 MB upload cap
TYPE_SAMPLE_ROWS = 1000               # infer types from the first N data rows
INSERT_BATCH = 1000                   # rows per executemany batch

_DATE_FORMATS = (
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%d-%m-%Y",
    "%m/%d/%Y",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
)


# ---------------------------------------------------------------------------
# Identifier sanitization
# ---------------------------------------------------------------------------
def _sanitize_ident(name: str, fallback: str) -> str:
    """
    Turn an arbitrary header/filename into a safe SQL identifier:
    starts with a letter/underscore, only [A-Za-z0-9_], max 64 chars.
    Matches DatabaseManager._is_valid_table_name so introspection accepts it.
    """
    s = re.sub(r"[^A-Za-z0-9_]", "_", (name or "").strip())
    s = re.sub(r"_+", "_", s).strip("_")
    if not s or not re.match(r"^[A-Za-z_]", s):
        s = f"{fallback}_{s}" if s else fallback
    return s[:64]


def _dedupe_columns(columns: List[str]) -> List[str]:
    """Ensure column names are unique after sanitization."""
    seen: Dict[str, int] = {}
    out: List[str] = []
    for col in columns:
        if col in seen:
            seen[col] += 1
            out.append(f"{col}_{seen[col]}"[:64])
        else:
            seen[col] = 0
            out.append(col)
    return out


# ---------------------------------------------------------------------------
# Value parsers (with the minimal safety fixes)
# ---------------------------------------------------------------------------
def _is_leading_zero(v: str) -> bool:
    """True for '07001', '000', '012' — anything with a meaningful leading zero."""
    v = v.strip()
    return len(v) > 1 and v[0] == "0" and v[1] != "."


def _try_int(v: str) -> Optional[int]:
    if v is None:
        return None
    s = v.strip().replace(",", "")           # comma-strip: "1,200" -> "1200"
    if s == "" or _is_leading_zero(v):        # leading-zero guard -> keep TEXT
        return None
    try:
        return int(s)
    except (ValueError, TypeError):
        return None


def _try_float(v: str) -> Optional[float]:
    if v is None:
        return None
    s = v.strip().replace(",", "")            # comma-strip
    if s == "" or _is_leading_zero(v):
        return None
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def _try_iso_date(v: str) -> Optional[str]:
    if v is None:
        return None
    s = v.strip()
    if not s:
        return None
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except (ValueError, TypeError):
            continue
    return None


# ---------------------------------------------------------------------------
# Type inference
# ---------------------------------------------------------------------------
def _infer_column_types(sample_rows: List[List[str]], n_cols: int) -> List[str]:
    """
    Infer one logical type per column from a sample of rows.
    Returns a list of "INTEGER" | "REAL" | "DATE" | "TEXT".
    All-or-nothing per column: any non-empty value that doesn't match demotes
    the column (INTEGER -> REAL -> DATE -> TEXT).
    """
    types: List[str] = []
    for c in range(n_cols):
        vals = [
            row[c] for row in sample_rows
            if c < len(row) and row[c] is not None and str(row[c]).strip() != ""
        ]
        if not vals:
            types.append("TEXT")
            continue

        if all(_try_int(v) is not None for v in vals):
            types.append("INTEGER")
        elif all(_try_float(v) is not None for v in vals):
            types.append("REAL")
        elif all(_try_iso_date(v) is not None for v in vals):
            types.append("DATE")   # stored as ISO TEXT
        else:
            types.append("TEXT")
    return types


def _convert(value: Any, logical_type: str) -> Any:
    """Convert a raw CSV string cell to its inferred storage value."""
    if value is None or str(value).strip() == "":
        return None
    if logical_type == "INTEGER":
        return _try_int(value)
    if logical_type == "REAL":
        return _try_float(value)   # REAL/float — see money-precision note in module docstring
    if logical_type == "DATE":
        return _try_iso_date(value)
    return value


# ---------------------------------------------------------------------------
# CSV reading (encoding + delimiter robustness)
# ---------------------------------------------------------------------------
def _open_and_read(csv_path: str) -> Tuple[List[str], List[List[str]]]:
    """
    Read a CSV into (header, data_rows) with encoding + delimiter fallback.
    Tries utf-8-sig first, then latin-1 (covers most Excel/Windows exports).
    """
    last_err: Optional[Exception] = None
    for encoding in ("utf-8-sig", "latin-1"):
        try:
            with open(csv_path, newline="", encoding=encoding) as f:
                sample = f.read(2048)
                f.seek(0)
                try:
                    dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
                except csv.Error:
                    dialect = csv.excel   # default comma dialect
                reader = csv.reader(f, dialect)
                header = next(reader, [])
                data = [row for row in reader if any((cell or "").strip() for cell in row)]
                return header, data
        except UnicodeDecodeError as e:
            last_err = e
            continue
    raise ValueError(f"Could not decode CSV with utf-8 or latin-1: {last_err}")


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def ingest_csv_to_sqlite(csv_path: str, db_path: str, table_hint: str) -> Dict[str, Any]:
    """
    Ingest a CSV file into a typed table inside the SQLite database at db_path.

    Args:
        csv_path:   Path to the source .csv file on disk.
        db_path:    Path to the per-user SQLite database (created if missing).
        table_hint: Suggested table name (usually the original filename).

    Returns:
        {
          "table": <str>,
          "columns": [{"name": ..., "type": ...}, ...],
          "row_count": <int>,
        }

    Raises:
        ValueError: on oversize file, empty CSV, or undecodable content.
    """
    # 15 MB cap — enforced here regardless of any endpoint-level check.
    size = os.path.getsize(csv_path)
    if size > MAX_CSV_BYTES:
        raise ValueError(
            f"CSV file is too large ({size} bytes). Max supported size is "
            f"{MAX_CSV_BYTES // (1024 * 1024)} MB."
        )

    header, data = _open_and_read(csv_path)
    if not header:
        raise ValueError("CSV file has no header row.")

    # Build safe, unique column names.
    columns = [
        _sanitize_ident(h, f"column_{i + 1}")
        for i, h in enumerate(header)
    ]
    columns = _dedupe_columns(columns)
    n_cols = len(columns)

    # Infer types from a bounded sample (keeps inference cheap on big files).
    sample = data[:TYPE_SAMPLE_ROWS]
    logical_types = _infer_column_types(sample, n_cols)
    affinity = {"INTEGER": "INTEGER", "REAL": "REAL", "DATE": "TEXT", "TEXT": "TEXT"}

    table = _sanitize_ident(table_hint, "csv_table")

    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        cols_ddl = ", ".join(
            f'"{col}" {affinity[t]}' for col, t in zip(columns, logical_types)
        )
        # Re-upload of the same table name overwrites it (never blind-merge).
        conn.execute(f'DROP TABLE IF EXISTS "{table}"')
        conn.execute(f'CREATE TABLE "{table}" ({cols_ddl})')

        placeholders = ", ".join("?" for _ in columns)
        insert_sql = f'INSERT INTO "{table}" VALUES ({placeholders})'

        # Batched inserts — never one giant executemany over the whole file.
        for i in range(0, len(data), INSERT_BATCH):
            batch = [
                [
                    _convert(row[j] if j < len(row) else None, logical_types[j])
                    for j in range(n_cols)
                ]
                for row in data[i:i + INSERT_BATCH]
            ]
            conn.executemany(insert_sql, batch)
        conn.commit()
    finally:
        conn.close()

    logger.info(
        "CSV ingested to SQLite",
        table=table,
        row_count=len(data),
        column_count=n_cols,
        db_path=db_path,
    )

    return {
        "table": table,
        "columns": [
            {"name": col, "type": t}
            for col, t in zip(columns, logical_types)
        ],
        "row_count": len(data),
    }
