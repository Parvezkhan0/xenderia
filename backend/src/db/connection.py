"""
FACT System Database Connection Management

This module handles SQLite database connections, query execution,
and database initialization with sample data.
"""

import aiosqlite
import sqlite3
import os
import time
import asyncio
from typing import Dict, List, Any, Optional, Tuple
from contextlib import asynccontextmanager
import structlog

try:
    # Try relative imports first (when used as package)
    from ..core.errors import DatabaseError, SecurityError, InvalidSQLError
    from .models import (
        DATABASE_SCHEMA,
        SAMPLE_COMPANIES,
        SAMPLE_FINANCIAL_RECORDS,
        QueryResult,
        validate_schema_integrity
    )
except ImportError:
    # Fall back to absolute imports (when run as script)
    import sys
    from pathlib import Path
    # Add src to path if not already there
    src_path = str(Path(__file__).parent.parent)
    if src_path not in sys.path:
        sys.path.insert(0, src_path)
    
    from core.errors import DatabaseError, SecurityError, InvalidSQLError
    from db.models import (
        DATABASE_SCHEMA,
        SAMPLE_COMPANIES,
        SAMPLE_FINANCIAL_RECORDS,
        QueryResult,
        validate_schema_integrity
    )


logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Server-side result caps
# ---------------------------------------------------------------------------
# These bound what a single query can return so a large table (e.g. an
# uploaded CSV) can never load an unbounded result set into memory or blow up
# the LLM prompt. Aggregates (SUM/COUNT/AVG) return few rows and are unaffected.
MAX_RESULT_ROWS = 200            # hard ceiling on rows returned
MAX_RESULT_BYTES = 256 * 1024    # ceiling on serialized row payload (~256 KB)


