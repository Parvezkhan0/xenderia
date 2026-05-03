# """
# Zentra Billing — Razorpay + Firebase Firestore
# ===============================================
# Handles webhook events, plan storage, monthly quota tracking,
# persistent per-user database connection storage,
# and persistent per-user query history storage.

# Data stored in Firebase Firestore — persists across Render redeploys.

# Collections:
#   user_subscriptions/{user_id}        → plan, status, razorpay IDs
#   monthly_usage/{user_id}_{ym}        → query_count for that month
#   user_db_connections/{user_id}       → saved PostgreSQL connection config
#   user_query_history/{user_id}/items  → saved query history entries

# Plans:
#   free  → 50 queries/month,  SQLite demo only
#   pro   → 1,000 queries/month, PostgreSQL, cache warming, $29/mo
# """

# import hashlib
# import hmac
# import logging
# import os
# from datetime import datetime, date
# from typing import Optional

# logger = logging.getLogger(__name__)


# # ---------------------------------------------------------------------------
# # Plan definitions
# # ---------------------------------------------------------------------------
# PLANS: dict[str, dict] = {
#     "free": {
#         "queries_per_month": 50,
#         "rate_limit_per_min": 10,
#         "postgres": False,
#         "cache_warming": False,
#         "user_isolated_cache": False,
#         "analytics": False,
#     },
#     "pro": {
#         "queries_per_month": 1000,
#         "rate_limit_per_min": 60,
#         "postgres": True,
#         "cache_warming": True,
#         "user_isolated_cache": True,
#         "analytics": True,
#     },
# }

# RAZORPAY_KEY_ID     = os.getenv("RAZORPAY_KEY_ID", "")
# RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")


# # ---------------------------------------------------------------------------
# # Firestore client — lazy singleton
# # ---------------------------------------------------------------------------
# _firestore_client = None


# def _db():
#     """Returns Firestore client. Initializes once on first call."""
#     global _firestore_client
#     if _firestore_client is not None:
#         return _firestore_client

#     import firebase_admin
#     from firebase_admin import credentials, firestore

#     if not firebase_admin._apps:
#         sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT", "")
#         sa_file = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")

#         if sa_json:
#             import json
#             cred = credentials.Certificate(json.loads(sa_json))
#         elif sa_file:
#             cred = credentials.Certificate(sa_file)
#         else:
#             raise RuntimeError(
#                 "Set FIREBASE_SERVICE_ACCOUNT (JSON string) or "
#                 "GOOGLE_APPLICATION_CREDENTIALS (file path) in backend/.env"
#             )
#         firebase_admin.initialize_app(cred)

#     _firestore_client = firestore.client()
#     return _firestore_client


# def init_billing_db() -> None:
#     """Firestore is schemaless — just verify connection at startup."""
#     try:
#         _db()
#         logger.info("✅ Firestore billing client ready")
#     except Exception as e:
#         logger.error(f"❌ Firestore init failed: {e}")
#         raise


# # ---------------------------------------------------------------------------
# # Subscription helpers
# # ---------------------------------------------------------------------------

# def get_user_plan(user_id: str) -> str:
#     """Returns 'free' or 'pro'. Defaults to 'free' for unknown users."""
#     try:
#         doc = _db().collection("user_subscriptions").document(user_id).get()
#         if doc.exists:
#             return doc.to_dict().get("plan", "free")
#     except Exception as e:
#         logger.error(f"Firestore get_user_plan error: {e}")
#     return "free"


# def get_plan_limits(plan: str) -> dict:
#     return PLANS.get(plan, PLANS["free"])


# def upsert_subscription(
#     user_id: str,
#     plan: str,
#     rz_customer_id: str,
#     rz_subscription_id: str,
#     status: str = "active",
# ) -> None:
#     try:
#         _db().collection("user_subscriptions").document(user_id).set({
#             "plan":               plan,
#             "rz_customer_id":     rz_customer_id,
#             "rz_subscription_id": rz_subscription_id,
#             "status":             status,
#             "updated_at":         datetime.utcnow().isoformat(),
#         }, merge=True)
#         logger.info(f"Subscription updated: uid={user_id} plan={plan} status={status}")
#     except Exception as e:
#         logger.error(f"Firestore upsert error: {e}")
#         raise


