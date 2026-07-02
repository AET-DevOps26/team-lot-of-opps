import importlib
import sys

import pytest
from prometheus_client import REGISTRY


def _reload_auth_app(monkeypatch, dev_auth: bool):
    monkeypatch.setenv("DEV_AUTH", "1" if dev_auth else "0")

    # main.py registers Prometheus collectors as an import-time side effect;
    # clear the registry before each reimport or re-registration raises
    # "Duplicated timeseries in CollectorRegistry".
    for collector in list(REGISTRY._collector_to_names):
        REGISTRY.unregister(collector)

    if not dev_auth:
        monkeypatch.setenv("FIREBASE_PROJECT_ID", "test-project")
        monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "test-credentials.json")
        import firebase_admin
        from firebase_admin import credentials

        monkeypatch.setattr(credentials, "Certificate", lambda path: object())
        monkeypatch.setattr(firebase_admin, "initialize_app", lambda cred, options=None: object())

    sys.modules.pop("app.main", None)
    return importlib.import_module("app.main")


@pytest.fixture
def dev_auth_app(monkeypatch):
    return _reload_auth_app(monkeypatch, dev_auth=True)


@pytest.fixture
def firebase_app(monkeypatch):
    return _reload_auth_app(monkeypatch, dev_auth=False)
