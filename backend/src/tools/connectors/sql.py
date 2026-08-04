"""
FACT System SQL Query Tool

This module implements the SQL query tool for secure database access
following the FACT architecture specification.
"""

import time
from typing import Dict, Any, List, Optional
import structlog

try:
    # Try relative imports first (when used as package)
    from ...core.errors import DatabaseError, SecurityError, InvalidSQLError
    from ...db.connection import DatabaseManager, get_postgres_manager, current_user_uid, db_manager
    from ..decorators import Tool
except ImportError:
    # Fall back to absolute imports (when run as script)
    import sys
    from pathlib import Path
    # Add src to path if not already there
    src_path = str(Path(__file__).parent.parent.parent)
    if src_path not in sys.path:
        sys.path.insert(0, src_path)
    
    from core.errors import DatabaseError, SecurityError, InvalidSQLError
    from db.connection import DatabaseManager, get_postgres_manager, current_user_uid, db_manager
    from tools.decorators import Tool


logger = structlog.get_logger(__name__)


class SQLQueryTool:
    """
    SQL query tool implementation with security validation and connection management.
    
    Provides secure read-only database access through validated SQL queries.
    """
    
    def __init__(self, database_manager: DatabaseManager):
        """
        Initialize SQL query tool.
        
        Args:
            database_manager: DatabaseManager instance for query execution
        """
        self.database_manager = database_manager
        
    async def execute_query(self, statement: str) -> Dict[str, Any]:
        """
        Execute a validated SQL query and return structured results.
        
        Args:
            statement: SQL SELECT statement to execute
            
        Returns:
            Dictionary containing query results and metadata
            
        Raises:
            SecurityError: If statement violates security rules
            InvalidSQLError: If statement has syntax errors
            DatabaseError: If query execution fails
        """
        query_id = f"query_{int(time.time() * 1000)}"
        start_time = time.time()
        
        try:
            # Multi-tenant routing (precedence):
            # 1. THIS user's own PostgreSQL pool
            # 2. THIS user's CSV-ingested SQLite database
            # 3. Legacy single-user PostgreSQLManager (compat)
            # 4. SQLite demo dataset
            uid = current_user_uid.get()
            user_manager = db_manager.get_manager_for_uid(uid) if db_manager.pools else None
            csv_manager = db_manager.get_sqlite_manager_for_uid(uid)

            if user_manager is not None:
                result = await user_manager.execute_query(statement)
            elif csv_manager is not None:
                result = await csv_manager.execute_query(statement)
            else:
                pg = get_postgres_manager()
                active_manager = pg if pg is not None else self.database_manager
                result = await active_manager.execute_query(statement)
            
            execution_time = (time.time() - start_time) * 1000

            # Empty result set — not an error, but signal the LLM clearly so it
            # doesn't retry with the same query or hallucinate data.
            if result.row_count == 0:
                logger.info("SQL query returned zero rows",
                            query_id=query_id,
                            execution_time_ms=execution_time)
                return {
                    "query_id": query_id,
                    "message": "No matching data found in the database for your query.",
                    "rows": [],
                    "row_count": 0,
                    "columns": result.columns,
                    "execution_time_ms": execution_time,
                    "status": "success",
                }

            # Format response
            response = {
                "query_id": query_id,
                "rows": result.rows,
                "row_count": result.row_count,
                "columns": result.columns,
                "truncated": result.truncated,
                "execution_time_ms": execution_time,
                "statement": statement[:100] + "..." if len(statement) > 100 else statement,
                "status": "success"
            }

            # Tell the LLM when the result was capped server-side, so it does
            # not present a partial list as complete or compute totals/averages
            # from the visible rows instead of using a SQL aggregate.
            if result.truncated:
                response["notice"] = (
                    f"Result was truncated to the first {result.row_count} rows. "
                    "Tell the user the list is partial, and for totals/averages/counts "
                    "use a SQL aggregate (SUM, AVG, COUNT) or add WHERE filters/LIMIT "
                    "rather than computing from these rows."
                )

            logger.info("SQL query executed successfully",
                       query_id=query_id,
                       row_count=result.row_count,
                       execution_time_ms=execution_time)

            return response

        except (SecurityError, InvalidSQLError, DatabaseError) as e:
            execution_time = (time.time() - start_time) * 1000

            logger.error("SQL query failed",
                        query_id=query_id,
                        error=str(e),
                        error_type=type(e).__name__,
                        execution_time_ms=execution_time)

            # Return a short, sanitized error message so the LLM receives only
            # actionable signal — no stack traces, schema dumps, or long DB errors.
            return {
                "query_id": query_id,
                "error": _sanitize_sql_error(e),
                "status": "failed",
                "execution_time_ms": execution_time,
            }

        except Exception as e:
            # Unexpected errors (connection drops, driver bugs, etc.)
            # Return as failed so the driver retry loop can decide whether to
            # continue — never propagate raw exceptions to the LLM or user.
            execution_time = (time.time() - start_time) * 1000

            logger.error("Unexpected error during SQL execution",
                        query_id=query_id,
                        error=str(e),
                        error_type=type(e).__name__,
                        execution_time_ms=execution_time)

            return {
                "query_id": query_id,
                "error": _sanitize_sql_error(e),
                "status": "failed",
                "execution_time_ms": execution_time,
            }