# def cancel_subscription(user_id: str) -> None:
#     try:
#         _db().collection("user_subscriptions").document(user_id).set({
#             "plan":       "free",
#             "status":     "cancelled",
#             "updated_at": datetime.utcnow().isoformat(),
#         }, merge=True)
#         logger.info(f"User {user_id} downgraded to free")
#     except Exception as e:
#         logger.error(f"Firestore cancel error: {e}")
#         raise


# # ---------------------------------------------------------------------------
# # Monthly usage tracking
# # ---------------------------------------------------------------------------

# def _year_month() -> str:
#     return date.today().strftime("%Y-%m")


# def get_monthly_usage(user_id: str) -> int:
#     try:
#         doc_id = f"{user_id}_{_year_month()}"
#         doc = _db().collection("monthly_usage").document(doc_id).get()
#         if doc.exists:
#             return doc.to_dict().get("query_count", 0)
#     except Exception as e:
#         logger.error(f"Firestore get_monthly_usage error: {e}")
#     return 0


# def increment_usage(user_id: str) -> int:
#     """Atomically increments monthly query count."""
#     from google.cloud.firestore import Increment

#     doc_id  = f"{user_id}_{_year_month()}"
#     doc_ref = _db().collection("monthly_usage").document(doc_id)
#     try:
#         doc_ref.set({
#             "user_id":     user_id,
#             "year_month":  _year_month(),
#             "query_count": Increment(1),
#         }, merge=True)
#         doc = doc_ref.get()
#         return doc.to_dict().get("query_count", 1) if doc.exists else 1
#     except Exception as e:
#         logger.error(f"Firestore increment_usage error: {e}")
#         return 0


# # ---------------------------------------------------------------------------
# # Persistent per-user DB connection helpers
# # ---------------------------------------------------------------------------

# def save_user_db_connection(
#     user_id: str,
#     db_type: str,
#     host: str,
#     port: int,
#     database: str,
#     username: str,
#     password: str,
#     is_active: bool = True,
# ) -> None:
#     """
#     Saves a user's database connection config in Firestore.

#     Note:
#     Password is stored as plain text here for MVP simplicity.
#     """
#     try:
#         _db().collection("user_db_connections").document(user_id).set({
#             "db_type": db_type,
#             "host": host,
#             "port": int(port),
#             "database": database,
#             "username": username,
#             "password": password,
#             "is_active": is_active,
#             "updated_at": datetime.utcnow().isoformat(),
#         }, merge=True)
#         logger.info(f"DB connection saved for uid={user_id} db_type={db_type} host={host}")
#     except Exception as e:
#         logger.error(f"Firestore save_user_db_connection error: {e}")
#         raise


# def get_user_db_connection(user_id: str) -> Optional[dict]:
#     """
#     Returns saved DB connection config for a user, or None if not found.
#     """
#     try:
#         doc = _db().collection("user_db_connections").document(user_id).get()
#         if doc.exists:
#             data = doc.to_dict() or {}
#             if data.get("is_active", False):
#                 return data
#     except Exception as e:
#         logger.error(f"Firestore get_user_db_connection error: {e}")
#     return None


# def delete_user_db_connection(user_id: str) -> None:
#     """
#     Deletes a user's saved DB connection config from Firestore.
#     """
#     try:
#         _db().collection("user_db_connections").document(user_id).delete()
#         logger.info(f"DB connection deleted for uid={user_id}")
#     except Exception as e:
#         logger.error(f"Firestore delete_user_db_connection error: {e}")
#         raise


# def deactivate_user_db_connection(user_id: str) -> None:
#     """
#     Marks a user's saved DB connection inactive without deleting it.
#     """
#     try:
#         _db().collection("user_db_connections").document(user_id).set({
#             "is_active": False,
#             "updated_at": datetime.utcnow().isoformat(),
#         }, merge=True)
#         logger.info(f"DB connection deactivated for uid={user_id}")
#     except Exception as e:
#         logger.error(f"Firestore deactivate_user_db_connection error: {e}")
#         raise


