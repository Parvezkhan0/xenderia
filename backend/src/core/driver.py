"""
FACT System Main Driver

This module implements the central orchestrator for the FACT system,
managing cache, queries, and tool execution following the architecture specification.
"""

import asyncio
import time
import os
from typing import Dict, List, Any, Optional
import structlog

# Import Anthropic SDK directly (LiteLLM has compatibility issues)
import anthropic

from .config import Config, get_config, validate_configuration
from .errors import (
    FACTError, ConfigurationError, ConnectionError, ToolExecutionError,
    classify_error, create_user_friendly_message, log_error_with_context,
    provide_graceful_degradation, CacheError
)

from ..db.connection import DatabaseManager, current_user_uid
from ..tools.decorators import get_tool_registry
from ..tools.connectors.sql import initialize_sql_tool
from ..monitoring.metrics import get_metrics_collector
from ..cache import initialize_cache_system, get_cache_system, FACTCacheSystem

logger = structlog.get_logger(__name__)

class FACTDriver:
    """
    Manages cache control, query processing, tool execution, and system coordination
    following the FACT architecture principles.
    """

    def __init__(self, config: Optional[Config] = None):
        """
        Initialize FACT driver with configuration.

        Args:
            config: Optional configuration instance (creates default if None)
        """
        self.config = config or get_config()
        self.database_manager: Optional[DatabaseManager] = None
        self.tool_registry = get_tool_registry()
        self.cache_system: Optional[FACTCacheSystem] = None
        self._initialized = False

        # Monitoring and metrics
        self.metrics_collector = get_metrics_collector()

        # Cache degradation flag
        self._cache_degraded = False

        # Per-user schema cache: user_id -> raw schema text from SQL_GetSchema
        self._schema_cache: Dict[str, str] = {}
        # Per-user system prompt cache: user_id -> fully built prompt string
        self._schema_prompt_cache: Dict[str, str] = {}
        # Lock to prevent concurrent schema fetches for the same user
        self._schema_lock = asyncio.Lock()

    async def initialize(self) -> None:
        """
        Initialize the FACT system components.

        Raises:
            ConfigurationError: If configuration is invalid
            ConnectionError: If service connections fail
        """
        if self._initialized:
            logger.info("FACT driver already initialized")
            return

        try:
            logger.info("Initializing FACT system")

            # Validate configuration
            validate_configuration(self.config)

            # Initialize database
            await self._initialize_database()

            # Initialize cache system
            await self._initialize_cache()

            # Initialize tools
            await self._initialize_tools()

            # Pre-fetch and cache schema for the default (shared/SQLite) user so
            # that the first real query already has the schema embedded in the
            # system prompt and does not need an SQL_GetSchema round-trip.
            await self._fetch_and_cache_schema("shared")

            # Test connections
            await self._test_connections()

            self._initialized = True
            logger.info("FACT system initialized successfully")

        except Exception as e:
            logger.error("FACT system initialization failed", error=str(e))
            raise ConfigurationError(f"System initialization failed: {e}")

    async def process_query(self, user_input: str, user_id: str = "shared",
                             return_cache_info: bool = False) -> Any:
        """
        Process a user query through the FACT pipeline.

        Args:
            user_input: Natural language query from user
            user_id: Identifier for the user, used to select the correct
                     schema-embedded system prompt and Anthropic cache prefix.
                     Defaults to "shared" (the built-in SQLite demo database).
            return_cache_info: If True, return a (response_text, is_cache_hit)
                     tuple where is_cache_hit reflects the real cache system
                     result — not a latency guess. Defaults to False so every
                     existing caller (CLI, tests, benchmarking, main.py) keeps
                     getting a plain string with zero behavior change.

        Returns:
            Generated response string, or (response string, is_cache_hit)
            tuple when return_cache_info=True.

        Raises:
            FACTError: If query processing fails
        """
        if not self._initialized:
            await self.initialize()

        query_id = f"query_{int(time.time() * 1000)}"
        start_time = time.time()

        # Set the ContextVar so all tool calls route to the correct per-user DB pool.
        current_user_uid.set(user_id)

        # Ensure this user's schema is loaded before the first LLM call.
        # This is a no-op if the schema was already fetched (e.g. at init time
        # or when the user connected their database via set_user_schema / the
        # API's /database/connect endpoint).
        if user_id not in self._schema_prompt_cache:
            await self._fetch_and_cache_schema(user_id)

        try:
            logger.info("Processing user query", query_id=query_id,
                        user_id=user_id, query=user_input[:100])

            # Step 1: Check cache first (cache-first pattern)
            # Cache key is scoped to the user so responses never bleed across tenants.
            user_scoped_input = f"{user_id}:{user_input}"
            cached_response = None
            if not self._cache_degraded and self.cache_system:
                try:
                    cached_response = await self.cache_system.get_cached_response(user_scoped_input)
                except Exception as e:
                    logger.warning("Cache lookup failed - continuing without cache",
                                   query_id=query_id,
                                   error=str(e))

            if cached_response:
                end_time = time.time()
                latency = (end_time - start_time) * 1000
                logger.info("Cache hit - returning cached response",
                            query_id=query_id,
                            latency_ms=latency)
                return (cached_response, True) if return_cache_info else cached_response

            # Step 2: Cache miss - process query normally
            logger.info("Cache miss - processing query with LLM", query_id=query_id)

            # Prepare messages for LLM
            messages = [
                {
                    "role": "user",
                    "content": user_input
                }
            ]

            # Get tool schemas for LLM
            tool_schemas = self.tool_registry.export_all_schemas()

            # Make initial LLM call with cache control
            response = await self._call_llm_with_cache(
                messages=messages,
                tools=tool_schemas,
                cache_mode="read",
                user_id=user_id
            )

            # Handle tool calls if present (Anthropic format)
            tool_use_blocks = []
            if hasattr(response, 'content') and response.content:
                for block in response.content:
                    if hasattr(block, 'type') and block.type == 'tool_use':
                        tool_use_blocks.append(block)

            def blocks_to_dicts(blocks) -> list:
                """Convert _Block objects to plain dicts for JSON serialization."""
                result = []
                for b in blocks:
                    if isinstance(b, dict):
                        result.append(b)
                        continue
                    d = {"type": b.type}
                    if b.type == "text":
                        d["text"] = b.text
                    elif b.type == "tool_use":
                        d["id"] = b.id
                        d["name"] = b.name
                        d["input"] = b.input
                    result.append(d)
                return result

            if tool_use_blocks:
                logger.info("Processing tool calls", count=len(tool_use_blocks))

                # Add assistant message with tool_use blocks to conversation
                assistant_message = {
                    "role": "assistant",
                    "content": blocks_to_dicts(response.content)
                }
                messages.append(assistant_message)

                # Execute tool calls
                tool_results = await self._execute_tool_calls(tool_use_blocks)

                # Add tool results to message history
                messages.extend(tool_results)

                # Get final response with tool results
                response = await self._call_llm_with_cache(
                    messages=messages,
                    tools=tool_schemas,
                    cache_mode="read",
                    user_id=user_id
                )

                # Check if the final response also has tool calls
                final_tool_blocks = []
                if hasattr(response, 'content') and response.content:
                    for block in response.content:
                        if hasattr(block, 'type') and block.type == 'tool_use':
                            final_tool_blocks.append(block)

                # Execute any final tool calls and continue until we get text response
                max_iterations = 5  # Prevent infinite loops
                iteration = 0

                while final_tool_blocks and iteration < max_iterations:
                    logger.info("Processing final tool calls", count=len(final_tool_blocks), iteration=iteration)

                    # Add assistant message with tool_use blocks
                    assistant_message = {
                        "role": "assistant",
                        "content": blocks_to_dicts(response.content)
                    }
                    messages.append(assistant_message)

                    # Execute final tool calls
                    final_tool_results = await self._execute_tool_calls(final_tool_blocks)

                    # Add final tool results
                    messages.extend(final_tool_results)

                    # Get final response
                    response = await self._call_llm_with_cache(
                        messages=messages,
                        tools=tool_schemas,
                        cache_mode="read",
                        user_id=user_id
                    )

                    # Check if this response also has tool calls
                    final_tool_blocks = []
                    if hasattr(response, 'content') and response.content:
                        for block in response.content:
                            if hasattr(block, 'type') and block.type == 'tool_use':
                                final_tool_blocks.append(block)

                    iteration += 1

            # Extract response content from Anthropic SDK response
            response_text = ""
            if hasattr(response, 'content') and response.content:
                for block in response.content:
                    if hasattr(block, 'type') and block.type == 'text':
                        response_text += block.text

            # If no text content found, provide informative message
            if not response_text:
                logger.warning("No text response received from LLM", query_id=query_id)
                response_text = "I apologize, but I was unable to generate a proper response. Please try rephrasing your question."

            # Step 3: Store response in cache for future use (scoped by user)
            if not self._cache_degraded and self.cache_system and response_text:
                try:
                    cache_stored = await self.cache_system.store_response(user_scoped_input, response_text)
                    if cache_stored:
                        logger.debug("Response stored in cache", query_id=query_id)
                    else:
                        logger.debug("Response not suitable for caching", query_id=query_id)
                except Exception as e:
                    logger.warning("Cache storage failed - continuing without cache storage",
                                   query_id=query_id,
                                   error=str(e))

            # Log performance metrics
            end_time = time.time()
            latency = (end_time - start_time) * 1000

            logger.info("Query processed successfully",
                        query_id=query_id,
                        latency_ms=latency,
                        response_length=len(response_text))

            return (response_text, False) if return_cache_info else response_text

        except Exception as e:
            end_time = time.time()
            latency = (end_time - start_time) * 1000

            # Record error in metrics collector
            self.metrics_collector.record_tool_execution(
                tool_name="fact_query",
                success=False,
                execution_time=latency,
                error_type=type(e).__name__,
                metadata={"query_id": query_id}
            )

            # Log error with context
            log_error_with_context(e, {
                "query_id": query_id,
                "user_input": user_input[:100],
                "latency_ms": latency
            })

            # Handle error with graceful degradation
            error_category = classify_error(e)

            # Error responses are never real cache hits — always report False
            # so a failed/degraded query never gets billed as a free hit.
            if error_category in ["connectivity", "tool_execution"]:
                degraded = provide_graceful_degradation(error_category)
                return (degraded, False) if return_cache_info else degraded
            else:
                msg = create_user_friendly_message(e)
                return (msg, False) if return_cache_info else msg

    async def _fetch_and_cache_schema(self, user_id: str) -> None:
        """
        Retrieve the database schema once via SQL_GetSchema and build a
        schema-embedded system prompt that is stored in memory for this user.

        This is called automatically at startup (for "shared") and lazily on
        the first query for any other user_id.  It is a no-op if the schema
        has already been fetched for this user.

        SQL_GetSchema remains available as a tool — the LLM can still call it
        explicitly if it needs to verify column details.

        Args:
            user_id: Identifier for the user / database connection.
        """
        # Guard: already fetched
        if user_id in self._schema_prompt_cache:
            return

        async with self._schema_lock:
            # Double-checked locking: another coroutine may have fetched while
            # we were waiting for the lock.
            if user_id in self._schema_prompt_cache:
                return

            try:
                # Ensure the ContextVar is set so schema fetch also routes
                # to the correct per-user pool (not the SQLite fallback).
                current_user_uid.set(user_id)

                schema_tool = self.tool_registry.get_tool("SQL_GetSchema")
                if asyncio.iscoroutinefunction(schema_tool.function):
                    schema_result = await schema_tool.function()
                else:
                    schema_result = schema_tool.function()

                # SQL_GetSchema returns either a string or a dict with the
                # schema inside.  Normalise to a plain string.
                if isinstance(schema_result, dict):
                    schema_text = schema_result.get("schema", str(schema_result))
                else:
                    schema_text = str(schema_result)

                self._schema_cache[user_id] = schema_text
                self._schema_prompt_cache[user_id] = self._build_schema_prompt(schema_text)

                logger.info("Schema fetched and cached for user",
                            user_id=user_id,
                            schema_length=len(schema_text))

            except Exception as e:
                # Non-fatal: fall back to the config default prompt.
                logger.warning("Could not fetch schema for user — using default system prompt",
                               user_id=user_id, error=str(e))

    def _build_schema_prompt(self, user_schema: str) -> str:
        """
        Construct the schema-embedded system prompt that will be sent to the
        Anthropic API with prompt caching enabled.

        Anthropic requires the cached content block to be at least 1024 tokens.
        The detailed instructions below ensure we clear that threshold even for
        small schemas, while also giving the LLM everything it needs to answer
        financial queries without an extra SQL_GetSchema round-trip.

        Args:
            user_schema: Raw schema text returned by SQL_GetSchema.

        Returns:
            Complete system prompt string with schema embedded.
        """
        return (
            "You are a financial SQL assistant with direct access to a relational "
            "database. Your job is to answer user questions about financial data by "
            "writing and executing precise SQL SELECT queries.\n\n"

            "## Database Schema\n\n"
            "The complete schema for the connected database is provided below. "
            "You must use ONLY the tables and columns listed here — do not invent "
            "or assume the existence of any table or column that does not appear.\n\n"
            f"{user_schema}\n\n"

            "## Query Instructions\n\n"
            "When a user asks a financial question:\n"
            "1. Identify the relevant tables and columns from the schema above.\n"
            "2. Construct a valid SELECT query using exact table and column names.\n"
            "3. Call SQL_QueryReadonly with that query.\n"
            "4. Present the results clearly, including relevant labels and units.\n\n"
            "You do NOT need to call SQL_GetSchema — the schema is already embedded "
            "in this prompt. Calling SQL_GetSchema wastes a round-trip; skip it and "
            "go directly to SQL_QueryReadonly.\n\n"

            "## SQL Rules\n\n"
            "- Only generate SELECT statements. Never use INSERT, UPDATE, DELETE, "
            "DROP, CREATE, ALTER, TRUNCATE, or any DDL/DML statement.\n"
            "- Use the exact table and column names shown in the schema. SQL is "
            "case-sensitive for identifiers in some databases.\n"
            "- Qualify ambiguous column names with their table name or alias "
            "(e.g. orders.total instead of just total).\n"
            "- Use JOINs when data from multiple tables is needed; prefer explicit "
            "JOIN syntax over implicit comma joins.\n"
            "- Apply WHERE clauses to filter to only the data the user asked about.\n"
            "- Use GROUP BY and aggregate functions (SUM, AVG, COUNT, MAX, MIN) for "
            "summary questions.\n"
            "- Order results meaningfully (e.g. ORDER BY period DESC for time series).\n"
            "- Limit result sets to a sensible number of rows when the user has not "
            "specified a limit and the query could return a very large set "
            "(e.g. LIMIT 100).\n"
            "- If a question cannot be answered from the available schema, say so "
            "clearly and explain which information is missing.\n\n"

            "## Common Financial Query Patterns\n\n"
            "Use the patterns below as a guide when constructing queries. Adapt "
            "table and column names to match the actual schema above.\n\n"
            "Period revenue lookup:\n"
            "  SELECT period, revenue FROM financial_records\n"
            "  WHERE period = '<period>' ORDER BY period DESC;\n\n"
            "Year-over-year comparison:\n"
            "  SELECT period, revenue,\n"
            "         LAG(revenue) OVER (ORDER BY period) AS prev_revenue,\n"
            "         ROUND((revenue - LAG(revenue) OVER (ORDER BY period))\n"
            "               / LAG(revenue) OVER (ORDER BY period) * 100, 2) AS yoy_pct\n"
            "  FROM financial_records ORDER BY period;\n\n"
            "Quarterly summary with totals:\n"
            "  SELECT quarter, year, SUM(revenue) AS total_revenue,\n"
            "         SUM(net_income) AS total_net_income\n"
            "  FROM financial_records\n"
            "  GROUP BY year, quarter ORDER BY year DESC, quarter DESC;\n\n"
            "Top N by metric:\n"
            "  SELECT company_name, revenue\n"
            "  FROM financial_records\n"
            "  ORDER BY revenue DESC LIMIT 10;\n\n"
            "Growth rate calculation:\n"
            "  SELECT period,\n"
            "         ROUND((revenue - prev_rev) / prev_rev * 100, 2) AS growth_pct\n"
            "  FROM (\n"
            "    SELECT period, revenue,\n"
            "           LAG(revenue) OVER (ORDER BY period) AS prev_rev\n"
            "    FROM financial_records\n"
            "  ) sub WHERE prev_rev IS NOT NULL;\n\n"

            "## Error Handling\n\n"
            "If SQL_QueryReadonly returns an error:\n"
            "- Read the error message carefully before retrying.\n"
            "- Check that every column and table name exactly matches the schema.\n"
            "- Verify JOIN conditions reference the correct foreign key columns.\n"
            "- Simplify the query and re-run if a complex query fails.\n"
            "- If the error persists, report it to the user with a plain-language "
            "explanation of what went wrong.\n\n"

            "## Response Format\n\n"
            "- Always include the metric name and unit in your answer "
            "(e.g. 'Q1-2025 revenue: $1,234,567').\n"
            "- For single-value results, state the value with its context.\n"
            "- For multi-row results, present data as a concise Markdown table.\n"
            "- Round currency values to two decimal places.\n"
            "- Express percentages to two decimal places followed by the %% sign.\n"
            "- Do not repeat filler text or restate the question verbatim.\n"
            "- Do not show raw SQL to the user unless they explicitly ask for it.\n"
        )

    def _get_system_prompt(self, user_id: str) -> str:
        """
        Return the schema-embedded system prompt for *user_id* if available,
        otherwise fall back to the static prompt from config.

        Args:
            user_id: User identifier.

        Returns:
            System prompt string.
        """
        return self._schema_prompt_cache.get(user_id, self.config.system_prompt)

    def set_user_schema(self, user_id: str, schema_text: str) -> None:
        """
        Store a schema retrieved externally (e.g. after a user connects their
        own PostgreSQL database via the API) and immediately build the cached
        system prompt for that user.

        This avoids the lazy-fetch on the first query and means the schema is
        ready the moment the user starts querying.

        Args:
            user_id: Identifier for the user (matches X-Firebase-UID header).
            schema_text: Raw schema text (e.g. from SQL_GetSchema or introspection).
        """
        self._schema_cache[user_id] = schema_text
        self._schema_prompt_cache[user_id] = self._build_schema_prompt(schema_text)
        logger.info("User schema set and prompt cached",
                    user_id=user_id, schema_length=len(schema_text))

    async def _initialize_database(self) -> None:
        """Initialize database connection and schema."""
        try:
            self.database_manager = DatabaseManager(self.config.database_path)
            await self.database_manager.initialize_database()
            logger.info("Database initialized successfully")

        except Exception as e:
            logger.error("Database initialization failed", error=str(e))
            raise ConfigurationError(f"Database initialization failed: {e}")

    async def _initialize_cache(self) -> None:
        """Initialize cache system."""
        try:
            cache_config = self.config.cache_config

            # Initialize base cache system
            self.cache_system = await initialize_cache_system(
                config=cache_config,
                enable_background_tasks=True
            )

            logger.info("Cache system initialized successfully",
                        prefix=cache_config["prefix"],
                        max_size=cache_config["max_size"])

        except Exception as e:
            logger.error("Cache system initialization failed", error=str(e))
            # Enable graceful degradation - continue without cache
            self._cache_degraded = True
            logger.warning("Continuing with cache degradation mode")

    async def _initialize_tools(self) -> None:
        """Initialize and register system tools."""
        try:
            # Initialize SQL tool with database manager
            initialize_sql_tool(self.database_manager)

            # Log registered tools
            tool_info = self.tool_registry.get_tool_info()
            logger.info("Tools initialized", **tool_info)

        except Exception as e:
            logger.error("Tool initialization failed", error=str(e))
            raise ConfigurationError(f"Tool initialization failed: {e}")

    async def _test_connections(self) -> None:
        """Test connections to external services."""
        # Skip API validation if configured for testing
        if os.getenv("SKIP_API_VALIDATION", "false").lower() == "true":
            logger.info("Skipping API validation for testing environment")
            return

        try:
            # Test database connection
            if self.database_manager:
                await self.database_manager.get_database_info()
                logger.info("Database connection test passed")

            # Test LLM connection via raw httpx (avoids SDK Pydantic issues)
            import httpx as _httpx, json as _json
            with _httpx.Client(timeout=10) as http:
                test_resp = http.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": self.config.anthropic_api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    content=_json.dumps({
                        "model": self.config.claude_model,
                        "messages": [{"role": "user", "content": "Test"}],
                        "max_tokens": 10,
                    }),
                )
            if test_resp.status_code == 200:
                logger.info("LLM connection test passed")
            else:
                raise ConnectionError(f"Error code: {test_resp.status_code} - {test_resp.text}")

        except Exception as e:
            # Connection test is not fatal - log warning but continue startup
            # Actual queries will fail if API key or network is truly unavailable
            logger.warning("Connection test failed (non-fatal)", error=str(e))
            logger.warning("Application will start, but first query may fail if API is unreachable")

    async def _call_llm_with_cache(self,
                                   messages: List[Dict[str, Any]],
                                   tools: List[Dict[str, Any]],
                                   cache_mode: str = "read",
                                   user_id: str = "shared") -> Any:
        """
        Call LLM with cache control and tool support.

        Args:
            messages: Message history for LLM
            tools: Available tools for LLM
            cache_mode: Cache mode ('read' or 'write')
            user_id: User identifier used to select the schema-embedded system
                     prompt and the Anthropic prompt-cache prefix.

        Returns:
            LLM response object
        """
        try:
            import json as _json
            import httpx

            # Allowed JSON Schema property keys for Anthropic API
            ALLOWED_PROP_KEYS = {"type", "description", "enum", "default",
                                 "items", "properties", "required", "anyOf", "oneOf"}

            def sanitize_tool(t: dict) -> dict:
                t = dict(t)
                if "input_schema" in t and isinstance(t["input_schema"], dict):
                    schema = dict(t["input_schema"])
                    if "properties" in schema and isinstance(schema["properties"], dict):
                        schema["properties"] = {
                            k: {ik: iv for ik, iv in v.items() if ik in ALLOWED_PROP_KEYS}
                            if isinstance(v, dict) else v
                            for k, v in schema["properties"].items()
                        }
                    t["input_schema"] = schema
                return t

            sanitized_tools = [sanitize_tool(t) for t in tools] if tools else None

            # Build the system prompt: use the schema-embedded version for this
            # user when available, falling back to the config default.
            system_prompt_text = self._get_system_prompt(user_id)

            # The Anthropic API accepts `system` as either a plain string or a
            # list of content blocks.  We use the block form so we can attach
            # `cache_control` to instruct the API to cache (and reuse) the
            # schema-heavy system prompt.
            # NOTE: Anthropic native prompt caching only accepts {"type": "ephemeral"}.
            # No "prefix" field is permitted — the cache is keyed on the content itself.
            system_payload = [
                {
                    "type": "text",
                    "text": system_prompt_text,
                    "cache_control": {"type": "ephemeral"}
                }
            ]

            # Build raw request payload - bypasses SDK Pydantic layer entirely
            payload: Dict[str, Any] = {
                "model": self.config.claude_model,
                "system": system_payload,
                "messages": messages,
                "max_tokens": 4096,
            }
            if sanitized_tools:
                payload["tools"] = sanitized_tools
                payload["tool_choice"] = {"type": "auto"}

            # Call Anthropic API directly via httpx
            with httpx.Client(timeout=self.config.request_timeout) as http:
                resp = http.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": self.config.anthropic_api_key,
                        "anthropic-version": "2023-06-01",
                        "anthropic-beta": "prompt-caching-2024-07-31",
                        "content-type": "application/json",
                    },
                    content=_json.dumps(payload),
                )

            if resp.status_code != 200:
                raise ConnectionError(f"Anthropic API error {resp.status_code}: {resp.text}")

            data = resp.json()

            # Wrap raw response in a simple object that mimics the SDK response
            class _Block:
                def __init__(self, b):
                    self.type = b.get("type")
                    self.text = b.get("text", "")
                    self.id = b.get("id", "")
                    self.name = b.get("name", "")
                    self.input = b.get("input", {})

            class _Response:
                def __init__(self, d):
                    self.content = [_Block(b) for b in d.get("content", [])]
                    self.stop_reason = d.get("stop_reason")
                    self.model = d.get("model")

            return _Response(data)

        except Exception as e:
            logger.error("LLM call failed", error=str(e), cache_mode=cache_mode)
            raise ConnectionError(f"LLM call failed: {e}")

    async def _execute_tool_calls(self, tool_calls: List[Any]) -> List[Dict[str, Any]]:
        """
        Execute tool calls and format results as messages.

        Args:
            tool_calls: List of tool calls from LLM

        Returns:
            List of tool result messages
        """
        tool_messages = []

        for call in tool_calls:
            try:
                # Extract tool information (Anthropic format)
                tool_name = call.name
                tool_args = call.input

                # tool_args should already be a dict in Anthropic format
                if isinstance(tool_args, str):
                    import json
                    tool_args = json.loads(tool_args)

                # Get tool definition
                tool_definition = self.tool_registry.get_tool(tool_name)

                # Execute tool with proper async handling
                if asyncio.iscoroutinefunction(tool_definition.function):
                    result = await tool_definition.function(**tool_args)
                else:
                    result = tool_definition.function(**tool_args)

                # Format as tool message (Anthropic format).
                # For SQL error responses (status == "failed"), send only the
                # sanitized "error" field — not the full result dict — so the
                # LLM receives a short, actionable message and the conversation
                # context does not grow with query IDs, timing data, etc.
                if isinstance(result, dict) and result.get("status") == "failed":
                    tool_content = result.get("error", "Error: query failed.")
                else:
                    tool_content = str(result) if not isinstance(result, str) else result

                tool_message = {
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": call.id,
                            "content": tool_content
                        }
                    ]
                }

                logger.info("Tool executed successfully",
                            tool_name=tool_name,
                            execution_time=result.get("execution_time_ms", 0))
                self.metrics_collector.record_tool_execution(
                    tool_name=tool_name,
                    success=True,
                    execution_time=result.get("execution_time_ms", 0),
                    metadata={"args": tool_args}
                )

            except Exception as e:
                logger.error("Tool execution failed",
                             tool_name=tool_name,
                             error=str(e))
                self.metrics_collector.record_tool_execution(
                    tool_name=tool_name,
                    success=False,
                    execution_time=0,
                    error_type=str(e),
                    metadata={"args": tool_args}
                )

                # Format error as tool message (Anthropic format).
                # Keep the content short — just a single terse line so the LLM
                # can retry without accumulating large error blocks in context.
                tool_message = {
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": call.id,
                            "content": f"Error: tool '{tool_name}' failed — {str(e)[:80]}"
                        }
                    ]
                }

            tool_messages.append(tool_message)

        return tool_messages

    def get_metrics(self) -> Dict[str, Any]:
        """
        Get system performance metrics.

        Returns:
            Dictionary containing performance metrics
        """
        sys_metrics = self.metrics_collector.get_system_metrics()

        # Get cache metrics
        cache_metrics = {}
        if not self._cache_degraded and self.cache_system:
            try:
                basic_cache_metrics = self.cache_system.cache_manager.get_metrics()
                cache_metrics = {
                    "cache_hit_rate": basic_cache_metrics.hit_rate,
                    "cache_hits": basic_cache_metrics.cache_hits,
                    "cache_misses": basic_cache_metrics.cache_misses,
                    "cache_total_entries": basic_cache_metrics.total_entries,
                    "cache_total_size": basic_cache_metrics.total_size,
                    "cache_token_efficiency": basic_cache_metrics.token_efficiency,
                }
            except Exception as e:
                logger.warning("Failed to get cache metrics", error=str(e))
                cache_metrics = {
                    "cache_hit_rate": 0,
                    "cache_hits": 0,
                    "cache_misses": 0,
                }
        else:
            cache_metrics = {
                "cache_hit_rate": 0,
                "cache_hits": 0,
                "cache_misses": 0,
                "cache_degraded": True,
            }

        return {
            "total_queries": sys_metrics.total_executions,
            "tool_executions": sys_metrics.total_executions,
            "error_rate": sys_metrics.error_rate,
            "initialized": self._initialized,
            **cache_metrics
        }

    async def shutdown(self) -> None:
        """Gracefully shutdown the FACT system."""
        logger.info("Shutting down FACT system")

        # Shutdown cache system
        if self.cache_system:
            await self.cache_system.shutdown()
            self.cache_system = None

        # Close database connections
        if self.database_manager:
            # Database manager handles its own cleanup
            pass

        self._initialized = False
        self._cache_degraded = False
        logger.info("FACT system shutdown complete")


# Global driver instance
_driver_instance: Optional[FACTDriver] = None


async def get_driver(config: Optional[Config] = None) -> FACTDriver:
    """
    Get or create the global FACT driver instance.

    Args:
        config: Optional configuration (only used for first creation)

    Returns:
        Initialized FACTDriver instance
    """
    global _driver_instance

    if _driver_instance is None:
        _driver_instance = FACTDriver(config)
        await _driver_instance.initialize()

    return _driver_instance


async def shutdown_driver() -> None:
    """Shutdown the global driver instance."""
    global _driver_instance

    if _driver_instance:
        await _driver_instance.shutdown()
        _driver_instance = None


async def process_user_query(query: str) -> str:
    """
    Process user query using the global driver instance.

    This is a compatibility wrapper for the benchmarking framework.

    Args:
        query: User query string

    Returns:
        Response string
    """
    driver = await get_driver()
    return await driver.process_query(query)