# ---------------------------------------------------------------------------
# SQL error sanitization
# ---------------------------------------------------------------------------

def _sanitize_sql_error(exc: Exception) -> str:
    """
    Convert a raw database exception into a short, LLM-friendly error string.

    Goals:
    - No stack traces or internal paths
    - No schema dumps or full query text
    - Always ≤ 100 characters
    - Enough signal for the LLM to correct its query and retry

    The function recognises the most common SQLite and PostgreSQL error
    patterns and maps them to terse, actionable phrases.  Anything that
    does not match a known pattern falls back to a generic one-liner.
    """
    import re

    raw = str(exc).strip()

    # ── Pattern table ────────────────────────────────────────────────────────
    # Each entry is (compiled_regex, template_string).
    # Named groups in the regex are substituted into the template.
    # Patterns are tried in order; first match wins.
    _PATTERNS = [
        # no such column / column does not exist
        (re.compile(r"no such column[:\s]+(['\"]?)(?P<col>[\w.]+)\1", re.I),
         "Error: column '{col}' does not exist."),
        (re.compile(r'column "(?P<col>[^"]+)" does not exist', re.I),
         "Error: column '{col}' does not exist."),
        (re.compile(r"Unknown column '(?P<col>[^']+)'", re.I),
         "Error: column '{col}' does not exist."),

        # no such table / relation does not exist
        (re.compile(r"no such table[:\s]+(?P<tbl>\w+)", re.I),
         "Error: table '{tbl}' does not exist."),
        (re.compile(r'relation "(?P<tbl>[^"]+)" does not exist', re.I),
         "Error: table '{tbl}' does not exist."),
        (re.compile(r"Table '(?P<tbl>[^']+)' doesn't exist", re.I),
         "Error: table '{tbl}' does not exist."),

        # ambiguous column
        (re.compile(r"ambiguous column name[:\s]+(?P<col>\w+)", re.I),
         "Error: column '{col}' is ambiguous — qualify with table name."),
        (re.compile(r'column reference "(?P<col>[^"]+)" is ambiguous', re.I),
         "Error: column '{col}' is ambiguous — qualify with table name."),

        # syntax errors — show only the near-fragment, not the full query
        (re.compile(r"syntax error.*?near[:\s]+[\"']?(?P<tok>[^\"'\s,]{1,30})", re.I),
         "Error: SQL syntax error near '{tok}'."),
        (re.compile(r'syntax error at or near "(?P<tok>[^"]{1,30})"', re.I),
         "Error: SQL syntax error near '{tok}'."),

        # type / operator errors
        (re.compile(r"operator does not exist.*?(?P<detail>[\w ]{1,40})", re.I),
         "Error: type mismatch — {detail}."),
        (re.compile(r"cannot cast|invalid input syntax for type (?P<typ>\w+)", re.I),
         "Error: invalid value for type '{typ}'."),

        # permission / read-only
        (re.compile(r"attempt to write a readonly database|read.only", re.I),
         "Error: database is read-only; only SELECT is allowed."),
        (re.compile(r"permission denied for (table|relation) (?P<tbl>\w+)", re.I),
         "Error: permission denied for table '{tbl}'."),

        # constraint violations (shouldn't happen on SELECT, but guard anyway)
        (re.compile(r"UNIQUE constraint failed[:\s]+(?P<col>[\w.]+)", re.I),
         "Error: unique constraint violation on '{col}'."),
        (re.compile(r"NOT NULL constraint failed[:\s]+(?P<col>[\w.]+)", re.I),
         "Error: NOT NULL constraint violated on '{col}'."),

        # timeout
        (re.compile(r"query.*?timeout|statement timeout", re.I),
         "Error: query timed out — simplify or add filters."),

        # connection lost
        (re.compile(r"connection.*?(lost|closed|refused|reset)", re.I),
         "Error: database connection lost."),
    ]

    for pattern, template in _PATTERNS:
        m = pattern.search(raw)
        if m:
            msg = template.format(**m.groupdict())
            return msg[:100]

    # ── Generic fallback ─────────────────────────────────────────────────────
    # Take only the first line to avoid multi-line DB errors.
    first_line = raw.splitlines()[0] if raw else "unknown error"
    # Strip file paths, line references, and traceback artefacts.
    first_line = re.sub(r'File "[^"]+", line \d+', '', first_line)
    first_line = re.sub(r',?\s*in \w+\s*$', '', first_line)
    first_line = re.sub(r'\s+', ' ', first_line).strip()
    generic = f"Error: {first_line}" if first_line else "Error: query failed."
    return generic[:100]