# # ---------------------------------------------------------------------------
# # Persistent per-user query history helpers
# # ---------------------------------------------------------------------------

# def save_user_query_history(
#     user_id: str,
#     query_id: str,
#     query: str,
#     answer: str,
#     cache_hit: bool,
#     latency_ms: float,
# ) -> None:
#     """
#     Saves one query history item under the user's UID.

#     Path:
#       user_query_history/{user_id}/items/{query_id}
#     """
#     try:
#         _db().collection("user_query_history").document(user_id).collection("items").document(query_id).set({
#             "query_id": query_id,
#             "query": query,
#             "answer": answer,
#             "cache_hit": bool(cache_hit),
#             "latency_ms": float(latency_ms),
#             "created_at": datetime.utcnow().isoformat(),
#         }, merge=True)
#         logger.info(f"Query history saved: uid={user_id} query_id={query_id}")
#     except Exception as e:
#         logger.error(f"Firestore save_user_query_history error: {e}")
#         raise


# def get_user_query_history(user_id: str, limit: int = 50) -> list[dict]:
#     """
#     Returns recent query history for a user, newest first.
#     """
#     try:
#         docs = (
#             _db()
#             .collection("user_query_history")
#             .document(user_id)
#             .collection("items")
#             .order_by("created_at", direction="DESCENDING")
#             .limit(limit)
#             .stream()
#         )
#         return [doc.to_dict() for doc in docs]
#     except Exception as e:
#         logger.error(f"Firestore get_user_query_history error: {e}")
#         return []


# def delete_user_query_history_item(user_id: str, query_id: str) -> None:
#     """
#     Deletes one saved query history item.
#     """
#     try:
#         _db().collection("user_query_history").document(user_id).collection("items").document(query_id).delete()
#         logger.info(f"Query history item deleted: uid={user_id} query_id={query_id}")
#     except Exception as e:
#         logger.error(f"Firestore delete_user_query_history_item error: {e}")
#         raise


# def clear_user_query_history(user_id: str, batch_size: int = 100) -> None:
#     """
#     Deletes all saved query history for a user.
#     """
#     try:
#         items_ref = _db().collection("user_query_history").document(user_id).collection("items")

#         while True:
#             docs = list(items_ref.limit(batch_size).stream())
#             if not docs:
#                 break

#             batch = _db().batch()
#             for doc in docs:
#                 batch.delete(doc.reference)
#             batch.commit()

#             if len(docs) < batch_size:
#                 break

#         logger.info(f"All query history cleared for uid={user_id}")
#     except Exception as e:
#         logger.error(f"Firestore clear_user_query_history error: {e}")
#         raise


# # ---------------------------------------------------------------------------
# # Razorpay webhook signature verification
# # ---------------------------------------------------------------------------

# def verify_razorpay_signature(payload_bytes: bytes, signature: str, secret: str) -> bool:
#     expected = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
#     return hmac.compare_digest(expected, signature)


# # ---------------------------------------------------------------------------
# # Razorpay webhook handler
# # ---------------------------------------------------------------------------

# def handle_razorpay_webhook(payload: dict) -> None:
#     """
#     Handles Razorpay payment webhook events.

#     payment.captured  → upgrade user to pro  ← this fires for one-time orders
#     payment.failed    → log only
#     subscription.*    → handled if you switch to subscriptions later

#     Firebase UID must be in order notes: { user_id: FIREBASE_UID }
#     """
#     event = payload.get("event", "")

#     if event == "payment.captured":
#         entity        = payload.get("payload", {}).get("payment", {}).get("entity", {})
#         notes         = entity.get("notes", {})
#         user_id       = notes.get("user_id", "")
#         rz_payment_id = entity.get("id", "")
#         rz_order_id   = entity.get("order_id", "")

#         if not user_id:
#             logger.warning("payment.captured: missing user_id in notes — skipping")
#             return

#         upsert_subscription(user_id, "pro", "", rz_order_id, "active")
#         logger.info(f"payment.captured: uid={user_id} → pro (payment={rz_payment_id})")

