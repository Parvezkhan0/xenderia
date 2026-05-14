# #!/usr/bin/env python3
# """
# FACT System REST API
# FastAPI wrapper around the FACT driver for frontend dashboard communication.

# Run with:
#     uvicorn api:app --reload --port 8000
# """

# import json
# import time
# import sys
# import os
# import uuid
# import re
# import traceback
# import smtplib
# from email.mime.text import MIMEText
# from email.mime.multipart import MIMEMultipart
# from pathlib import Path
# from contextlib import asynccontextmanager
# from typing import Optional, List

# from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Query
# from fastapi.responses import JSONResponse
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel
# from slowapi.errors import RateLimitExceeded
# from slowapi import _rate_limit_exceeded_handler
# from slowapi.middleware import SlowAPIMiddleware
# from src.core.rate_limiter import limiter, get_dynamic_limit

# sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

# from src.core.config import get_config
# from src.core.driver import get_driver
# from src.db.connection import current_user_uid, db_manager, PostgreSQLManager
# from src.security.auth import verify_firebase_token
# from src.core.errors import AuthenticationError, DatabaseError, SecurityError
# from src.tools.connectors.excel import initialize_excel_tool, get_excel_tool

# # ── Billing / Firestore helpers ────────────────────────────────────────────
# from billing import (
#     init_billing_db,
#     get_user_plan,
#     get_plan_limits,
#     get_monthly_usage,
#     increment_usage,
#     verify_razorpay_signature,
#     handle_razorpay_webhook,
#     save_user_db_connection,
#     get_user_db_connection,
#     save_user_query_history,
#     get_user_query_history,
# )

# _RZ_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
# _RZ_CHECKOUT_URL   = os.getenv("RAZORPAY_CHECKOUT_URL", "/pricing")
# # ───────────────────────────────────────────────────────────────────────────


# # ---------------------------------------------------------------------------
# # App state
# # ---------------------------------------------------------------------------
# driver = None
# start_time = time.time()
# query_count = 0
# cache_hit_count = 0
# total_latency_ms = 0.0


# # ---------------------------------------------------------------------------
# # File storage
# # ---------------------------------------------------------------------------
# BASE_DIR = Path(__file__).resolve().parent
# EXCEL_UPLOAD_ROOT = BASE_DIR / "uploads" / "excel"


# # ---------------------------------------------------------------------------
# # Lifespan
# # ---------------------------------------------------------------------------
# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     global driver
#     config = get_config()
#     driver = await get_driver(config)
#     initialize_excel_tool()
#     EXCEL_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
#     init_billing_db()
#     print("✅ FACT driver initialized — API ready")
#     print("✅ Excel tool initialized — upload API ready")
#     print("✅ Billing DB initialized")
#     yield
#     print("👋 FACT API shutting down")


# # ---------------------------------------------------------------------------
# # App
# # ---------------------------------------------------------------------------
# app = FastAPI(
#     title="FACT API",
#     description="REST API for the FACT financial data query system",
#     version="1.0.0",
#     lifespan=lifespan,
# )

