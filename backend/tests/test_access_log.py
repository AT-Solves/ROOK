"""HTTP access logs never carry OAuth codes, state, tokens or other query-string credentials.

These tests run a real uvicorn server with uvicorn's own logging configuration and read what its access logger
(``uvicorn.access``) and ROOK's request log (``rook.http``) actually print.
"""

import io
import logging
import socket
import threading
import time

import httpx
import pytest
import uvicorn
from fastapi import FastAPI
from uvicorn.config import LOGGING_CONFIG
from uvicorn.logging import AccessFormatter

from rook.logging import AccessLogWithoutQuery, JsonFormatter, configure, install_middleware

SECRETS = ("SECRET_CODE", "SECRET_STATE", "SECRET_BEARER", "SECRET_COOKIE", "SECRET_ID_TOKEN")


def _app() -> FastAPI:
    app = FastAPI()
    install_middleware(app)

    @app.get("/api/auth/microsoft/callback")
    def callback():
        return {}

    @app.get("/api/items")
    def items():
        return []

    return app


def _capture(logger_name: str, formatter: logging.Formatter) -> tuple[io.StringIO, logging.Handler]:
    out = io.StringIO()
    handler = logging.StreamHandler(out)
    handler.setFormatter(formatter)
    logging.getLogger(logger_name).addHandler(handler)
    return out, handler


@pytest.fixture()
def served():
    """Run a real uvicorn server (uvicorn's default logging config, as the CLI applies it) and capture both logs."""
    configure()  # what rook.main does at import
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(_app(), host="127.0.0.1", port=port, log_config=LOGGING_CONFIG))
    access, access_handler = _capture("uvicorn.access", AccessFormatter('%(client_addr)s - "%(request_line)s" %(status_code)s'))
    app_log, app_handler = _capture("rook.http", JsonFormatter())
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    for _ in range(100):
        if server.started:
            break
        time.sleep(0.05)
    try:
        yield f"http://127.0.0.1:{port}", access, app_log
    finally:
        server.should_exit = True
        thread.join(timeout=5)
        logging.getLogger("uvicorn.access").removeHandler(access_handler)
        logging.getLogger("rook.http").removeHandler(app_handler)


def test_oauth_callback_code_and_state_never_reach_the_access_log(served):
    base, access, app_log = served
    r = httpx.get(f"{base}/api/auth/microsoft/callback?code=SECRET_CODE&state=SECRET_STATE")
    assert r.status_code == 200
    line = access.getvalue()
    assert '"GET /api/auth/microsoft/callback HTTP/1.1" 200' in line  # still logged, path only
    assert "SECRET_CODE" not in line and "SECRET_STATE" not in line and "?" not in line
    assert "SECRET_CODE" not in app_log.getvalue() and "SECRET_STATE" not in app_log.getvalue()


def test_other_query_strings_are_dropped_too(served):
    base, access, _ = served
    httpx.get(f"{base}/api/items?view=compact&id_token=SECRET_ID_TOKEN")
    line = access.getvalue()
    assert '"GET /api/items HTTP/1.1" 200' in line
    assert "view=compact" not in line and "SECRET_ID_TOKEN" not in line


def test_headers_and_cookies_are_not_logged(served):
    base, access, app_log = served
    httpx.get(f"{base}/api/items", headers={"Authorization": "Bearer SECRET_BEARER", "Cookie": "session=SECRET_COOKIE"})
    for text in (access.getvalue(), app_log.getvalue()):
        assert not any(secret in text for secret in SECRETS)


def test_request_logging_still_works(served):
    base, access, app_log = served
    httpx.get(f"{base}/api/items?page=2")
    assert '"GET /api/items HTTP/1.1" 200' in access.getvalue()
    assert '"logger": "rook.http"' in app_log.getvalue()
    assert '"method": "GET", "path": "/api/items", "status": 200' in app_log.getvalue()


def test_filter_installed_once_and_leaves_other_records_alone():
    configure()
    configure()
    access = logging.getLogger("uvicorn.access")
    assert sum(isinstance(f, AccessLogWithoutQuery) for f in access.filters) == 1
    record = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, "no args here", None, None)
    assert AccessLogWithoutQuery().filter(record) and record.getMessage() == "no args here"
