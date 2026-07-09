from fastapi.testclient import TestClient


def test_verify_missing_header_returns_401(firebase_app):
    client = TestClient(firebase_app.app)
    r = client.get("/verify")
    assert r.status_code == 401
    assert "error" in r.json()


def test_verify_valid_token_returns_uid(firebase_app, monkeypatch):
    monkeypatch.setattr(
        firebase_app.firebase_auth, "verify_id_token", lambda token, app=None: {"uid": "user-42"}
    )
    client = TestClient(firebase_app.app)
    r = client.get("/verify", headers={"Authorization": "Bearer sometoken"})
    assert r.status_code == 200
    assert r.headers["X-User-Sub"] == "user-42"


def test_verify_invalid_token_returns_401(firebase_app, monkeypatch):
    def raise_err(token, app=None):
        raise ValueError("invalid token")

    monkeypatch.setattr(firebase_app.firebase_auth, "verify_id_token", raise_err)
    client = TestClient(firebase_app.app)
    r = client.get("/verify", headers={"Authorization": "Bearer bad"})
    assert r.status_code == 401
    assert r.json() == {"error": "invalid token"}


def test_app_initializes_against_firebase_auth_emulator(firebase_emulator_app):
    # FIREBASE_AUTH_EMULATOR_HOST set -> firebase_admin.initialize_app() is called
    # with no certificate (the emulator skips signature verification). This just
    # exercises that startup path; request handling behaves like firebase_app.
    client = TestClient(firebase_emulator_app.app)
    r = client.get("/health")
    assert r.status_code == 200
