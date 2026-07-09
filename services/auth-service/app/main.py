import os
import json
import base64
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Info

logger = logging.getLogger("auth-service")

# Local development escape hatch: when enabled, skip Firebase verification so the
# stack can run without the admin service-account credentials. NEVER enable in
# production — it trusts the caller's token without checking its signature.
DEV_AUTH = os.environ.get("DEV_AUTH", "").lower() in ("1", "true", "yes")

app_fb = None
if not DEV_AUTH:
    import firebase_admin
    from firebase_admin import auth as firebase_auth, credentials

    project_id = os.environ["FIREBASE_PROJECT_ID"]
    if os.environ.get("FIREBASE_AUTH_EMULATOR_HOST"):
        # Emulator mode: no signing key needed; tokens are verified against the
        # emulator (the Admin SDK skips the signature check).
        app_fb = firebase_admin.initialize_app(options={"projectId": project_id})
    else:
        cred = credentials.Certificate(os.environ["GOOGLE_APPLICATION_CREDENTIALS"])
        app_fb = firebase_admin.initialize_app(cred, options={"projectId": project_id})
else:
    logger.warning("DEV_AUTH enabled: Firebase token verification is DISABLED.")

app = FastAPI(title="Auth service", version="1.0.0")

Instrumentator().instrument(app).expose(app)
Info("build", "Service build info").info({"version": "1.0.0", "service": "auth-service"})


class StatusResponse(BaseModel):
    status: str = "ok"


def _uid_from_unverified_token(token: str) -> str | None:
    """Decode a JWT payload WITHOUT verifying the signature (dev mode only)."""
    try:
        payload_b64 = token.split(".")[1]
        payload_b64 += "=" * (-len(payload_b64) % 4)  # restore base64 padding
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        return payload.get("user_id") or payload.get("sub") or payload.get("uid")
    except Exception:
        return None


@app.get(
    "/verify",
    tags=["Auth"],
    summary="Traefik forward-auth: validate the Firebase ID token and emit X-User-Sub",
)
async def verify(request: Request):
    auth_header = request.headers.get("Authorization", "")

    if DEV_AUTH:
        # Trust the logged-in user's uid from the (unverified) token so data
        # stays per-user; fall back to a fixed dev user when there is no token.
        uid = None
        if auth_header.startswith("Bearer "):
            uid = _uid_from_unverified_token(auth_header.removeprefix("Bearer "))
        return JSONResponse(status_code=200, headers={"X-User-Sub": uid or "dev-user"}, content={})

    if not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401, content={"error": "Missing or invalid Authorization header"}
        )
    token = auth_header.removeprefix("Bearer ")
    try:
        decoded = firebase_auth.verify_id_token(token, app=app_fb)
        return JSONResponse(
            status_code=200,
            headers={"X-User-Sub": decoded["uid"]},
            content={},
        )
    except Exception as e:
        return JSONResponse(status_code=401, content={"error": str(e)})


@app.get("/health", tags=["Auth"], response_model=StatusResponse, summary="Health check")
async def health():
    return {"status": "ok"}
