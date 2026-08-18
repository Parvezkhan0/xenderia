"""
FACT System — DuckDB Federation Manager

Queries a user's live PostgreSQL database AND their CSV-ingested SQLite database
together, in ONE read-only SQL statement, via an embedded DuckDB connection.

WHEN THIS IS USED
    Only for users who have BOTH a live Postgres pool AND CSV tables at the same
    time (Pro, single-source rule lifted). Free / single-source users NEVER reach
    this path — routing falls through to the existing PostgreSQL / SQLite / demo
    managers unchanged. This module is purely additive.

HOW IT WORKS
    Per query, a fresh in-memory DuckDB connection:
      1. LOADs the sqlite + postgres extensions (installed once at startup).
      2. ATTACHes the user's Postgres  READ_ONLY  as catalog  "pgdb".
      3. ATTACHes the user's SQLite    READ_ONLY  as catalog  "csv".
      4. Runs the LLM's SELECT across both, then detaches/closes.

FACT GUARANTEES PRESERVED
    - Read-only: only SELECT passes validation; both sources attached READ_ONLY.
    - Exact: answers come from executed SQL over the real data — never invented.
    - Same server-side caps (MAX_RESULT_ROWS / MAX_RESULT_BYTES) and the same
      QueryResult shape as the SQLite / PostgreSQL managers.

NOTE (MVP): a fresh DuckDB connection + ATTACH is created per query. The Postgres
attach opens a connection to the user's DB each time — correct, but adds latency.
Connection reuse/pooling is a later optimization and is intentionally NOT done
here to keep the first version simple and stateless.
"""

import re
import time
import asyncio
import decimal
import datetime
import uuid as _uuid
from typing import Any, Dict, List

import structlog

try:
    from ..core.errors import DatabaseError, SecurityError
    from .models import QueryResult
    from .connection import MAX_RESULT_ROWS, _cap_rows_by_bytes
except ImportError:  # script / absolute-import fallback
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from core.errors import DatabaseError, SecurityError
    from db.models import QueryResult
    from db.connection import MAX_RESULT_ROWS, _cap_rows_by_bytes


logger = structlog.get_logger(__name__)

# Catalog names the two sources are attached under. The schema prompt lists
# tables using these prefixes (e.g. pgdb.public.orders, csv.bank_export) so the
# LLM writes queries against exactly these qualified names.
PG_CATALOG  = "pgdb"
CSV_CATALOG = "csv"


# ---------------------------------------------------------------------------
# Read-only validation — identical policy to PostgreSQLManager.execute_query
# (replicated here, not imported, so no existing code is touched).
# ---------------------------------------------------------------------------
_DANGEROUS = [
    "drop", "delete", "update", "insert", "alter", "create",
    "truncate", "replace", "merge", "exec", "execute",
    "attach", "detach", "vacuum", "reindex", "analyze", "copy", "install", "load",
]
_INJECTION = [
    r"--", r"/\*.*?\*/", r";\s*\w+",
    r"\bunion\s+select\b", r"\bor\s+1\s*=\s*1\b",
]


def _validate_select_only(statement: str) -> None:
    """Raise SecurityError unless `statement` is a single safe SELECT."""
    normalized = statement.lower().strip()
    if not normalized.startswith("select"):
        raise SecurityError("Only SELECT statements are allowed")
    if len(statement) > 5000:
        raise SecurityError("Query too long — potential DoS")
    for kw in _DANGEROUS:
        if re.search(r"\b" + re.escape(kw) + r"\b", normalized, re.IGNORECASE):
            raise SecurityError(f"Dangerous SQL keyword detected: {kw}")
    for pattern in _INJECTION:
        if re.search(pattern, normalized, re.IGNORECASE):
            raise SecurityError("Potential SQL injection pattern detected")
    if normalized.count("select") > 5:
        raise SecurityError("Too many nested subqueries")


def _serialize(v: Any) -> Any:
    """Make DuckDB values JSON-safe (mirrors the PostgreSQL manager)."""
    if isinstance(v, decimal.Decimal):
        return float(v)
    if isinstance(v, (datetime.datetime, datetime.date, datetime.time)):
        return v.isoformat()
    if isinstance(v, _uuid.UUID):
        return str(v)
    return v


def _pg_conn_string(creds: Dict[str, Any]) -> str:
    """Build a libpq connection string for DuckDB's postgres ATTACH."""
    return (
        f"host={creds['host']} "
        f"port={int(creds.get('port', 5432))} "
        f"dbname={creds['database']} "
        f"user={creds['username']} "
        f"password={creds['password']}"
    )


