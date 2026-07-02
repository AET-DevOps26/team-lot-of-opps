import base64
import json

from fastapi.testclient import TestClient


def _fake_token(payload: dict) -> str:
    def b64(d: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()

    return f"{b64({'alg': 'none'})}.{b64(payload)}.sig"


def test_verify_no_token_defaults_to_dev_user(dev_auth_app):
    client = TestClient(dev_auth_app.app)
    r = client.get("/verify")
    assert r.status_code == 200
    assert r.headers["X-User-Sub"] == "dev-user"


def test_verify_uses_uid_from_unverified_token(dev_auth_app):
    client = TestClient(dev_auth_app.app)
    token = _fake_token({"user_id": "abc123"})
    r = client.get("/verify", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.headers["X-User-Sub"] == "abc123"


def test_verify_malformed_token_falls_back_to_dev_user(dev_auth_app):
    client = TestClient(dev_auth_app.app)
    r = client.get("/verify", headers={"Authorization": "Bearer not-a-jwt"})
    assert r.status_code == 200
    assert r.headers["X-User-Sub"] == "dev-user"