#     elif event in ("subscription.activated", "subscription.charged"):
#         entity  = payload.get("payload", {}).get("subscription", {}).get("entity", {})
#         user_id = entity.get("notes", {}).get("user_id", "")
#         if user_id:
#             upsert_subscription(user_id, "pro", entity.get("customer_id", ""), entity.get("id", ""), "active")

#     elif event in ("subscription.completed", "subscription.cancelled", "subscription.halted"):
#         entity  = payload.get("payload", {}).get("subscription", {}).get("entity", {})
#         user_id = entity.get("notes", {}).get("user_id", "")
#         if user_id:
#             cancel_subscription(user_id)

#     elif event == "payment.failed":
#         logger.warning("payment.failed received — no action taken")

#     else:
#         logger.debug(f"Unhandled Razorpay event: {event}")

"""
Zentra Billing — Razorpay + Firebase Firestore
===============================================
Handles webhook events, plan storage, monthly quota tracking,
persistent per-user database connection storage,
and persistent per-user query history storage.

Data stored in Firebase Firestore — persists across Render redeploys.

Collections:
  user_subscriptions/{user_id}        → plan, status, razorpay IDs
  monthly_usage/{user_id}_{ym}        → query_count for that month
  user_db_connections/{user_id}       → saved PostgreSQL connection config
  user_query_history/{user_id}/items  → saved query history entries

Plans:
  free  → 50 queries/month,  SQLite demo only
  pro   → 1,000 queries/month, PostgreSQL, cache warming, $29/mo
"""

import hashlib
import hmac
import logging
import os
from datetime import datetime, date
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Plan definitions
# ---------------------------------------------------------------------------
PLANS: dict[str, dict] = {
    "free": {
        "queries_per_month": 50,
        "rate_limit_per_min": 10,
        "postgres": False,
        "cache_warming": False,
        "user_isolated_cache": False,
        "analytics": False,
    },
    "pro": {
        "queries_per_month": 1000,
        "rate_limit_per_min": 60,
        "postgres": True,
        "cache_warming": True,
        "user_isolated_cache": True,
        "analytics": True,
    },
}

RAZORPAY_KEY_ID     = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")


# ---------------------------------------------------------------------------
# Firestore client — lazy singleton
# ---------------------------------------------------------------------------
_firestore_client = None


def _db():
    """Returns Firestore client. Initializes once on first call."""
    global _firestore_client
    if _firestore_client is not None:
        return _firestore_client

    import firebase_admin
    from firebase_admin import credentials, firestore

    if not firebase_admin._apps:
        sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT", "")
        sa_file = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")

        if sa_json:
            import json
            cred = credentials.Certificate(json.loads(sa_json))
        elif sa_file:
            cred = credentials.Certificate(sa_file)
        else:
            raise RuntimeError(
                "Set FIREBASE_SERVICE_ACCOUNT (JSON string) or "
                "GOOGLE_APPLICATION_CREDENTIALS (file path) in backend/.env"
            )
        firebase_admin.initialize_app(cred)

    _firestore_client = firestore.client()
    return _firestore_client


def init_billing_db() -> None:
    """Firestore is schemaless — just verify connection at startup."""
    try:
        _db()
        logger.info("✅ Firestore billing client ready")
    except Exception as e:
        logger.error(f"❌ Firestore init failed: {e}")
        raise


# ---------------------------------------------------------------------------
# Subscription helpers
# ---------------------------------------------------------------------------

def get_user_plan(user_id: str) -> str:
    """Returns 'free' or 'pro'. Defaults to 'free' for unknown users."""
    try:
        doc = _db().collection("user_subscriptions").document(user_id).get()
        if doc.exists:
            return doc.to_dict().get("plan", "free")
    except Exception as e:
        logger.error(f"Firestore get_user_plan error: {e}")
    return "free"


def get_plan_limits(plan: str) -> dict:
    return PLANS.get(plan, PLANS["free"])


def upsert_subscription(
    user_id: str,
    plan: str,
    rz_customer_id: str,
    rz_subscription_id: str,
    status: str = "active",
) -> None:
    try:
        _db().collection("user_subscriptions").document(user_id).set({
            "plan":               plan,
            "rz_customer_id":     rz_customer_id,
            "rz_subscription_id": rz_subscription_id,
            "status":             status,
            "updated_at":         datetime.utcnow().isoformat(),
        }, merge=True)
        logger.info(f"Subscription updated: uid={user_id} plan={plan} status={status}")
    except Exception as e:
        logger.error(f"Firestore upsert error: {e}")
        raise


