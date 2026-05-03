import base64
import json
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request


def get_user_identifier(request: Request) -> str:
    """
    Identify the user for rate limiting.
    Decodes Firebase UID from Authorization Bearer token (without signature verification).
    Falls back to client IP if no valid token is present.
    """
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        try:
            parts = token.split(".")
            if len(parts) == 3:
                payload_b64 = parts[1]
                payload_b64 += "=" * (4 - len(payload_b64) % 4)
                payload = json.loads(base64.b64decode(payload_b64))
                uid = payload.get("user_id") or payload.get("sub", "")
                if uid:
                    return uid
        except Exception:
            pass
    return get_remote_address(request)


def get_dynamic_limit(request: Request) -> str:
    """Returns per-minute rate limit string based on the requesting user's plan."""
    try:
        from billing import get_user_plan, get_plan_limits
        uid = get_user_identifier(request)
        plan = get_user_plan(uid)
        rate = get_plan_limits(plan).get("rate_limit_per_min", 10)
        return f"{rate}/minute"
    except Exception:
        return "10/minute"


limiter = Limiter(key_func=get_user_identifier)