# app.state.limiter = limiter
# app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
# app.add_middleware(SlowAPIMiddleware)

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=[
#         "http://localhost:3000",
#         "https://your-production-domain.com",
#     ],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )


# # ---------------------------------------------------------------------------
# # Models
# # ---------------------------------------------------------------------------
# class QueryRequest(BaseModel):
#     query: str


# class QueryResponse(BaseModel):
#     answer: str
#     cache_hit: bool
#     latency_ms: float
#     query_id: str


# class QueryHistoryItemResponse(BaseModel):
#     query_id: str
#     query: str
#     answer: str
#     cache_hit: bool
#     latency_ms: float
#     created_at: str


# class QueryHistoryResponse(BaseModel):
#     items: List[QueryHistoryItemResponse]


# class HealthResponse(BaseModel):
#     status: str
#     uptime_seconds: float
#     driver_ready: bool


# class MetricsResponse(BaseModel):
#     total_queries: int
#     cache_hit_rate: float
#     avg_latency_ms: float
#     uptime_seconds: float


# class CacheStatusResponse(BaseModel):
#     status: str
#     hit_count: int
#     total_queries: int
#     hit_rate: float


# class ExcelUploadResponse(BaseModel):
#     success: bool
#     message: str
#     file_path: str
#     file_name: str


# class ExcelOverviewRequest(BaseModel):
#     file_path: str


# class ExcelPreviewRequest(BaseModel):
#     file_path: str
#     sheet_name: str
#     max_rows: int = 20


# class DatabaseConnectRequest(BaseModel):
#     db_type: str
#     host: str
#     port: int
#     database: str
#     username: str
#     password: str


# class DatabaseTestResponse(BaseModel):
#     success: bool
#     message: str


# class DatabaseConnectResponse(BaseModel):
#     success: bool
#     message: str


# class DatabaseStatusResponse(BaseModel):
#     connected: bool
#     uses_demo: bool
#     db_type: Optional[str] = None
#     host: Optional[str] = None
#     port: Optional[int] = None
#     database: Optional[str] = None
#     username: Optional[str] = None
#     message: str


# class EntitlementsResponse(BaseModel):
#     plan: str  # 'free' or 'pro'
#     queries_this_month: int
#     queries_limit: int
#     features: dict


# # ── Billing Models ─────────────────────────────────────────────────────────
# class RazorpayOrderResponse(BaseModel):
#     order_id: str
#     amount: int
#     currency: str


# class PaymentSuccessResponse(BaseModel):
#     status: str
#     uid: str


# class ContactRequest(BaseModel):
#     name: str
#     email: str
#     message: str
# # ───────────────────────────────────────────────────────────────────────────


# # ---------------------------------------------------------------------------
# # Routes
# # ---------------------------------------------------------------------------
# @app.get("/api/v1/health", response_model=HealthResponse)
# async def health():
#     return HealthResponse(
#         status="ok" if driver is not None else "down",
#         uptime_seconds=round(time.time() - start_time, 1),
#         driver_ready=driver is not None,
#     )


# # ---------------------------------------------------------------------------
# # Internal helpers
# # ---------------------------------------------------------------------------
# def _resolve_uid_from_request(request: Request, require_auth_in_production: bool = True) -> str:
#     is_production = os.getenv("ENVIRONMENT", "development") == "production"
#     auth_header = request.headers.get("Authorization", "")
#     bearer_token = auth_header.removeprefix("Bearer ").strip() if auth_header.startswith("Bearer ") else ""

#     if bearer_token:
#         try:
#             return verify_firebase_token(bearer_token)
#         except AuthenticationError as e:
#             raise HTTPException(status_code=401, detail=str(e))
#     elif is_production and require_auth_in_production:
#         raise HTTPException(status_code=401, detail="Authorization header required.")
#     else:
#         return "shared"


# def _sanitize_filename(filename: str) -> str:
#     cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", filename).strip("._")
#     return cleaned[:200] or "file"


# def _ensure_excel_path_allowed(file_path: str, uid: str) -> Path:
#     requested = Path(file_path).resolve()
#     allowed_root = (EXCEL_UPLOAD_ROOT / uid).resolve()
#     if not str(requested).startswith(str(allowed_root)):
#         raise SecurityError(f"Access denied to file path: {file_path}")
#     if not requested.exists():
#         raise DatabaseError(f"File not found: {file_path}")
#     return requested


# def _validate_excel_upload(file: UploadFile) -> None:
#     if not file.filename:
#         raise HTTPException(status_code=400, detail="Filename is required.")
#     name_lower = file.filename.lower()
#     if not (name_lower.endswith('.xlsx') or name_lower.endswith('.xls') or name_lower.endswith('.csv')):
#         raise HTTPException(status_code=400, detail="Only .xlsx, .xls, and .csv files are supported.")


# def _clear_user_schema_cache(uid: str) -> None:
#     global driver
#     if driver is not None:
#         driver._schema_cache.pop(uid, None)
#         driver._schema_prompt_cache.pop(uid, None)


# async def _restore_saved_user_pool(uid: str) -> Optional[dict]:
#     """
#     Restore a saved PostgreSQL connection from Firestore into the in-memory pool map.
#     Returns saved config if present and restored successfully, else None.
#     """
#     saved = get_user_db_connection(uid)
#     if not saved:
#         return None

#     if not db_manager.has_user_pool(uid):
#         await db_manager.add_user_pool(uid, {
#             "host": saved["host"],
#             "port": saved.get("port", 5432),
#             "database": saved["database"],
#             "username": saved["username"],
#             "password": saved["password"],
#         })
#         _clear_user_schema_cache(uid)

#     return saved


# # ---------------------------------------------------------------------------
# # Query endpoint — with billing check + history save
# # ---------------------------------------------------------------------------
# @app.post("/api/v1/query", response_model=QueryResponse)
# @limiter.limit(get_dynamic_limit)
# async def query(request: Request, body: QueryRequest):
#     global query_count, cache_hit_count, total_latency_ms

#     if not driver:
#         raise HTTPException(status_code=503, detail="FACT driver not ready")

#     uid = _resolve_uid_from_request(request, require_auth_in_production=False)

#     # ── BILLING: Check monthly quota ───────────────────────────────────────
#     plan   = get_user_plan(uid)
#     limits = get_plan_limits(plan)
#     usage  = get_monthly_usage(uid)

#     if usage >= limits["queries_per_month"]:
#         raise HTTPException(
#             status_code=402,
#             detail={
#                 "error": "QUOTA_EXCEEDED",
#                 "message": f"Monthly query limit ({limits['queries_per_month']}) exceeded. Upgrade to Pro.",
#                 "plan": plan,
#                 "queries_used": usage,
#                 "queries_limit": limits["queries_per_month"],
#                 "upgrade_url": _RZ_CHECKOUT_URL,
#             },
#         )
#     # ─────────────────────────────────────────────────────────────────────

#     query_id = f"q_{uuid.uuid4().hex}"
#     t_start = time.time()

#     try:
#         response = await driver.process_query(body.query, user_id=uid)
#         latency_ms = round((time.time() - t_start) * 1000, 2)
#         is_cache_hit = latency_ms < 50

#         # Only count cache misses against quota
#         if not is_cache_hit and uid != "shared":
#             increment_usage(uid)

#         # Update metrics
#         query_count += 1
#         if is_cache_hit:
#             cache_hit_count += 1
#         total_latency_ms += latency_ms

#         # Save query history for logged-in users only
#         if uid != "shared":
#             try:
#                 save_user_query_history(
#                     user_id=uid,
#                     query_id=query_id,
#                     query=body.query,
#                     answer=str(response),
#                     cache_hit=is_cache_hit,
#                     latency_ms=round(latency_ms, 2),
#                 )
#             except Exception as history_error:
#                 print(f"⚠️ Failed to save query history for uid={uid}: {history_error}")

#         return QueryResponse(
#             answer=str(response),
#             cache_hit=is_cache_hit,
#             latency_ms=round(latency_ms, 2),
#             query_id=query_id,
#         )
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


# # ---------------------------------------------------------------------------
# # Query history endpoint
# # ---------------------------------------------------------------------------
# @app.get("/api/v1/query/history", response_model=QueryHistoryResponse)
# @limiter.limit("30/minute")
# async def get_query_history(
#     request: Request,
#     limit: int = Query(default=50, ge=1, le=100),
# ):
#     uid = _resolve_uid_from_request(request, require_auth_in_production=False)

#     if uid == "shared":
#         return QueryHistoryResponse(items=[])

#     try:
#         records = get_user_query_history(uid, limit=limit)
#         items = [
#             QueryHistoryItemResponse(
#                 query_id=item.get("query_id", ""),
#                 query=item.get("query", ""),
#                 answer=item.get("answer", ""),
#                 cache_hit=bool(item.get("cache_hit", False)),
#                 latency_ms=float(item.get("latency_ms", 0)),
#                 created_at=item.get("created_at", ""),
#             )
#             for item in records
#         ]
#         return QueryHistoryResponse(items=items)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to load query history: {e}")


# # ---------------------------------------------------------------------------
# # Entitlements endpoint — returns user plan, usage, and features
# # ---------------------------------------------------------------------------
# @app.get("/api/v1/user/entitlements", response_model=EntitlementsResponse)
# @limiter.limit("60/minute")
# async def get_entitlements(request: Request):
#     uid = _resolve_uid_from_request(request, require_auth_in_production=False)
#     plan = get_user_plan(uid)
#     limits = get_plan_limits(plan)
#     usage = get_monthly_usage(uid)

#     return EntitlementsResponse(
#         plan=plan,
#         queries_this_month=usage,
#         queries_limit=limits["queries_per_month"],
#         features={
#             "postgres": limits["postgres"],
#             "cache_warming": limits["cache_warming"],
#             "user_isolated_cache": limits["user_isolated_cache"],
#             "analytics": limits["analytics"],
#         },
#     )


# # ---------------------------------------------------------------------------
# # Metrics endpoint
# # ---------------------------------------------------------------------------
# @app.get("/api/v1/metrics", response_model=MetricsResponse)
# async def metrics():
#     uptime = time.time() - start_time
#     avg_latency = total_latency_ms / query_count if query_count > 0 else 0
#     cache_hit_rate = cache_hit_count / query_count if query_count > 0 else 0

#     return MetricsResponse(
#         total_queries=query_count,
#         cache_hit_rate=cache_hit_rate,
#         avg_latency_ms=round(avg_latency, 2),
#         uptime_seconds=round(uptime, 1),
#     )


# # ---------------------------------------------------------------------------
# # Cache status endpoint
# # ---------------------------------------------------------------------------
# @app.get("/api/v1/cache/status", response_model=CacheStatusResponse)
# async def cache_status():
#     hit_rate = cache_hit_count / query_count if query_count > 0 else 0
#     return CacheStatusResponse(
#         status="healthy",
#         hit_count=cache_hit_count,
#         total_queries=query_count,
#         hit_rate=hit_rate,
#     )


# # ─────────────────────────────────────────────────────────────────────────────
# # RAZORPAY BILLING ENDPOINTS
# # ─────────────────────────────────────────────────────────────────────────────
# @app.post("/api/v1/razorpay/create-order", response_model=RazorpayOrderResponse)
# @limiter.limit("5/minute")
# async def create_razorpay_order(request: Request):
#     """
#     Create a Razorpay order for the Pro plan ($29).
#     Called by frontend during checkout.

#     Returns: order_id, amount, currency
#     Frontend will use order_id to open Razorpay modal.
#     """
#     import requests

#     uid = _resolve_uid_from_request(request, require_auth_in_production=True)

#     # Amount in paise (1 USD = 100 paise, so $29 = 2900 paise)
#     amount_paise = 2900 * 100  # $29 in paise
#     currency = "INR"  # Or "USD" if you're using USD

#     # Razorpay API credentials
#     rz_key_id = os.getenv("RAZORPAY_KEY_ID", "")
#     rz_key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")

#     if not rz_key_id or not rz_key_secret:
#         raise HTTPException(
#             status_code=500,
#             detail="Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env"
#         )

#     try:
#         response = requests.post(
#             "https://api.razorpay.com/v1/orders",
#             auth=(rz_key_id, rz_key_secret),
#             json={
#                 "amount": amount_paise,
#                 "currency": currency,
#                 "receipt": f"order_{uid[:8]}_{str(int(time.time()))[-6:]}",
#                 "notes": {
#                     "user_id": uid,
#                     "plan": "pro",
#                 },
#             },
#             timeout=10,
#         )
#         response.raise_for_status()
#         order_data = response.json()

#         return RazorpayOrderResponse(
#             order_id=order_data["id"],
#             amount=order_data["amount"],
#             currency=order_data["currency"],
#         )
#     except requests.RequestException as e:
#         print(f"❌ Razorpay API error: {e}")
#         raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")


# @app.post("/api/v1/razorpay/payment-success", response_model=PaymentSuccessResponse)
# @limiter.limit("5/minute")
# async def payment_success(request: Request):
#     """
#     Called by frontend after successful Razorpay payment.
#     Upgrades user to Pro plan in Firestore.

#     Backend webhook (payment.captured) will also call this for verification.
#     """
#     uid = _resolve_uid_from_request(request, require_auth_in_production=True)

#     from billing import upsert_subscription

#     try:
#         upsert_subscription(uid, "pro", "", "", "active")

#         print(f"✅ User {uid} upgraded to Pro (payment-success endpoint)")

#         return PaymentSuccessResponse(
#             status="upgraded",
#             uid=uid,
#         )
#     except Exception as e:
#         print(f"❌ Payment success handler error: {e}")
#         raise HTTPException(status_code=500, detail=f"Failed to upgrade plan: {str(e)}")


# @app.post("/api/v1/razorpay/webhook")
# async def razorpay_webhook(request: Request):
#     """
#     Razorpay webhook endpoint — handles payment events.

#     Setup in Razorpay dashboard:
#     1. Set webhook URL to: https://your-backend.com/api/v1/razorpay/webhook
#     2. Subscribe to "payment.authorized" and "payment.failed" events
#     3. Set RAZORPAY_WEBHOOK_SECRET in .env to match webhook secret from dashboard
#     """
#     payload_bytes = await request.body()
#     signature = request.headers.get("X-Razorpay-Signature", "")

#     print("📨 Received Razorpay webhook")

#     if _RZ_WEBHOOK_SECRET:
#         try:
#             if not verify_razorpay_signature(payload_bytes, signature, _RZ_WEBHOOK_SECRET):
#                 print("❌ Webhook signature verification failed")
#                 raise HTTPException(status_code=401, detail="Invalid webhook signature")
#             print("✅ Webhook signature verified")
#         except HTTPException:
#             raise
#         except Exception as e:
#             print(f"❌ Signature verification error: {e}")
#             raise HTTPException(status_code=401, detail="Signature verification failed")
#     else:
#         print("⚠️  RAZORPAY_WEBHOOK_SECRET not configured — skipping signature check")

#     try:
#         payload = json.loads(payload_bytes)
#         event_type = payload.get('event', 'unknown')
#         print(f"🔄 Processing webhook event: {event_type}")

#         handle_razorpay_webhook(payload)

#         print("✅ Webhook processed successfully")
#         return {"status": "ok"}

#     except json.JSONDecodeError as e:
#         print(f"❌ Failed to parse webhook JSON: {e}")
#         raise HTTPException(status_code=400, detail="Invalid JSON in webhook")
#     except Exception as e:
#         print(f"❌ Webhook processing failed: {str(e)}")
#         print(traceback.format_exc())
#         raise HTTPException(status_code=500, detail=f"Webhook processing failed: {e}")


# # ---------------------------------------------------------------------------
# # Database connection helpers
# # ---------------------------------------------------------------------------
# async def _attempt_connection(req: DatabaseConnectRequest) -> None:
#     if req.db_type == "postgresql":
#         try:
#             import asyncpg
#         except ImportError:
#             raise RuntimeError("asyncpg not installed. Run: pip install asyncpg")
#         conn = await asyncpg.connect(
#             host=req.host,
#             port=req.port,
#             database=req.database,
#             user=req.username,
#             password=req.password,
#             timeout=10,
#         )
#         await conn.close()
#     elif req.db_type == "mysql":
#         try:
#             import aiomysql
#         except ImportError:
#             raise RuntimeError("aiomysql not installed. Run: pip install aiomysql")
#         conn = await aiomysql.connect(
#             host=req.host,
#             port=req.port,
#             db=req.database,
#             user=req.username,
#             password=req.password,
#             connect_timeout=10,
#         )
#         conn.close()
#     else:
#         raise ValueError(f"Unsupported db_type '{req.db_type}'. Use 'postgresql' or 'mysql'.")


# @app.post("/api/v1/database/test", response_model=DatabaseTestResponse)
# async def test_database_connection(req: DatabaseConnectRequest):
#     if not req.host or not req.database or not req.username or not req.password:
#         raise HTTPException(status_code=400, detail="All connection fields are required.")
#     try:
#         await _attempt_connection(req)
#         return DatabaseTestResponse(
#             success=True,
#             message=f"Successfully connected to {req.db_type} database '{req.database}' on {req.host}:{req.port}.",
#         )
#     except Exception as e:
#         return DatabaseTestResponse(success=False, message=str(e))


# @app.get("/api/v1/database/status", response_model=DatabaseStatusResponse)
# @limiter.limit("30/minute")
# async def database_status(request: Request):
#     uid = _resolve_uid_from_request(request, require_auth_in_production=False)

#     if uid == "shared":
#         return DatabaseStatusResponse(
#             connected=False,
#             uses_demo=True,
#             message="Using shared SQLite demo database.",
#         )

#     plan = get_user_plan(uid)
#     limits = get_plan_limits(plan)

#     if not limits["postgres"]:
#         return DatabaseStatusResponse(
#             connected=False,
#             uses_demo=True,
#             message="Free plan uses shared SQLite demo database.",
#         )

#     saved = await _restore_saved_user_pool(uid)
#     if not saved:
#         return DatabaseStatusResponse(
#             connected=False,
#             uses_demo=False,
#             message="No saved PostgreSQL connection found for this user.",
#         )

#     return DatabaseStatusResponse(
#         connected=True,
#         uses_demo=False,
#         db_type=saved.get("db_type", "postgresql"),
#         host=saved.get("host"),
#         port=saved.get("port"),
#         database=saved.get("database"),
#         username=saved.get("username"),
#         message="Saved PostgreSQL connection restored successfully.",
#     )


# @app.post("/api/v1/database/connect", response_model=DatabaseConnectResponse)
# @limiter.limit("5/minute")
# async def connect_database(request: Request, req: DatabaseConnectRequest):
#     global driver

#     if not req.host or not req.database or not req.username or not req.password:
#         raise HTTPException(status_code=400, detail="All connection fields are required.")

#     uid = _resolve_uid_from_request(request, require_auth_in_production=True)

#     # ── BILLING: PostgreSQL is Pro only ───────────────────────────────────
#     if uid != "shared":
#         plan   = get_user_plan(uid)
#         limits = get_plan_limits(plan)
#         if not limits["postgres"]:
#             raise HTTPException(
#                 status_code=402,
#                 detail={
#                     "error": "FEATURE_LOCKED",
#                     "message": "Custom PostgreSQL connections require a Pro plan.",
#                     "plan": plan,
#                     "upgrade_url": _RZ_CHECKOUT_URL,
#                 },
#             )
#     # ─────────────────────────────────────────────────────────────────────

#     try:
#         await _attempt_connection(req)
#     except Exception as e:
#         return DatabaseConnectResponse(success=False, message=f"Connection failed: {e}")

#     try:
#         await db_manager.add_user_pool(uid, {
#             "host": req.host,
#             "port": req.port,
#             "database": req.database,
#             "username": req.username,
#             "password": req.password,
#         })

#         save_user_db_connection(
#             user_id=uid,
#             db_type=req.db_type,
#             host=req.host,
#             port=req.port,
#             database=req.database,
#             username=req.username,
#             password=req.password,
#             is_active=True,
#         )

#         _clear_user_schema_cache(uid)

#         return DatabaseConnectResponse(
#             success=True,
#             message=f"Database '{req.database}' connected for uid='{uid}'. All queries will now route to your PostgreSQL database.",
#         )
#     except Exception as e:
#         return DatabaseConnectResponse(success=False, message=f"Credentials valid but pool registration failed: {e}")


# # ---------------------------------------------------------------------------
# # Excel endpoints
# # ---------------------------------------------------------------------------
# @app.post("/api/v1/excel/upload", response_model=ExcelUploadResponse)
# @limiter.limit("10/minute")
# async def upload_excel_file(request: Request, file: UploadFile = File(...)):
#     _validate_excel_upload(file)
#     uid = _resolve_uid_from_request(request, require_auth_in_production=False)
#     user_dir = EXCEL_UPLOAD_ROOT / uid
#     user_dir.mkdir(parents=True, exist_ok=True)
#     safe_name   = _sanitize_filename(file.filename or "workbook.xlsx")
#     stored_path = user_dir / f"{uuid.uuid4().hex}_{safe_name}"

#     try:
#         content = await file.read()
#         if not content:
#             raise HTTPException(status_code=400, detail="Uploaded file is empty.")
#         if len(content) > 25 * 1024 * 1024:
#             raise HTTPException(status_code=400, detail="Excel file is too large. Max 25 MB.")

#         with open(stored_path, "wb") as f:
#             f.write(content)

#         return ExcelUploadResponse(
#             success=True,
#             message="Excel file uploaded successfully.",
#             file_path=str(stored_path.resolve()),
#             file_name=safe_name,
#         )
#     except HTTPException:
#         raise
#     except Exception as e:
#         if stored_path.exists():
#             try:
#                 stored_path.unlink()
#             except Exception:
#                 pass
#         raise HTTPException(status_code=500, detail=f"Failed to save Excel file: {e}")


# @app.post("/api/v1/excel/overview")
# @limiter.limit("30/minute")
# async def get_excel_overview(request: Request, body: ExcelOverviewRequest):
#     uid       = _resolve_uid_from_request(request, require_auth_in_production=False)
#     safe_path = _ensure_excel_path_allowed(body.file_path, uid)
#     try:
#         return await get_excel_tool().get_workbook_overview(str(safe_path))
#     except (DatabaseError, SecurityError) as e:
#         return JSONResponse(status_code=400, content={"status": "failed", "error": str(e)})
#     except Exception as e:
#         return JSONResponse(status_code=500, content={"status": "failed", "error": f"Excel overview error: {e}"})


# @app.post("/api/v1/excel/preview")
# @limiter.limit("30/minute")
# async def get_excel_sheet_preview(request: Request, body: ExcelPreviewRequest):
#     uid       = _resolve_uid_from_request(request, require_auth_in_production=False)
#     safe_path = _ensure_excel_path_allowed(body.file_path, uid)
#     if body.max_rows < 1 or body.max_rows > 100:
#         raise HTTPException(status_code=400, detail="max_rows must be between 1 and 100.")
#     try:
#         return await get_excel_tool().get_sheet_preview(
#             file_path=str(safe_path),
#             sheet_name=body.sheet_name,
#             max_rows=body.max_rows,
#         )
#     except (DatabaseError, SecurityError) as e:
#         return JSONResponse(status_code=400, content={"status": "failed", "error": str(e)})
#     except Exception as e:
#         return JSONResponse(status_code=500, content={"status": "failed", "error": f"Excel preview error: {e}"})


# # ---------------------------------------------------------------------------
# # Contact endpoint
# # ---------------------------------------------------------------------------
# @app.post("/api/v1/contact")
# @limiter.limit("5/minute")
# async def contact_form(request: Request, body: ContactRequest):
#     """Receive contact form and email to admin."""
#     smtp_email = os.getenv("SMTP_EMAIL", "")
#     smtp_password = os.getenv("SMTP_PASSWORD", "")

#     if not smtp_email or not smtp_password:
#         raise HTTPException(status_code=500, detail="Email config not set")

#     try:
#         msg = MIMEMultipart()
#         msg["From"] = smtp_email
#         msg["To"] = smtp_email
#         msg["Subject"] = f"Contact: {body.name}"

#         body_text = f"""
# Name: {body.name}
# Email: {body.email}

# Message:
# {body.message}
# """
#         msg.attach(MIMEText(body_text, "plain"))

#         with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
#             server.login(smtp_email, smtp_password)
#             server.send_message(msg)

#         return {"status": "sent", "message": "We received your message. Thanks!"}

#     except Exception as e:
#         print(f"❌ Email send failed: {e}")
#         raise HTTPException(status_code=500, detail="Failed to send message")


# # ---------------------------------------------------------------------------
# # Dev endpoints — remove in production
# # ---------------------------------------------------------------------------
# @app.post("/api/v1/dev/upgrade-plan")
# @limiter.limit("10/minute")
# async def dev_upgrade(request: Request):
#     """Dev endpoint to instantly upgrade a user to Pro (testing only)."""
#     uid = _resolve_uid_from_request(request, require_auth_in_production=False)
#     from billing import upsert_subscription
#     upsert_subscription(uid, "pro", "dev", "dev_order", "active")
#     return {"status": "upgraded", "uid": uid}







# ------------------------------------------------------------------------------------------------------
# !/usr/bin/env python3
# import sys
# import os
# sys.path.insert(0, os.path.dirname(__file__))

"""
FACT System REST API
FastAPI wrapper around the FACT driver for frontend dashboard communication.

Run with:
    uvicorn api:app --reload --port 8000
"""

import json
import os
import re
import smtplib
import time
import traceback
import uuid
from contextlib import asynccontextmanager
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from slowapi.middleware import SlowAPIMiddleware
from src.core.rate_limiter import limiter

from src.core.config import get_config
from src.core.driver import get_driver
from src.db.connection import current_user_uid, db_manager, PostgreSQLManager
from src.security.auth import verify_firebase_token
from src.core.errors import AuthenticationError, DatabaseError, SecurityError
from src.tools.connectors.excel import initialize_excel_tool, get_excel_tool

# ── Billing / Firestore helpers ────────────────────────────────────────────
from billing import (
    init_billing_db,
    get_user_plan,
    get_plan_limits,
    get_monthly_usage,
    increment_usage,
    verify_razorpay_signature,
    handle_razorpay_webhook,
    save_user_db_connection,
    get_user_db_connection,
    save_user_query_history,
    get_user_query_history,
)

_RZ_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
_RZ_CHECKOUT_URL   = os.getenv("RAZORPAY_CHECKOUT_URL", "/pricing")
# ───────────────────────────────────────────────────────────────────────────


# ---------------------------------------------------------------------------
# App state
# ---------------------------------------------------------------------------
driver = None
start_time = time.time()
query_count = 0
cache_hit_count = 0
total_latency_ms = 0.0


# ---------------------------------------------------------------------------
# File storage
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
EXCEL_UPLOAD_ROOT = BASE_DIR / "uploads" / "excel"


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global driver
    config = get_config()
    driver = await get_driver(config)
    initialize_excel_tool()
    EXCEL_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    init_billing_db()
    print("✅ FACT driver initialized — API ready")
    print("✅ Excel tool initialized — upload API ready")
    print("✅ Billing DB initialized")
    yield
    print("👋 FACT API shutting down")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="FACT API",
    description="REST API for the FACT financial data query system",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

_explicit_origins = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_explicit_origins,
    allow_origin_regex=r"https://zentra(-[a-z0-9-]+)?\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class QueryRequest(BaseModel):
    query: str


class QueryResponse(BaseModel):
    answer: str
    cache_hit: bool
    latency_ms: float
    query_id: str


class QueryHistoryItemResponse(BaseModel):
    query_id: str
    query: str
    answer: str
    cache_hit: bool
    latency_ms: float
    created_at: str


class QueryHistoryResponse(BaseModel):
    items: List[QueryHistoryItemResponse]


class HealthResponse(BaseModel):
    status: str
    uptime_seconds: float
    driver_ready: bool


class MetricsResponse(BaseModel):
    total_queries: int
    cache_hit_rate: float
    avg_latency_ms: float
    uptime_seconds: float


class CacheStatusResponse(BaseModel):
    status: str
    hit_count: int
    total_queries: int
    hit_rate: float


class ExcelUploadResponse(BaseModel):
    success: bool
    message: str
    file_path: str
    file_name: str


class ExcelOverviewRequest(BaseModel):
    file_path: str


class ExcelPreviewRequest(BaseModel):
    file_path: str
    sheet_name: str
    max_rows: int = 20


class DatabaseConnectRequest(BaseModel):
    db_type: str
    host: str
    port: int
    database: str
    username: str
    password: str


class DatabaseTestResponse(BaseModel):
    success: bool
    message: str


class DatabaseConnectResponse(BaseModel):
    success: bool
    message: str


class DatabaseStatusResponse(BaseModel):
    connected: bool
    uses_demo: bool
    db_type: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    database: Optional[str] = None
    username: Optional[str] = None
    message: str


class EntitlementsResponse(BaseModel):
    plan: str  # 'free' or 'pro'
    queries_this_month: int
    queries_limit: int
    features: dict


# ── Billing Models ─────────────────────────────────────────────────────────
class RazorpayOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str


class PaymentSuccessResponse(BaseModel):
    status: str
    uid: str

class ContactRequest(BaseModel):
    name: str
    email: str
    message: str
# ───────────────────────────────────────────────────────────────────────────


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/api/v1/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok" if driver is not None else "down",
        uptime_seconds=round(time.time() - start_time, 1),
        driver_ready=driver is not None,
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
def _resolve_uid_from_request(request: Request, require_auth_in_production: bool = True) -> str:
    is_production = os.getenv("ENVIRONMENT", "development") == "production"
    auth_header = request.headers.get("Authorization", "")
    bearer_token = auth_header.removeprefix("Bearer ").strip() if auth_header.startswith("Bearer ") else ""

    if bearer_token:
        try:
            return verify_firebase_token(bearer_token)
        except AuthenticationError as e:
            raise HTTPException(status_code=401, detail=str(e))
    elif is_production and require_auth_in_production:
        raise HTTPException(status_code=401, detail="Authorization header required.")
    else:
        return "shared"


def _sanitize_filename(filename: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", filename).strip("._")
    return cleaned[:200] or "file"


def _ensure_excel_path_allowed(file_path: str, uid: str) -> Path:
    requested = Path(file_path).resolve()
    allowed_root = (EXCEL_UPLOAD_ROOT / uid).resolve()
    if not str(requested).startswith(str(allowed_root)):
        raise SecurityError(f"Access denied to file path: {file_path}")
    if not requested.exists():
        raise DatabaseError(f"File not found: {file_path}")
    return requested


def _validate_excel_upload(file: UploadFile) -> None:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required.")
    name_lower = file.filename.lower()
    if not (name_lower.endswith('.xlsx') or name_lower.endswith('.xls') or name_lower.endswith('.csv')):
        raise HTTPException(status_code=400, detail="Only .xlsx, .xls, and .csv files are supported.")


def _clear_user_schema_cache(uid: str) -> None:
    global driver
    if driver is not None:
        driver._schema_cache.pop(uid, None)
        driver._schema_prompt_cache.pop(uid, None)


async def _restore_saved_user_pool(uid: str) -> Optional[dict]:
    """
    Restore a saved PostgreSQL connection from Firestore into the in-memory pool map.
    Returns saved config if present and restored successfully, else None.
    """
    saved = get_user_db_connection(uid)
    if not saved:
        return None

    if not db_manager.has_user_pool(uid):
        await db_manager.add_user_pool(uid, {
            "host": saved["host"],
            "port": saved.get("port", 5432),
            "database": saved["database"],
            "username": saved["username"],
            "password": saved["password"],
        })
        _clear_user_schema_cache(uid)

    return saved


# ---------------------------------------------------------------------------
# Query endpoint — with billing check + history save
# ---------------------------------------------------------------------------
@app.post("/api/v1/query", response_model=QueryResponse)
async def query(request: Request, body: QueryRequest):
    global query_count, cache_hit_count, total_latency_ms

    if not driver:
        raise HTTPException(status_code=503, detail="FACT driver not ready")

    uid = _resolve_uid_from_request(request, require_auth_in_production=False)

    # ── BILLING: Check monthly quota ───────────────────────────────────────
    plan   = get_user_plan(uid)
    limits = get_plan_limits(plan)
    usage  = get_monthly_usage(uid)

    if usage >= limits["queries_per_month"]:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "QUOTA_EXCEEDED",
                "message": f"Monthly query limit ({limits['queries_per_month']}) exceeded. Upgrade to Pro.",
                "plan": plan,
                "queries_used": usage,
                "queries_limit": limits["queries_per_month"],
                "upgrade_url": _RZ_CHECKOUT_URL,
            },
        )
    # ─────────────────────────────────────────────────────────────────────

    query_id = f"q_{uuid.uuid4().hex}"
    t_start = time.time()

    try:
        response = await driver.process_query(body.query, user_id=uid)
        latency_ms = round((time.time() - t_start) * 1000, 2)
        is_cache_hit = latency_ms < 50

        # Only count cache misses against quota
        if not is_cache_hit and uid != "shared":
            increment_usage(uid)

        # Update metrics
        query_count += 1
        if is_cache_hit:
            cache_hit_count += 1
        total_latency_ms += latency_ms

        # Save query history for logged-in users only
        if uid != "shared":
            try:
                save_user_query_history(
                    user_id=uid,
                    query_id=query_id,
                    query=body.query,
                    answer=str(response),
                    cache_hit=is_cache_hit,
                    latency_ms=round(latency_ms, 2),
                )
            except Exception as history_error:
                print(f"⚠️ Failed to save query history for uid={uid}: {history_error}")

        return QueryResponse(
            answer=str(response),
            cache_hit=is_cache_hit,
            latency_ms=round(latency_ms, 2),
            query_id=query_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Query history endpoint
# ---------------------------------------------------------------------------
@app.get("/api/v1/query/history", response_model=QueryHistoryResponse)
async def get_query_history(
    request: Request,
    limit: int = Query(default=50, ge=1, le=100),
):
    uid = _resolve_uid_from_request(request, require_auth_in_production=False)

    if uid == "shared":
        return QueryHistoryResponse(items=[])

    try:
        records = get_user_query_history(uid, limit=limit)
        items = [
            QueryHistoryItemResponse(
                query_id=item.get("query_id", ""),
                query=item.get("query", ""),
                answer=item.get("answer", ""),
                cache_hit=bool(item.get("cache_hit", False)),
                latency_ms=float(item.get("latency_ms", 0)),
                created_at=item.get("created_at", ""),
            )
            for item in records
        ]
        return QueryHistoryResponse(items=items)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load query history: {e}")


# ---------------------------------------------------------------------------
# Entitlements endpoint — returns user plan, usage, and features
# ---------------------------------------------------------------------------
@app.get("/api/v1/user/entitlements", response_model=EntitlementsResponse)
async def get_entitlements(request: Request):
    uid = _resolve_uid_from_request(request, require_auth_in_production=False)
    plan = get_user_plan(uid)
    limits = get_plan_limits(plan)
    usage = get_monthly_usage(uid)

    return EntitlementsResponse(
        plan=plan,
        queries_this_month=usage,
        queries_limit=limits["queries_per_month"],
        features={
            "postgres": limits["postgres"],
            "cache_warming": limits["cache_warming"],
            "user_isolated_cache": limits["user_isolated_cache"],
            "analytics": limits["analytics"],
        },
    )


# ---------------------------------------------------------------------------
# Metrics endpoint
# ---------------------------------------------------------------------------
@app.get("/api/v1/metrics", response_model=MetricsResponse)
async def metrics():
    uptime = time.time() - start_time
    avg_latency = total_latency_ms / query_count if query_count > 0 else 0
    cache_hit_rate = cache_hit_count / query_count if query_count > 0 else 0

    return MetricsResponse(
        total_queries=query_count,
        cache_hit_rate=cache_hit_rate,
        avg_latency_ms=round(avg_latency, 2),
        uptime_seconds=round(uptime, 1),
    )


# ---------------------------------------------------------------------------
# Cache status endpoint
# ---------------------------------------------------------------------------
@app.get("/api/v1/cache/status", response_model=CacheStatusResponse)
async def cache_status():
    hit_rate = cache_hit_count / query_count if query_count > 0 else 0
    return CacheStatusResponse(
        status="healthy",
        hit_count=cache_hit_count,
        total_queries=query_count,
        hit_rate=hit_rate,
    )


# ─────────────────────────────────────────────────────────────────────────────
# RAZORPAY BILLING ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/v1/razorpay/create-order", response_model=RazorpayOrderResponse)
async def create_razorpay_order(request: Request):
    """
    Create a Razorpay order for the Pro plan ($29).
    Called by frontend during checkout.

    Returns: order_id, amount, currency
    Frontend will use order_id to open Razorpay modal.
    """
    import requests

    uid = _resolve_uid_from_request(request, require_auth_in_production=True)

    # Amount in paise (1 USD = 100 paise, so $29 = 2900 paise)
    amount_paise = 2900 * 100  # $29 in paise
    currency = "INR"  # Or "USD" if you're using USD

    # Razorpay API credentials
    rz_key_id = os.getenv("RAZORPAY_KEY_ID", "")
    rz_key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")

    if not rz_key_id or not rz_key_secret:
        raise HTTPException(
            status_code=500,
            detail="Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env"
        )

    try:
        response = requests.post(
            "https://api.razorpay.com/v1/orders",
            auth=(rz_key_id, rz_key_secret),
            json={
                "amount": amount_paise,
                "currency": currency,
                "receipt": f"order_{uid}_{int(time.time())}",
                "notes": {
                    "user_id": uid,
                    "plan": "pro",
                },
            },
            timeout=10,
        )
        response.raise_for_status()
        order_data = response.json()

        return RazorpayOrderResponse(
            order_id=order_data["id"],
            amount=order_data["amount"],
            currency=order_data["currency"],
        )
    except requests.RequestException as e:
        print(f"❌ Razorpay API error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")


@app.post("/api/v1/razorpay/payment-success", response_model=PaymentSuccessResponse)
async def payment_success(request: Request):
    """
    Called by frontend after successful Razorpay payment.
    Upgrades user to Pro plan in Firestore.

    Backend webhook (payment.captured) will also call this for verification.
    """
    uid = _resolve_uid_from_request(request, require_auth_in_production=True)

    from billing import upsert_subscription

    try:
        upsert_subscription(uid, "pro", "", "", "active")

        print(f"✅ User {uid} upgraded to Pro (payment-success endpoint)")

        return PaymentSuccessResponse(
            status="upgraded",
            uid=uid,
        )
    except Exception as e:
        print(f"❌ Payment success handler error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upgrade plan: {str(e)}")


@app.post("/api/v1/razorpay/webhook")
async def razorpay_webhook(request: Request):
    """
    Razorpay webhook endpoint — handles payment events.

    Setup in Razorpay dashboard:
    1. Set webhook URL to: https://your-backend.com/api/v1/razorpay/webhook
    2. Subscribe to "payment.authorized" and "payment.failed" events
    3. Set RAZORPAY_WEBHOOK_SECRET in .env to match webhook secret from dashboard
    """
    payload_bytes = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    print("📨 Received Razorpay webhook")

    if _RZ_WEBHOOK_SECRET:
        try:
            if not verify_razorpay_signature(payload_bytes, signature, _RZ_WEBHOOK_SECRET):
                print("❌ Webhook signature verification failed")
                raise HTTPException(status_code=401, detail="Invalid webhook signature")
            print("✅ Webhook signature verified")
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Signature verification error: {e}")
            raise HTTPException(status_code=401, detail="Signature verification failed")
    else:
        print("⚠️  RAZORPAY_WEBHOOK_SECRET not configured — skipping signature check")

    try:
        payload = json.loads(payload_bytes)
        event_type = payload.get('event', 'unknown')
        print(f"🔄 Processing webhook event: {event_type}")

        handle_razorpay_webhook(payload)

        print("✅ Webhook processed successfully")
        return {"status": "ok"}

    except json.JSONDecodeError as e:
        print(f"❌ Failed to parse webhook JSON: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON in webhook")
    except Exception as e:
        print(f"❌ Webhook processing failed: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {e}")


# ---------------------------------------------------------------------------
# Database connection helpers
# ---------------------------------------------------------------------------
async def _attempt_connection(req: DatabaseConnectRequest) -> None:
    if req.db_type == "postgresql":
        try:
            import asyncpg
        except ImportError:
            raise RuntimeError("asyncpg not installed. Run: pip install asyncpg")
        conn = await asyncpg.connect(
            host=req.host,
            port=req.port,
            database=req.database,
            user=req.username,
            password=req.password,
            timeout=10,
        )
        await conn.close()
    elif req.db_type == "mysql":
        try:
            import aiomysql
        except ImportError:
            raise RuntimeError("aiomysql not installed. Run: pip install aiomysql")
        conn = await aiomysql.connect(
            host=req.host,
            port=req.port,
            db=req.database,
            user=req.username,
            password=req.password,
            connect_timeout=10,
        )
        conn.close()
    else:
        raise ValueError(f"Unsupported db_type '{req.db_type}'. Use 'postgresql' or 'mysql'.")


@app.post("/api/v1/database/test", response_model=DatabaseTestResponse)
async def test_database_connection(req: DatabaseConnectRequest):
    if not req.host or not req.database or not req.username or not req.password:
        raise HTTPException(status_code=400, detail="All connection fields are required.")
    try:
        await _attempt_connection(req)
        return DatabaseTestResponse(
            success=True,
            message=f"Successfully connected to {req.db_type} database '{req.database}' on {req.host}:{req.port}.",
        )
    except Exception as e:
        return DatabaseTestResponse(success=False, message=str(e))


@app.get("/api/v1/database/status", response_model=DatabaseStatusResponse)
async def database_status(request: Request):
    uid = _resolve_uid_from_request(request, require_auth_in_production=False)

    if uid == "shared":
        return DatabaseStatusResponse(
            connected=False,
            uses_demo=True,
            message="Using shared SQLite demo database.",
        )

    plan = get_user_plan(uid)
    limits = get_plan_limits(plan)

    if not limits["postgres"]:
        return DatabaseStatusResponse(
            connected=False,
            uses_demo=True,
            message="Free plan uses shared SQLite demo database.",
        )

    saved = await _restore_saved_user_pool(uid)
    if not saved:
        return DatabaseStatusResponse(
            connected=False,
            uses_demo=False,
            message="No saved PostgreSQL connection found for this user.",
        )

    return DatabaseStatusResponse(
        connected=True,
        uses_demo=False,
        db_type=saved.get("db_type", "postgresql"),
        host=saved.get("host"),
        port=saved.get("port"),
        database=saved.get("database"),
        username=saved.get("username"),
        message="Saved PostgreSQL connection restored successfully.",
    )


@app.post("/api/v1/database/connect", response_model=DatabaseConnectResponse)
async def connect_database(request: Request, req: DatabaseConnectRequest):
    global driver

    if not req.host or not req.database or not req.username or not req.password:
        raise HTTPException(status_code=400, detail="All connection fields are required.")

    uid = _resolve_uid_from_request(request, require_auth_in_production=True)

    # ── BILLING: PostgreSQL is Pro only ───────────────────────────────────
    if uid != "shared":
        plan   = get_user_plan(uid)
        limits = get_plan_limits(plan)
        if not limits["postgres"]:
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "FEATURE_LOCKED",
                    "message": "Custom PostgreSQL connections require a Pro plan.",
                    "plan": plan,
                    "upgrade_url": _RZ_CHECKOUT_URL,
                },
            )
    # ─────────────────────────────────────────────────────────────────────

    try:
        await _attempt_connection(req)
    except Exception as e:
        return DatabaseConnectResponse(success=False, message=f"Connection failed: {e}")

    try:
        await db_manager.add_user_pool(uid, {
            "host": req.host,
            "port": req.port,
            "database": req.database,
            "username": req.username,
            "password": req.password,
        })

        save_user_db_connection(
            user_id=uid,
            db_type=req.db_type,
            host=req.host,
            port=req.port,
            database=req.database,
            username=req.username,
            password=req.password,
            is_active=True,
        )

        _clear_user_schema_cache(uid)

        return DatabaseConnectResponse(
            success=True,
            message=f"Database '{req.database}' connected for uid='{uid}'. All queries will now route to your PostgreSQL database.",
        )
    except Exception as e:
        return DatabaseConnectResponse(success=False, message=f"Credentials valid but pool registration failed: {e}")