# Global SQL tool instance (will be initialized by driver)
_sql_tool_instance = None


def initialize_sql_tool(database_manager: DatabaseManager) -> None:
    """
    Initialize the global SQL tool instance.
    
    Args:
        database_manager: DatabaseManager instance to use
    """
    global _sql_tool_instance
    _sql_tool_instance = SQLQueryTool(database_manager)
    logger.info("SQL query tool initialized")


@Tool(
    name="SQL_QueryReadonly",
    description="Execute SELECT queries on the finance database to retrieve financial data, company information, and analytics. Only read-only SELECT statements are allowed for security.",
    parameters={
        "statement": {
            "type": "string",
            "description": "SQL SELECT statement to execute. Must start with SELECT and cannot contain data modification operations (INSERT, UPDATE, DELETE, etc.). Example: 'SELECT * FROM companies WHERE sector = \"Technology\"'",
            "minLength": 10,
            "maxLength": 1000
        }
    },
    requires_auth=False,
    timeout_seconds=30,
    version="1.0.0"
)
async def sql_query_readonly(statement: str) -> Dict[str, Any]:
    """
    Execute a read-only SQL query on the finance database.
    
    This tool provides secure access to the financial database using validated
    SELECT statements. It prevents data modification and enforces security
    constraints to ensure safe database access.
    
    Args:
        statement: SQL SELECT statement to execute
        
    Returns:
        Dictionary containing query results, metadata, and execution statistics
        
    Example:
        statement = "SELECT name, revenue FROM companies c JOIN financial_records f ON c.id = f.company_id WHERE f.year = 2025"
        result = await sql_query_readonly(statement)
        # Returns: {
        #     "rows": [{"name": "TechCorp", "revenue": 25000000000}, ...],
        #     "row_count": 5,
        #     "columns": ["name", "revenue"],
        #     "execution_time_ms": 15.2,
        #     "status": "success"
        # }
    """
    if _sql_tool_instance is None:
        return {
            "error": "SQL tool not initialized",
            "status": "failed",
            "execution_time_ms": 0
        }
    
    return await _sql_tool_instance.execute_query(statement)


# ---------------------------------------------------------------------------
# Schema discovery constants
# ---------------------------------------------------------------------------
_MAX_OVERVIEW_TABLES  = 100   # max tables returned in overview (Case A)
_MAX_DETAIL_COLUMNS   = 100   # max columns returned per table  (Case B)


# ---------------------------------------------------------------------------
# Internal helpers — one per backend
# ---------------------------------------------------------------------------