def cancel_subscription(user_id: str) -> None:
    try:
        _db().collection("user_subscriptions").document(user_id).set({
            "plan":       "free",
            "status":     "cancelled",
            "updated_at": datetime.utcnow().isoformat(),
        }, merge=True)
        logger.info(f"User {user_id} downgraded to free")
    except Exception as e:
        logger.error(f"Firestore cancel error: {e}")
        raise


# ---------------------------------------------------------------------------
# Monthly usage tracking
# ---------------------------------------------------------------------------

def _year_month() -> str:
    return date.today().strftime("%Y-%m")


def get_monthly_usage(user_id: str) -> int:
    try:
        doc_id = f"{user_id}_{_year_month()}"
        doc = _db().collection("monthly_usage").document(doc_id).get()
        if doc.exists:
            return doc.to_dict().get("query_count", 0)
    except Exception as e:
        logger.error(f"Firestore get_monthly_usage error: {e}")
    return 0


def increment_usage(user_id: str) -> int:
    """Atomically increments monthly query count."""
    from google.cloud.firestore import Increment

    doc_id  = f"{user_id}_{_year_month()}"
    doc_ref = _db().collection("monthly_usage").document(doc_id)
    try:
        doc_ref.set({
            "user_id":     user_id,
            "year_month":  _year_month(),
            "query_count": Increment(1),
        }, merge=True)
        doc = doc_ref.get()
        return doc.to_dict().get("query_count", 1) if doc.exists else 1
    except Exception as e:
        logger.error(f"Firestore increment_usage error: {e}")
        return 0


# ---------------------------------------------------------------------------
# Persistent per-user DB connection helpers
# ---------------------------------------------------------------------------

def save_user_db_connection(
    user_id: str,
    db_type: str,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
    is_active: bool = True,
) -> None:
    """
    Saves a user's database connection config in Firestore.

    Note:
    Password is stored as plain text here for MVP simplicity.
    """
    try:
        _db().collection("user_db_connections").document(user_id).set({
            "db_type": db_type,
            "host": host,
            "port": int(port),
            "database": database,
            "username": username,
            "password": password,
            "is_active": is_active,
            "updated_at": datetime.utcnow().isoformat(),
        }, merge=True)
        logger.info(f"DB connection saved for uid={user_id} db_type={db_type} host={host}")
    except Exception as e:
        logger.error(f"Firestore save_user_db_connection error: {e}")
        raise


def get_user_db_connection(user_id: str) -> Optional[dict]:
    """
    Returns saved DB connection config for a user, or None if not found.
    """
    try:
        doc = _db().collection("user_db_connections").document(user_id).get()
        if doc.exists:
            data = doc.to_dict() or {}
            if data.get("is_active", False):
                return data
    except Exception as e:
        logger.error(f"Firestore get_user_db_connection error: {e}")
    return None


def delete_user_db_connection(user_id: str) -> None:
    """
    Deletes a user's saved DB connection config from Firestore.
    """
    try:
        _db().collection("user_db_connections").document(user_id).delete()
        logger.info(f"DB connection deleted for uid={user_id}")
    except Exception as e:
        logger.error(f"Firestore delete_user_db_connection error: {e}")
        raise


def deactivate_user_db_connection(user_id: str) -> None:
    """
    Marks a user's saved DB connection inactive without deleting it.
    """
    try:
        _db().collection("user_db_connections").document(user_id).set({
            "is_active": False,
            "updated_at": datetime.utcnow().isoformat(),
        }, merge=True)
        logger.info(f"DB connection deactivated for uid={user_id}")
    except Exception as e:
        logger.error(f"Firestore deactivate_user_db_connection error: {e}")
        raise


# ---------------------------------------------------------------------------
# Persistent per-user query history helpers
# ---------------------------------------------------------------------------