class DuckDBFederationManager:
    """
    Federates one user's Postgres + CSV-SQLite behind a single DuckDB engine.

    Lifecycle: construct with the user's PG credentials and the path to their
    CSV SQLite file, then call execute_query() / get_schema(). Stateless — each
    call opens and closes its own DuckDB connection.
    """

    def __init__(self, pg_credentials: Dict[str, Any], sqlite_path: str) -> None:
        self._pg = pg_credentials
        self._sqlite_path = sqlite_path

    # ------------------------------------------------------------------
    def _open(self):
        """Open an in-memory DuckDB conn with both sources attached READ_ONLY."""
        import duckdb
        con = duckdb.connect()  # in-memory
        con.execute("LOAD sqlite; LOAD postgres;")
        # SQLite CSV file — read-only. ATTACH takes a literal path (no bound
        # params); the path is server-derived, but escape quotes defensively.
        safe_sqlite = self._sqlite_path.replace("'", "''")
        con.execute(
            f"ATTACH '{safe_sqlite}' AS {CSV_CATALOG} (TYPE SQLITE, READ_ONLY)"
        )
        # User's Postgres — read-only, and restricted to the `public` schema.
        # This mirrors the single-Postgres path (which already lists only public
        # tables) and, critically, keeps managed-Postgres SYSTEM schemas
        # (e.g. Supabase's auth / vault / storage) from being attached — so they
        # can neither appear in the schema prompt nor be queried by the LLM.
        con.execute(
            f"ATTACH '{_pg_conn_string(self._pg)}' AS {PG_CATALOG} "
            f"(TYPE POSTGRES, READ_ONLY, SCHEMA 'public')"
        )
        return con

    # ------------------------------------------------------------------
    async def execute_query(self, statement: str) -> "QueryResult":
        """Validate + run a read-only SELECT across both attached sources."""
        _validate_select_only(statement)
        return await asyncio.to_thread(self._execute_sync, statement)

    def _execute_sync(self, statement: str) -> "QueryResult":
        start = time.time()
        con = None
        try:
            con = self._open()
            cur = con.execute(statement)
            columns = [d[0] for d in cur.description] if cur.description else []
            # Fetch one more than the cap so truncation is detectable.
            fetched = cur.fetchmany(MAX_RESULT_ROWS + 1)
            row_truncated = len(fetched) > MAX_RESULT_ROWS
            fetched = fetched[:MAX_RESULT_ROWS]

            rows = [
                {col: _serialize(val) for col, val in zip(columns, row)}
                for row in fetched
            ]
            rows, byte_truncated = _cap_rows_by_bytes(rows)

            elapsed_ms = (time.time() - start) * 1000
            logger.info(
                "DuckDB federated query executed",
                row_count=len(rows),
                execution_time_ms=round(elapsed_ms, 2),
            )
            return QueryResult(
                rows=rows,
                row_count=len(rows),
                columns=columns,
                execution_time_ms=round(elapsed_ms, 2),
                truncated=row_truncated or byte_truncated,
            )
        except SecurityError:
            raise
        except Exception as e:
            raise DatabaseError(f"DuckDB federated query failed: {e}")
        finally:
            if con is not None:
                try:
                    con.close()
                except Exception:
                    pass

    # ------------------------------------------------------------------
    async def get_schema(self) -> Dict[str, Any]:
        """
        Union schema across both catalogs, tables namespaced by catalog so the
        LLM references them exactly as DuckDB exposes them
        (e.g. pgdb.public.orders, csv.bank_export).
        """
        return await asyncio.to_thread(self._get_schema_sync)

    def _get_schema_sync(self) -> Dict[str, Any]:
        con = None
        try:
            con = self._open()
            rows = con.execute(
                """
                SELECT table_catalog, table_schema, table_name,
                       column_name, data_type
                FROM information_schema.columns
                WHERE table_catalog IN (?, ?)
                ORDER BY table_catalog, table_schema, table_name, ordinal_position
                """,
                [PG_CATALOG, CSV_CATALOG],
            ).fetchall()

            tables: Dict[str, Dict[str, Any]] = {}
            for cat, schema, tbl, col, dtype in rows:
                # SQLite catalog exposes schema "main"; drop it for a clean name.
                if cat == CSV_CATALOG:
                    qualified = f"{cat}.{tbl}"
                else:
                    qualified = f"{cat}.{schema}.{tbl}"
                tables.setdefault(qualified, {"name": qualified, "columns": []})
                tables[qualified]["columns"].append({"name": col, "type": str(dtype)})

            return {
                "tables": list(tables.values()),
                "mode": "detailed",
                "database_type": "DuckDB (federated: PostgreSQL + CSV)",
                "status": "success",
            }
        except Exception as e:
            logger.error("Failed to fetch federated schema", error=str(e))
            return {"error": str(e), "status": "failed"}
        finally:
            if con is not None:
                try:
                    con.close()
                except Exception:
                    pass

    # ------------------------------------------------------------------
    async def test_connection(self) -> bool:
        """True if both sources attach and a trivial query runs."""
        try:
            def _ping():
                con = self._open()
                try:
                    con.execute("SELECT 1")
                    return True
                finally:
                    con.close()
            return await asyncio.to_thread(_ping)
        except Exception:
            return False