async def _pg_schema_overview(pg_manager) -> Dict[str, Any]:
    """Return table names only (≤100) from a PostgreSQL manager."""
    async with pg_manager._pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type   = 'BASE TABLE'
            ORDER BY table_name
            LIMIT $1
        """, _MAX_OVERVIEW_TABLES)
    return {
        "tables":       [r["table_name"] for r in rows],
        "mode":         "overview",
        "database_type": "PostgreSQL",
        "status":       "success",
    }


async def _pg_schema_detail(pg_manager, table_names: List[str]) -> Dict[str, Any]:
    """Return full column metadata for the requested tables (PostgreSQL)."""
    result_tables = []
    async with pg_manager._pool.acquire() as conn:
        for table_name in table_names:
            col_rows = await conn.fetch("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name   = $1
                ORDER BY ordinal_position
                LIMIT $2
            """, table_name, _MAX_DETAIL_COLUMNS)

            result_tables.append({
                "name": table_name,
                "columns": [
                    {
                        "name":     cr["column_name"],
                        "type":     cr["data_type"],
                        "nullable": cr["is_nullable"] == "YES",
                    }
                    for cr in col_rows
                ],
            })
    return {
        "tables":        result_tables,
        "mode":          "detailed",
        "database_type": "PostgreSQL",
        "status":        "success",
    }


async def _sqlite_schema_overview() -> Dict[str, Any]:
    """Return table names only (≤100) from the SQLite demo database."""
    tables_query = """
        SELECT name AS table_name
        FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
        LIMIT {}
    """.format(_MAX_OVERVIEW_TABLES)
    tables_result = await _sql_tool_instance.execute_query(tables_query)
    return {
        "tables":        [r["table_name"] for r in tables_result["rows"]],
        "mode":          "overview",
        "database_type": "SQLite",
        "status":        "success",
    }


async def _sqlite_schema_detail(table_names: List[str]) -> Dict[str, Any]:
    """Return full column metadata for the requested tables (SQLite)."""
    result_tables = []
    for table_name in table_names:
        # Validate before embedding in PRAGMA (cannot be parameterised)
        if not _sql_tool_instance.database_manager._is_valid_table_name(table_name):
            logger.warning("Skipping invalid table name in schema detail", table_name=table_name)
            continue

        try:
            columns_result = await _sql_tool_instance.execute_query(
                f'PRAGMA table_info("{table_name}")'
            )
            columns = [
                {
                    "name":        col["name"],
                    "type":        col["type"],
                    "nullable":    not col["notnull"],
                    "primary_key": bool(col["pk"]),
                }
                for col in columns_result["rows"][:_MAX_DETAIL_COLUMNS]
            ]
            result_tables.append({"name": table_name, "columns": columns})
        except Exception as e:
            logger.error("Failed to get column info for table",
                         table_name=table_name, error=str(e))
            continue

    return {
        "tables":        result_tables,
        "mode":          "detailed",
        "database_type": "SQLite",
        "status":        "success",
    }


# ---------------------------------------------------------------------------
# Tool definition
# ---------------------------------------------------------------------------