def save_user_query_history(
    user_id: str,
    query_id: str,
    query: str,
    answer: str,
    cache_hit: bool,
    latency_ms: float,
) -> None:
    """
    Saves one query history item under the user's UID.

    Path:
      user_query_history/{user_id}/items/{query_id}
    """
    try:
        _db().collection("user_query_history").document(user_id).collection("items").document(query_id).set({
            "query_id": query_id,
            "query": query,
            "answer": answer,
            "cache_hit": bool(cache_hit),
            "latency_ms": float(latency_ms),
            "created_at": datetime.utcnow().isoformat(),
        }, merge=True)
        logger.info(f"Query history saved: uid={user_id} query_id={query_id}")
    except Exception as e:
        logger.error(f"Firestore save_user_query_history error: {e}")
        raise


def get_user_query_history(user_id: str, limit: int = 50) -> list[dict]:
    """
    Returns recent query history for a user, newest first.
    """
    try:
        docs = (
            _db()
            .collection("user_query_history")
            .document(user_id)
            .collection("items")
            .order_by("created_at", direction="DESCENDING")
            .limit(limit)
            .stream()
        )
        return [doc.to_dict() for doc in docs]
    except Exception as e:
        logger.error(f"Firestore get_user_query_history error: {e}")
        return []


def delete_user_query_history_item(user_id: str, query_id: str) -> None:
    """
    Deletes one saved query history item.
    """
    try:
        _db().collection("user_query_history").document(user_id).collection("items").document(query_id).delete()
        logger.info(f"Query history item deleted: uid={user_id} query_id={query_id}")
    except Exception as e:
        logger.error(f"Firestore delete_user_query_history_item error: {e}")
        raise


def clear_user_query_history(user_id: str, batch_size: int = 100) -> None:
    """
    Deletes all saved query history for a user.
    """
    try:
        items_ref = _db().collection("user_query_history").document(user_id).collection("items")

        while True:
            docs = list(items_ref.limit(batch_size).stream())
            if not docs:
                break

            batch = _db().batch()
            for doc in docs:
                batch.delete(doc.reference)
            batch.commit()

            if len(docs) < batch_size:
                break

        logger.info(f"All query history cleared for uid={user_id}")
    except Exception as e:
        logger.error(f"Firestore clear_user_query_history error: {e}")
        raise


# ---------------------------------------------------------------------------
# Razorpay webhook signature verification
# ---------------------------------------------------------------------------

def verify_razorpay_signature(payload_bytes: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


# ---------------------------------------------------------------------------
# Razorpay webhook handler
# ---------------------------------------------------------------------------

def handle_razorpay_webhook(payload: dict) -> None:
    """
    Handles Razorpay payment webhook events.

    payment.captured  → upgrade user to pro  ← this fires for one-time orders
    payment.failed    → log only
    subscription.*    → handled if you switch to subscriptions later

    Firebase UID must be in order notes: { user_id: FIREBASE_UID }
    """
    event = payload.get("event", "")

    if event == "payment.captured":
        entity        = payload.get("payload", {}).get("payment", {}).get("entity", {})
        notes         = entity.get("notes", {})
        user_id       = notes.get("user_id", "")
        rz_payment_id = entity.get("id", "")
        rz_order_id   = entity.get("order_id", "")

        if not user_id:
            logger.warning("payment.captured: missing user_id in notes — skipping")
            return

        upsert_subscription(user_id, "pro", "", rz_order_id, "active")
        logger.info(f"payment.captured: uid={user_id} → pro (payment={rz_payment_id})")

    elif event in ("subscription.activated", "subscription.charged"):
        entity  = payload.get("payload", {}).get("subscription", {}).get("entity", {})
        user_id = entity.get("notes", {}).get("user_id", "")
        if user_id:
            upsert_subscription(user_id, "pro", entity.get("customer_id", ""), entity.get("id", ""), "active")

    elif event in ("subscription.completed", "subscription.cancelled", "subscription.halted"):
        entity  = payload.get("payload", {}).get("subscription", {}).get("entity", {})
        user_id = entity.get("notes", {}).get("user_id", "")
        if user_id:
            cancel_subscription(user_id)

    elif event == "payment.failed":
        logger.warning("payment.failed received — no action taken")

    else:
        logger.debug(f"Unhandled Razorpay event: {event}")