# ---------------------------------------------------------------------------
# Excel endpoints
# ---------------------------------------------------------------------------
@app.post("/api/v1/excel/upload", response_model=ExcelUploadResponse)
async def upload_excel_file(request: Request, file: UploadFile = File(...)):
    _validate_excel_upload(file)
    uid = _resolve_uid_from_request(request, require_auth_in_production=False)
    user_dir = EXCEL_UPLOAD_ROOT / uid
    user_dir.mkdir(parents=True, exist_ok=True)
    safe_name   = _sanitize_filename(file.filename or "workbook.xlsx")
    stored_path = user_dir / f"{uuid.uuid4().hex}_{safe_name}"

    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        if len(content) > 25 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Excel file is too large. Max 25 MB.")

        with open(stored_path, "wb") as f:
            f.write(content)

        return ExcelUploadResponse(
            success=True,
            message="Excel file uploaded successfully.",
            file_path=str(stored_path.resolve()),
            file_name=safe_name,
        )
    except HTTPException:
        raise
    except Exception as e:
        if stored_path.exists():
            try:
                stored_path.unlink()
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Failed to save Excel file: {e}")


@app.post("/api/v1/excel/overview")
async def get_excel_overview(request: Request, body: ExcelOverviewRequest):
    uid       = _resolve_uid_from_request(request, require_auth_in_production=False)
    safe_path = _ensure_excel_path_allowed(body.file_path, uid)
    try:
        return await get_excel_tool().get_workbook_overview(str(safe_path))
    except (DatabaseError, SecurityError) as e:
        return JSONResponse(status_code=400, content={"status": "failed", "error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "failed", "error": f"Excel overview error: {e}"})


@app.post("/api/v1/excel/preview")
async def get_excel_sheet_preview(request: Request, body: ExcelPreviewRequest):
    uid       = _resolve_uid_from_request(request, require_auth_in_production=False)
    safe_path = _ensure_excel_path_allowed(body.file_path, uid)
    if body.max_rows < 1 or body.max_rows > 100:
        raise HTTPException(status_code=400, detail="max_rows must be between 1 and 100.")
    try:
        return await get_excel_tool().get_sheet_preview(
            file_path=str(safe_path),
            sheet_name=body.sheet_name,
            max_rows=body.max_rows,
        )
    except (DatabaseError, SecurityError) as e:
        return JSONResponse(status_code=400, content={"status": "failed", "error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "failed", "error": f"Excel preview error: {e}"})


# ---------------------------------------------------------------------------
# Contact form endpoint
# ---------------------------------------------------------------------------
@app.post("/api/v1/contact")
async def contact_form(body: ContactRequest):
    smtp_user     = os.getenv("SMTP_EMAIL", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    contact_email = os.getenv("CONTACT_EMAIL", smtp_user)

    if not smtp_user or not smtp_password:
        raise HTTPException(status_code=500, detail="Email sending is not configured on the server.")

    try:
        msg = MIMEMultipart()
        msg["From"]    = smtp_user
        msg["To"]      = contact_email
        msg["Reply-To"] = body.email
        msg["Subject"] = f"Zentra Contact: {body.name}"
        msg.attach(MIMEText(
            f"Name:    {body.name}\nEmail:   {body.email}\n\nMessage:\n{body.message}",
            "plain",
        ))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(smtp_user, smtp_password)
            server.send_message(msg)

        return {"status": "sent", "message": "Message received. We'll get back to you soon."}
    except Exception as e:
        print(f"❌ Contact email failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to send message. Please try again later.")