@Tool(
    name="SQL_GetSchema",
    description=(
        "Two-step schema discovery to avoid flooding the prompt on large databases. "
        "Step 1 — call with no arguments to get a list of table names (overview mode, max 100 tables). "
        "Step 2 — call with table_names=['orders', 'users'] to get full column metadata for those tables only. "
        "Always run Step 1 first, then Step 2 for only the tables you need."
    ),
    parameters={
        "table_names": {
            "type":        "array",
            "items":       {"type": "string"},
            "description": (
                "Optional. List of table names to fetch full column details for (Step 2). "
                "Omit or pass null to get an overview of all table names only (Step 1)."
            ),
        }
    },
    requires_auth=False,
    timeout_seconds=15,
    version="2.0.0"
)
async def sql_get_schema(table_names: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Two-step schema discovery tool.

    Case A — table_names is None (overview):
        Returns only a list of table names, capped at 100.
        Example: {"tables": ["users", "orders"], "mode": "overview"}

    Case B — table_names provided (detailed):
        Returns full column metadata for those specific tables, capped at
        100 columns per table.
        Example: {"tables": [{"name": "orders", "columns": [...]}], "mode": "detailed"}

    Works for both PostgreSQL (multi-tenant + legacy) and SQLite (demo/dev).
    """
    if _sql_tool_instance is None:
        return {
            "error": "SQL tool not initialized",
            "status": "failed",
            "execution_time_ms": 0
        }

    try:
        # ── Resolve which backend to use ──────────────────────────────────
        # Priority: own Postgres pool → CSV SQLite → legacy single PG → SQLite demo.
        # The SQLite branch below issues its queries through _sql_tool_instance,
        # so a user's CSV data is reached automatically via the same routing.
        uid = current_user_uid.get()
        pg_manager = db_manager.get_manager_for_uid(uid) if db_manager.pools else None
        has_csv = db_manager.get_sqlite_manager_for_uid(uid) is not None

        # Only fall back to the legacy single PG manager when the user has no CSV
        # source — otherwise a CSV user would be misrouted to the demo/legacy PG.
        if pg_manager is None and not has_csv:
            pg_manager = get_postgres_manager()   # may still be None

        is_postgres = pg_manager is not None

        # ── Case A: overview (table names only) ───────────────────────────
        if table_names is None:
            if is_postgres:
                return await _pg_schema_overview(pg_manager)
            else:
                return await _sqlite_schema_overview()

        # ── Case B: detailed (columns for named tables) ───────────────────
        # Validate input — reject obviously bad table names early
        safe_names = [
            t for t in table_names
            if isinstance(t, str) and t.strip() and len(t) <= 64
        ]
        if not safe_names:
            return {
                "error": "No valid table names provided.",
                "status": "failed",
                "execution_time_ms": 0,
            }

        if is_postgres:
            return await _pg_schema_detail(pg_manager, safe_names)
        else:
            return await _sqlite_schema_detail(safe_names)

    except Exception as e:
        logger.error("Failed to get schema information", error=str(e))
        return {
            "error": f"Failed to get schema: {e}",
            "status": "failed",
            "execution_time_ms": 0,
        }


@Tool(
    name="SQL_GetSampleQueries",
    description="Get sample SQL queries for exploring the financial database",
    parameters={},
    requires_auth=False,
    timeout_seconds=5,
    version="1.0.0"
)
async def sql_get_sample_queries() -> Dict[str, Any]:
    """
    Get sample SQL queries that can be used to explore the financial database.
    
    Returns:
        Dictionary containing sample queries with descriptions
    """
    sample_queries = [
        {
            "description": "Get all companies in the Technology sector",
            "query": "SELECT * FROM companies WHERE sector = 'Technology'"
        },
        {
            "description": "Get total revenue by company for 2024",
            "query": "SELECT c.name, SUM(f.revenue) as total_revenue FROM companies c JOIN financial_records f ON c.id = f.company_id WHERE f.year = 2024 GROUP BY c.id, c.name ORDER BY total_revenue DESC"
        },
        {
            "description": "Get Q1 2025 financial results",
            "query": "SELECT c.name, f.revenue, f.profit, f.expenses FROM companies c JOIN financial_records f ON c.id = f.company_id WHERE f.quarter = 'Q1' AND f.year = 2025 ORDER BY f.revenue DESC"
        },
        {
            "description": "Get company count by sector",
            "query": "SELECT sector, COUNT(*) as company_count FROM companies GROUP BY sector ORDER BY company_count DESC"
        },
        {
            "description": "Get TechCorp's quarterly performance over time",
            "query": "SELECT c.name, f.quarter, f.year, f.revenue, f.profit FROM companies c JOIN financial_records f ON c.id = f.company_id WHERE c.symbol = 'TECH' ORDER BY f.year DESC, f.quarter DESC"
        },
        {
            "description": "Get average metrics for 2024",
            "query": "SELECT AVG(revenue) as avg_revenue, AVG(profit) as avg_profit, AVG(expenses) as avg_expenses FROM financial_records WHERE year = 2024"
        },
        {
            "description": "Get top companies by market cap with latest revenue",
            "query": "SELECT c.name, c.market_cap, f.revenue as q1_2025_revenue FROM companies c JOIN financial_records f ON c.id = f.company_id WHERE f.year = 2025 AND f.quarter = 'Q1' ORDER BY c.market_cap DESC"
        }
    ]
    
    return {
        "sample_queries": sample_queries,
        "total_queries": len(sample_queries),
        "status": "success",
        "execution_time_ms": 0
    }


def get_sql_tool() -> SQLQueryTool:
    """
    Get the global SQL tool instance.
    
    Returns:
        Global SQLQueryTool instance
        
    Raises:
        RuntimeError: If SQL tool is not initialized
    """
    if _sql_tool_instance is None:
        raise RuntimeError("SQL tool not initialized. Call initialize_sql_tool first.")
    
    return _sql_tool_instance