def _cap_rows_by_bytes(rows: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], bool]:
    """
    Trim trailing rows until the JSON-serialized payload is under
    MAX_RESULT_BYTES. Guards against wide/blob columns bloating the prompt
    even when the row count is already capped.

    Returns (possibly-trimmed rows, truncated_flag).
    """
    import json
    truncated = False
    while len(rows) > 1 and len(json.dumps(rows, default=str)) > MAX_RESULT_BYTES:
        drop = max(1, len(rows) // 10)   # shed ~10% per pass; converges fast for <=200 rows
        rows = rows[:-drop]
        truncated = True
    return rows, truncated


class AsyncConnectionPool:
    """
    Async connection pool for SQLite database connections.
    
    Provides connection reuse and management to reduce connection overhead.
    """
    
    def __init__(self, database_path: str, pool_size: int = 10):
        """
        Initialize connection pool.
        
        Args:
            database_path: Path to SQLite database
            pool_size: Maximum number of connections in pool
        """
        self.database_path = database_path
        self.pool_size = pool_size
        self.pool: asyncio.Queue = asyncio.Queue(maxsize=pool_size)
        self.created_connections = 0
        self._lock = asyncio.Lock()
        
    async def get_connection(self) -> aiosqlite.Connection:
        """Get a connection from the pool or create a new one."""
        try:
            # Try to get existing connection
            conn = self.pool.get_nowait()
            logger.debug("Reused pooled connection")
            return conn
        except asyncio.QueueEmpty:
            # Create new connection if pool is empty and we haven't hit limit
            async with self._lock:
                if self.created_connections < self.pool_size:
                    conn = await aiosqlite.connect(self.database_path)
                    self.created_connections += 1
                    logger.debug("Created new pooled connection",
                               total_connections=self.created_connections)
                    return conn
                else:
                    # Wait for a connection to become available
                    conn = await self.pool.get()
                    logger.debug("Retrieved connection from pool after wait")
                    return conn
    
    async def return_connection(self, conn: aiosqlite.Connection):
        """Return a connection to the pool."""
        try:
            self.pool.put_nowait(conn)
            logger.debug("Returned connection to pool")
        except asyncio.QueueFull:
            # Pool is full, close the connection
            await conn.close()
            async with self._lock:
                self.created_connections -= 1
            logger.debug("Closed excess connection",
                        total_connections=self.created_connections)
    
    async def close_all(self):
        """Close all connections in the pool."""
        connections_closed = 0
        while not self.pool.empty():
            try:
                conn = self.pool.get_nowait()
                await conn.close()
                connections_closed += 1
            except asyncio.QueueEmpty:
                break
        
        async with self._lock:
            self.created_connections = 0
        
        logger.info("Closed all pooled connections", connections_closed=connections_closed)


class DatabaseManager:
    """
    Manages SQLite database connections and operations for the FACT system.
    
    Provides secure database access with read-only query validation,
    connection pooling, and performance monitoring.
    """
    
    def __init__(self, database_path: str, pool_size: int = 10):
        """
        Initialize database manager with connection pooling.
        
        Args:
            database_path: Path to SQLite database file
            pool_size: Maximum number of connections in pool
        """
        self.database_path = database_path
        self.pool_size = pool_size
        self.connection_pool = AsyncConnectionPool(database_path, pool_size)
        self._ensure_directory_exists()
        self._query_plan_cache = {}  # Cache for validated queries
        self._cache_max_size = 1000
        
    def _ensure_directory_exists(self) -> None:
        """Ensure the database directory exists."""
        db_dir = os.path.dirname(self.database_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
            logger.info("Created database directory", path=db_dir)
    
    async def initialize_database(self) -> None:
        """
        Initialize database with schema and sample data.
        
        Raises:
            DatabaseError: If database initialization fails
        """
        try:
            async with aiosqlite.connect(self.database_path) as db:
                # Execute schema creation
                await db.executescript(DATABASE_SCHEMA)
                await db.commit()
                
                # Check if data already exists
                cursor = await db.execute("SELECT COUNT(*) FROM companies")
                company_count = (await cursor.fetchone())[0]
                await cursor.close()
                
                # Check if financial_data table has data
                cursor = await db.execute("SELECT COUNT(*) FROM financial_data")
                financial_data_count = (await cursor.fetchone())[0]
                await cursor.close()
                
                # Check if benchmarks table has data
                cursor = await db.execute("SELECT COUNT(*) FROM benchmarks")
                benchmarks_count = (await cursor.fetchone())[0]
                await cursor.close()
                
                if company_count == 0:
                    # Batch insert sample companies for better performance
                    await db.executemany("""
                        INSERT INTO companies (name, symbol, sector, founded_year, employees, market_cap)
                        VALUES (:name, :symbol, :sector, :founded_year, :employees, :market_cap)
                    """, SAMPLE_COMPANIES)
                    
                    # Batch insert sample financial records
                    await db.executemany("""
                        INSERT INTO financial_records (company_id, quarter, year, revenue, profit, expenses)
                        VALUES (:company_id, :quarter, :year, :revenue, :profit, :expenses)
                    """, SAMPLE_FINANCIAL_RECORDS)
                    
                    # Batch insert into financial_data table for validation compatibility
                    await db.executemany("""
                        INSERT INTO financial_data (company_id, quarter, year, revenue, profit, expenses)
                        VALUES (:company_id, :quarter, :year, :revenue, :profit, :expenses)
                    """, SAMPLE_FINANCIAL_RECORDS)
                    
                    # Insert sample benchmark data
                    sample_benchmarks = [
                        {
                            "test_name": "system_initialization",
                            "duration_ms": 250.5,
                            "queries_executed": 0,
                            "cache_hit_rate": 0.0,
                            "average_response_time_ms": 0.0,
                            "success_rate": 1.0,
                            "notes": "Initial system setup benchmark"
                        },
                        {
                            "test_name": "cache_warming",
                            "duration_ms": 180.2,
                            "queries_executed": 10,
                            "cache_hit_rate": 0.0,
                            "average_response_time_ms": 18.02,
                            "success_rate": 1.0,
                            "notes": "Cache warming performance test"
                        }
                    ]
                    
                    for benchmark in sample_benchmarks:
                        await db.execute("""
                            INSERT INTO benchmarks (test_name, duration_ms, queries_executed, cache_hit_rate,
                                                  average_response_time_ms, success_rate, notes)
                            VALUES (:test_name, :duration_ms, :queries_executed, :cache_hit_rate,
                                   :average_response_time_ms, :success_rate, :notes)
                        """, benchmark)
                    
                    await db.commit()
                    logger.info("Database initialized with sample data")
                
                # Handle the case where companies exist but other tables don't
                elif financial_data_count == 0:
                    logger.info("Adding missing financial_data records")
                    # Insert sample financial records into financial_data table
                    for record in SAMPLE_FINANCIAL_RECORDS:
                        await db.execute("""
                            INSERT INTO financial_data (company_id, quarter, year, revenue, profit, expenses)
                            VALUES (:company_id, :quarter, :year, :revenue, :profit, :expenses)
                        """, record)
                    await db.commit()
                    logger.info("Financial data populated")
                
                if benchmarks_count == 0:
                    logger.info("Adding missing benchmark records")
                    # Insert sample benchmark data
                    sample_benchmarks = [
                        {
                            "test_name": "system_initialization",
                            "duration_ms": 250.5,
                            "queries_executed": 0,
                            "cache_hit_rate": 0.0,
                            "average_response_time_ms": 0.0,
                            "success_rate": 1.0,
                            "notes": "Initial system setup benchmark"
                        },
                        {
                            "test_name": "cache_warming",
                            "duration_ms": 180.2,
                            "queries_executed": 10,
                            "cache_hit_rate": 0.0,
                            "average_response_time_ms": 18.02,
                            "success_rate": 1.0,
                            "notes": "Cache warming performance test"
                        }
                    ]
                    
                    for benchmark in sample_benchmarks:
                        await db.execute("""
                            INSERT INTO benchmarks (test_name, duration_ms, queries_executed, cache_hit_rate,
                                                  average_response_time_ms, success_rate, notes)
                            VALUES (:test_name, :duration_ms, :queries_executed, :cache_hit_rate,
                                   :average_response_time_ms, :success_rate, :notes)
                        """, benchmark)
                    await db.commit()
                    logger.info("Benchmark data populated")
                else:
                    logger.info("Database already contains data, skipping sample data insertion")
                
                # Validate schema integrity
                cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = await cursor.fetchall()
                await cursor.close()
                
                tables_info = [{"name": table[0]} for table in tables]
                if not validate_schema_integrity(tables_info):
                    raise DatabaseError("Database schema validation failed")
                
        except Exception as e:
            logger.error("Database initialization failed", error=str(e))
            raise DatabaseError(f"Failed to initialize database: {e}")
    def validate_sql_query(self, statement: str) -> None:
        """
        Validate SQL query for security and syntax with caching.
        
        Args:
            statement: SQL statement to validate
            
        Raises:
            SecurityError: If statement contains dangerous operations
            InvalidSQLError: If statement has syntax errors
        """
        # Generate cache key for query validation
        import hashlib
        query_hash = hashlib.md5(statement.encode()).hexdigest()
        
        # Check cache first
        if query_hash in self._query_plan_cache:
            logger.debug("Query validation cache hit", statement=statement[:100])
            return
        
        normalized_statement = statement.lower().strip()
        
        # Security check: allow SELECT statements and safe PRAGMA queries
        is_select = normalized_statement.startswith("select")
        is_safe_pragma = normalized_statement.startswith("pragma table_info")
        
        if not (is_select or is_safe_pragma):
            raise SecurityError("Only SELECT statements and PRAGMA table_info queries are allowed")
        
        # Enhanced dangerous keyword detection (excluding safe pragma)
        dangerous_keywords = [
            "drop", "delete", "update", "insert", "alter", "create",
            "truncate", "replace", "merge", "exec", "execute",
            "attach", "detach", "vacuum", "reindex", "analyze"
        ]
        
        # For PRAGMA queries, only allow table_info
        if normalized_statement.startswith("pragma") and not normalized_statement.startswith("pragma table_info"):
            raise SecurityError("Only PRAGMA table_info queries are allowed")
        
        # Check for dangerous keywords with word boundaries
        import re
        for keyword in dangerous_keywords:
            pattern = r'\b' + re.escape(keyword) + r'\b'
            if re.search(pattern, normalized_statement, re.IGNORECASE):
                raise SecurityError(f"Dangerous SQL keyword detected: {keyword}")
        
        # Check for SQL injection patterns
        # Check for SQL injection patterns (skip for safe PRAGMA queries)
        if not normalized_statement.startswith("pragma table_info"):
            injection_patterns = [
                r'--',  # SQL comments
                r'/\*.*?\*/',  # Multi-line comments
                r';\s*\w+',  # Multiple statements
                r'\bunion\s+select\b',  # Union injection
                r'\bor\s+1\s*=\s*1\b',  # Always true conditions
                r'\band\s+1\s*=\s*1\b',  # Always true conditions
                r'\bor\s+\'.*?\'\s*=\s*\'.*?\'',  # Suspicious OR with string comparisons
                r'\'.*?\'\s*or\s*\'.*?\'',  # Injection with OR between quotes
                r'\\x[0-9a-f]{2}',  # Hex encoding
            ]
            
            for pattern in injection_patterns:
                if re.search(pattern, normalized_statement, re.IGNORECASE):
                    raise SecurityError(f"Potential SQL injection pattern detected: {pattern} in query: {normalized_statement[:100]}")
        # Limit query complexity
        if len(statement) > 5000:
            raise SecurityError("Query too long - potential DoS attack")
        
        # Count nested subqueries to prevent complex injection attacks
        subquery_count = normalized_statement.count('select')
        if subquery_count > 5:
            raise SecurityError("Too many nested subqueries - potential injection attack")
        
        # Basic syntax validation using actual database connection
        try:
            # Parse SQL to check syntax (without executing)
            with sqlite3.connect(self.database_path) as conn:
                conn.execute(f"EXPLAIN QUERY PLAN {statement}")
        except sqlite3.Error as e:
            raise InvalidSQLError(f"SQL syntax error: {e}")
        
        # Cache successful validation
        if len(self._query_plan_cache) >= self._cache_max_size:
            # Simple eviction: remove oldest entries
            oldest_keys = list(self._query_plan_cache.keys())[:100]
            for key in oldest_keys:
                del self._query_plan_cache[key]
        
        self._query_plan_cache[query_hash] = time.time()
        logger.debug("SQL query validation passed and cached", statement=statement[:100])
    
    def _is_valid_table_name(self, table_name: str) -> bool:
        """
        Validate table name to prevent SQL injection.
        
        Args:
            table_name: Table name to validate
            
        Returns:
            True if table name is valid
        """
        import re
        
        # Table name should only contain alphanumeric characters and underscores
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', table_name):
            return False
        
        # Reasonable length limit
        if len(table_name) > 64:
            return False
        
        # Check against known system tables that should not be accessed
        forbidden_tables = {
            'sqlite_master', 'sqlite_temp_master', 'sqlite_sequence',
            'sqlite_stat1', 'sqlite_stat2', 'sqlite_stat3', 'sqlite_stat4'
        }
        
        if table_name.lower() in forbidden_tables:
            return False
        
        return True
        logger.debug("SQL query validation passed", statement=statement[:100])
    
    async def execute_query(self, statement: str) -> QueryResult:
        """
        Execute a validated SQL query using connection pool.
        
        Args:
            statement: SQL SELECT statement to execute
            
        Returns:
            QueryResult containing rows, metadata, and timing
            
        Raises:
            DatabaseError: If query execution fails
            SecurityError: If statement violates security rules
            InvalidSQLError: If statement has syntax errors
        """
        # Validate query first (with caching)
        self.validate_sql_query(statement)
        
        start_time = time.time()
        
        try:
            # Get connection from pool
            db = await self.connection_pool.get_connection()
            
            try:
                # Enable row factory for dictionary-like access
                db.row_factory = aiosqlite.Row
                
                cursor = await db.execute(statement)
                # Fetch at most MAX_RESULT_ROWS+1 so truncation can be detected
                # without ever materializing an unbounded result set.
                fetched = await cursor.fetchmany(MAX_RESULT_ROWS + 1)
                row_truncated = len(fetched) > MAX_RESULT_ROWS
                fetched = fetched[:MAX_RESULT_ROWS]

                # Convert rows to dictionaries
                structured_results = []
                columns = []

                if fetched:
                    # Get column names from first row
                    columns = list(fetched[0].keys())

                    # Convert each row to dictionary
                    for row in fetched:
                        row_dict = {col: row[col] for col in columns}
                        structured_results.append(row_dict)

                await cursor.close()

                # Byte guard: capped rows can still be huge if columns are wide.
                structured_results, byte_truncated = _cap_rows_by_bytes(structured_results)

                end_time = time.time()
                execution_time_ms = (end_time - start_time) * 1000

                result = QueryResult(
                    rows=structured_results,
                    row_count=len(structured_results),
                    columns=columns,
                    execution_time_ms=execution_time_ms,
                    truncated=row_truncated or byte_truncated,
                )
                
                logger.info("Query executed successfully",
                           statement=statement[:100],
                           row_count=result.row_count,
                           execution_time_ms=execution_time_ms)
                
                return result
                
            finally:
                # Always return connection to pool
                await self.connection_pool.return_connection(db)
                
        except Exception as e:
            end_time = time.time()
            execution_time_ms = (end_time - start_time) * 1000
            
            logger.error("Query execution failed",
                        statement=statement[:100],
                        error=str(e),
                        execution_time_ms=execution_time_ms)
            
            raise DatabaseError(f"Query execution failed: {e}")
    
    async def get_database_info(self) -> Dict[str, Any]:
        """
        Get database metadata and statistics.
        
        Returns:
            Dictionary containing database information
        """
        try:
            async with aiosqlite.connect(self.database_path) as db:
                # Get table information
                cursor = await db.execute("""
                    SELECT name FROM sqlite_master
                    WHERE type='table' AND name NOT LIKE 'sqlite_%'
                """)
                tables = await cursor.fetchall()
                await cursor.close()
                
                table_info = {}
                for (table_name,) in tables:
                    # Validate table name to prevent injection
                    if not self._is_valid_table_name(table_name):
                        logger.warning("Invalid table name detected", table_name=table_name)
                        continue
                    
                    # Get row count for each table using parameterized query
                    # Note: Table names cannot be parameterized, so we validate them first
                    cursor = await db.execute(f"SELECT COUNT(*) FROM \"{table_name}\"")
                    count = (await cursor.fetchone())[0]
                    await cursor.close()
                    table_info[table_name] = {"row_count": count}
                
                # Get database file size
                file_size = os.path.getsize(self.database_path) if os.path.exists(self.database_path) else 0
                
                return {
                    "database_path": self.database_path,
                    "file_size_bytes": file_size,
                    "tables": table_info,
                    "total_tables": len(tables)
                }
                
        except Exception as e:
            logger.error("Failed to get database info", error=str(e))
            raise DatabaseError(f"Failed to get database info: {e}")
    
    async def cleanup(self):
        """
        Cleanup database resources including connection pool.
        """
        try:
            await self.connection_pool.close_all()
            logger.info("Database manager cleanup completed")
        except Exception as e:
            logger.error("Database cleanup failed", error=str(e))
    
    @asynccontextmanager
    async def get_connection(self):
        """
        Get an async database connection context manager.
        
        Yields:
            aiosqlite.Connection: Database connection
        """
        # Use connection pool instead of creating new connections
        conn = await self.connection_pool.get_connection()
        try:
            yield conn
        except Exception as e:
            logger.error("Database connection error", error=str(e))
            raise DatabaseError(f"Database connection error: {e}")
        finally:
            await self.connection_pool.return_connection(conn)


def create_database_manager(database_path: str) -> DatabaseManager:
    """
    Create and initialize a database manager instance.
    
    Args:
        database_path: Path to SQLite database file
        
    Returns:
        Configured DatabaseManager instance
    """
    return DatabaseManager(database_path)

# ===========================================================================
# PostgreSQL support — added on top of existing SQLite DatabaseManager
# Zero changes made to any existing code above this line.
# ===========================================================================

# Module-level active PostgreSQL manager (None = use SQLite demo)
_active_postgres_manager: "Optional[PostgreSQLManager]" = None


def set_postgres_manager(manager: "PostgreSQLManager") -> None:
    """Register a live PostgreSQL manager as the active backend."""
    global _active_postgres_manager
    _active_postgres_manager = manager
    logger.info("PostgreSQL manager activated", host=manager.host, database=manager.database)


def get_postgres_manager() -> "Optional[PostgreSQLManager]":
    """Return the active PostgreSQL manager, or None if not connected."""
    return _active_postgres_manager


def clear_postgres_manager() -> None:
    """Deactivate PostgreSQL — queries fall back to SQLite demo dataset."""
    global _active_postgres_manager
    _active_postgres_manager = None
    logger.info("PostgreSQL manager cleared — falling back to SQLite")


class PostgreSQLManager:
    """
    Manages an asyncpg connection pool for a user-supplied PostgreSQL database.

    Lifecycle:
        manager = await PostgreSQLManager.create(host, port, db, user, pw)
        result  = await manager.execute_query("SELECT ...")
        schema  = await manager.get_schema()
        await   manager.close()
    """

    def __init__(self, pool, host: str, port: int, database: str) -> None:
        self._pool = pool
        self.host = host
        self.port = port
        self.database = database
        self._query_cache: Dict[str, float] = {}
        self._cache_max = 1000

    # ------------------------------------------------------------------
    @classmethod
    async def create(
        cls,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        min_size: int = 2,
        max_size: int = 10,
    ) -> "PostgreSQLManager":
        """Create a PostgreSQLManager backed by a live asyncpg pool."""
        try:
            import asyncpg
        except ImportError:
            raise RuntimeError("asyncpg not installed. Run: pip install asyncpg")

        try:
            pool = await asyncpg.create_pool(
                host=host,
                port=port,
                database=database,
                user=username,
                password=password,
                min_size=min_size,
                max_size=max_size,
                command_timeout=30,
            )
        except Exception as e:
            raise DatabaseError(f"Failed to connect to PostgreSQL: {e}")

        logger.info("PostgreSQL connection pool created", host=host, database=database)
        return cls(pool, host, port, database)

    # ------------------------------------------------------------------
    async def execute_query(self, statement: str) -> "QueryResult":
        """
        Execute a validated SELECT query on PostgreSQL.
        Returns a QueryResult identical in shape to the SQLite version.
        """
        import hashlib, re

        # ── Security validation (mirrors DatabaseManager.validate_sql_query) ──
        normalized = statement.lower().strip()
        if not normalized.startswith("select"):
            raise SecurityError("Only SELECT statements are allowed")

        if len(statement) > 5000:
            raise SecurityError("Query too long — potential DoS")

        dangerous = [
            "drop", "delete", "update", "insert", "alter", "create",
            "truncate", "replace", "merge", "exec", "execute",
            "attach", "detach", "vacuum", "reindex", "analyze",
        ]
        for kw in dangerous:
            if re.search(r'\b' + re.escape(kw) + r'\b', normalized, re.IGNORECASE):
                raise SecurityError(f"Dangerous SQL keyword detected: {kw}")

        injection_patterns = [
            r'--', r'/\*.*?\*/', r';\s*\w+',
            r'\bunion\s+select\b', r'\bor\s+1\s*=\s*1\b',
        ]
        for pattern in injection_patterns:
            if re.search(pattern, normalized, re.IGNORECASE):
                raise SecurityError("Potential SQL injection pattern detected")

        if normalized.count("select") > 5:
            raise SecurityError("Too many nested subqueries")

        # ── Cache key (validation cache, not result cache) ──
        cache_key = hashlib.md5(statement.encode()).hexdigest()
        if cache_key not in self._query_cache:
            if len(self._query_cache) >= self._cache_max:
                for k in list(self._query_cache.keys())[:100]:
                    del self._query_cache[k]
            self._query_cache[cache_key] = time.time()

        # ── Execute ──
        start = time.time()
        try:
            async with self._pool.acquire() as conn:
                rows = await conn.fetch(statement)

            elapsed_ms = (time.time() - start) * 1000
            columns = list(rows[0].keys()) if rows else []

            # Serialize asyncpg-specific types that are not JSON-safe.
            # Decimal (NUMERIC columns) → float
            # datetime/date/UUID → str via their natural __str__
            import decimal, datetime, uuid as _uuid
            def _serialize(v):
                if isinstance(v, decimal.Decimal):
                    return float(v)
                if isinstance(v, (datetime.datetime, datetime.date, datetime.time)):
                    return v.isoformat()
                if isinstance(v, _uuid.UUID):
                    return str(v)
                return v

            structured = [
                {k: _serialize(v) for k, v in dict(row).items()}
                for row in rows
            ]

            # Apply the same server-side caps as the SQLite path so a large
            # result can't blow up the LLM prompt. NOTE: asyncpg's conn.fetch
            # already buffers the full result set in memory here — this cap
            # bounds the prompt payload, not PG-side memory. Bounding that
            # would need a server-side cursor (deferred, documented).
            row_truncated = len(structured) > MAX_RESULT_ROWS
            structured = structured[:MAX_RESULT_ROWS]
            structured, byte_truncated = _cap_rows_by_bytes(structured)

            logger.info(
                "PostgreSQL query executed",
                row_count=len(structured),
                execution_time_ms=round(elapsed_ms, 2),
            )

            return QueryResult(
                rows=structured,
                row_count=len(structured),
                columns=columns,
                execution_time_ms=round(elapsed_ms, 2),
                truncated=row_truncated or byte_truncated,
            )

        except (SecurityError, InvalidSQLError):
            raise
        except Exception as e:
            raise DatabaseError(f"PostgreSQL query failed: {e}")

    # ------------------------------------------------------------------
    async def get_schema(self) -> Dict[str, Any]:
        """
        Discover schema via information_schema (tables + columns).
        Returns a dict in the same shape as the SQLite schema tool.
        """
        try:
            async with self._pool.acquire() as conn:
                table_rows = await conn.fetch("""
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_type = 'BASE TABLE'
                    ORDER BY table_name
                """)

                schema: Dict[str, Any] = {
                    "tables": [],
                    "total_tables": len(table_rows),
                    "database_type": "PostgreSQL",
                    "status": "success",
                }

                for tr in table_rows:
                    table_name = tr["table_name"]
                    col_rows = await conn.fetch("""
                        SELECT column_name, data_type, is_nullable
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = $1
                        ORDER BY ordinal_position
                    """, table_name)

                    schema["tables"].append({
                        "name": table_name,
                        "columns": [
                            {
                                "name": cr["column_name"],
                                "type": cr["data_type"],
                                "nullable": cr["is_nullable"] == "YES",
                            }
                            for cr in col_rows
                        ],
                    })

            return schema

        except Exception as e:
            logger.error("Failed to fetch PostgreSQL schema", error=str(e))
            return {"error": str(e), "status": "failed"}

    # ------------------------------------------------------------------
    async def test_connection(self) -> bool:
        """Ping the database. Returns True if reachable."""
        try:
            async with self._pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            return True
        except Exception:
            return False

    # ------------------------------------------------------------------
    async def close(self) -> None:
        """Close all pooled connections gracefully."""
        await self._pool.close()
        logger.info("PostgreSQL connection pool closed")

# ===========================================================================
# Multi-tenant support — ContextVar-based pool routing
# Zero changes made to any existing code above this line.
# ===========================================================================

from contextvars import ContextVar

# Holds the Firebase UID for the current async task.
# Default "shared" routes to the shared/demo pool.
current_user_uid: ContextVar[str] = ContextVar("current_user_uid", default="shared")


class MultiTenantManager:
    """
    Manages one asyncpg pool per Firebase UID.

    Pool map:
        "shared"  → shared demo pool (used when no UID-specific pool exists)
        "<uid>"   → that user's private PostgreSQL pool

    Usage:
        # Register pools
        await db_manager.add_user_pool("shared", {...credentials...})
        await db_manager.add_user_pool("uid_abc123", {...credentials...})

        # Execute — pool selected from current_user_uid ContextVar
        result = await db_manager.execute_query("SELECT ...")

        # Schema discovery — also UID-aware
        schema = await db_manager.get_schema()
    """

    def __init__(self) -> None:
        # uid → asyncpg.Pool
        self.pools: Dict[str, Any] = {}
        # uid → PostgreSQLManager (wraps pool with validation + schema)
        self._managers: Dict[str, PostgreSQLManager] = {}
        # uid → DatabaseManager over that user's CSV-ingested SQLite file.
        # Kept separate from the Postgres pools; routing precedence is:
        #   own Postgres pool → CSV SQLite → demo SQLite.
        self._sqlite_managers: Dict[str, "DatabaseManager"] = {}
        # uid → the raw PostgreSQL credentials used to build that user's pool.
        # Stored so a DuckDB federation manager (Pro: Postgres + CSV together)
        # can re-attach the same Postgres read-only. Only ever holds a user's OWN
        # credentials (never "shared"); Firestore already persists these in
        # plaintext for MVP, so this adds no new exposure.
        self._pg_credentials: Dict[str, dict] = {}

    # ------------------------------------------------------------------
    async def add_user_pool(self, uid: str, credentials: dict) -> None:
        """
        Create and register an asyncpg pool for a given UID.

        Args:
            uid:         Firebase UID, or "shared" for the shared pool.
            credentials: kwargs forwarded to PostgreSQLManager.create():
                         host, port, database, username, password,
                         min_size (optional), max_size (optional)
        """
        try:
            import asyncpg
        except ImportError:
            raise RuntimeError("asyncpg not installed. Run: pip install asyncpg")

        # Close any existing pool for this uid before replacing it — otherwise
        # reconnecting (e.g. updated credentials) orphans the old asyncpg pool
        # with its connections still open, leaking until process restart.
        existing = self._managers.get(uid)
        if existing is not None:
            await existing.close()

        manager = await PostgreSQLManager.create(
            host=credentials["host"],
            port=credentials.get("port", 5432),
            database=credentials["database"],
            username=credentials["username"],
            password=credentials["password"],
            min_size=credentials.get("min_size", 2),
            max_size=credentials.get("max_size", 10),
        )

        self._managers[uid] = manager
        self.pools[uid] = manager._pool
        # Remember this user's own credentials for DuckDB federation. Never store
        # under "shared" — federation is only ever a user's own PG + own CSV.
        if uid != "shared":
            self._pg_credentials[uid] = {
                "host": credentials["host"],
                "port": credentials.get("port", 5432),
                "database": credentials["database"],
                "username": credentials["username"],
                "password": credentials["password"],
            }

        logger.info(
            "Multi-tenant pool registered",
            uid=uid,
            host=credentials["host"],
            database=credentials["database"],
        )

    # ------------------------------------------------------------------
    def get_manager_for_uid(self, uid: str) -> "Optional[PostgreSQLManager]":
        """
        Return the PostgreSQLManager for uid, falling back to "shared".
        Returns None if neither uid nor "shared" pool exists.
        """
        return self._managers.get(uid) or self._managers.get("shared")

    # ------------------------------------------------------------------
    def get_federation_manager_for_uid(self, uid: str):
        """
        Return a DuckDBFederationManager IFF this user has BOTH their own
        PostgreSQL credentials AND a CSV SQLite registered — i.e. the only case
        where the two must be queried together. Returns None otherwise, so every
        single-source user (Free, or Pro with just one source) falls through to
        the existing PostgreSQL / SQLite / demo routing completely unchanged.

        Constructed fresh each call (the manager is stateless and cheap).
        """
        creds = self._pg_credentials.get(uid)
        sqlite_mgr = self._sqlite_managers.get(uid)
        if creds is None or sqlite_mgr is None:
            return None
        # Imported lazily so importing this module never requires duckdb unless a
        # federated query is actually made.
        from .duckdb_federation import DuckDBFederationManager
        return DuckDBFederationManager(creds, sqlite_mgr.database_path)

    # ------------------------------------------------------------------
    # Per-user CSV-backed SQLite registry
    # ------------------------------------------------------------------
    async def register_user_csv(self, uid: str, db_path: str) -> None:
        """
        Register (or replace) the SQLite database holding this user's ingested
        CSV data. The DatabaseManager is constructed with `db_path` so its
        query validation (EXPLAIN QUERY PLAN) and execution both target the
        correct per-user file.
        """
        existing = self._sqlite_managers.get(uid)
        if existing is not None:
            # Close the previous pool before replacing so it doesn't leak.
            try:
                await existing.cleanup()
            except Exception as e:
                logger.warning("Failed to close previous CSV manager", uid=uid, error=str(e))

        self._sqlite_managers[uid] = DatabaseManager(db_path)
        logger.info("CSV SQLite manager registered", uid=uid, db_path=db_path)

    def get_sqlite_manager_for_uid(self, uid: str) -> "Optional[DatabaseManager]":
        """Return this user's CSV-backed SQLite manager, or None."""
        return self._sqlite_managers.get(uid)

    def has_user_csv(self, uid: str) -> bool:
        """True if this user has a CSV-backed SQLite database registered."""
        return uid in self._sqlite_managers

    async def remove_user_csv(self, uid: str) -> None:
        """Close and drop this user's CSV SQLite manager (on disconnect/replace)."""
        manager = self._sqlite_managers.pop(uid, None)
        if manager is not None:
            await manager.cleanup()
            logger.info("CSV SQLite manager removed", uid=uid)

    # ------------------------------------------------------------------
    async def execute_query(self, statement: str) -> "QueryResult":
        """
        Execute a validated SELECT query against the pool for the current UID.

        Reads current_user_uid from the ContextVar — no argument needed.
        Falls back to "shared" pool if no UID-specific pool exists.
        Falls back to SQLite (returns None) if no pools registered at all,
        so the caller can decide the fallback strategy.
        """
        uid = current_user_uid.get()
        manager = self.get_manager_for_uid(uid)

        if manager is None:
            raise DatabaseError(
                f"No database pool available for uid='{uid}' and no shared pool registered."
            )

        logger.debug("Multi-tenant routing", uid=uid, pool_count=len(self.pools))
        return await manager.execute_query(statement)

    # ------------------------------------------------------------------
    async def get_schema(self) -> Dict[str, Any]:
        """Schema discovery for the current UID's pool."""
        uid = current_user_uid.get()
        manager = self.get_manager_for_uid(uid)

        if manager is None:
            return {"error": f"No pool for uid='{uid}'", "status": "failed"}

        return await manager.get_schema()

    # ------------------------------------------------------------------
    def has_user_pool(self, uid: str) -> bool:
        """
        Return True if a user-specific pool is registered for this UID.
        Used by api.py to gate query execution in production.
        Does NOT count the 'shared' pool — only explicit per-user pools.
        """
        return uid in self._managers and uid != "shared"

    async def has_pool(self, uid: str) -> bool:
        """Return True if a pool exists for this UID."""
        return uid in self._managers

    # ------------------------------------------------------------------
    async def remove_user_pool(self, uid: str) -> None:
        """Close and remove a user's pool (e.g. on disconnect/logout)."""
        manager = self._managers.pop(uid, None)
        self.pools.pop(uid, None)
        self._pg_credentials.pop(uid, None)
        if manager:
            await manager.close()
            logger.info("Multi-tenant pool removed", uid=uid)

    # ------------------------------------------------------------------
    async def close_all(self) -> None:
        """Close every registered pool gracefully."""
        for uid, manager in list(self._managers.items()):
            try:
                await manager.close()
            except Exception as e:
                logger.error("Failed to close pool", uid=uid, error=str(e))
        self._managers.clear()
        self.pools.clear()
        self._pg_credentials.clear()
        logger.info("All multi-tenant pools closed")


# ---------------------------------------------------------------------------
# Module-level singleton — imported by sql.py and api.py
# ---------------------------------------------------------------------------
db_manager = MultiTenantManager()