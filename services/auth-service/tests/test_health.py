from fastapi.testclient import TestClient


def test_health_ok(dev_auth_app):
    client = TestClient(dev_auth_app.app)
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
