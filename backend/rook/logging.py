"""Structured JSON logging without user content (rook-observability, lightweight MVP baseline).

Operational logs carry ids, timings and status codes only — never message bodies, quotes, tokens or
query strings. The tenant-visible compliance record is the AuditLog table, which is separate.
"""

from __future__ import annotations

import contextvars
import json
import logging
import time
import uuid

request_id: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        data = {"ts": round(record.created, 3), "level": record.levelname, "logger": record.name,
                "msg": record.getMessage(), "request_id": request_id.get()}
        for key in ("method", "path", "status", "duration_ms", "org_id"):
            if hasattr(record, key):
                data[key] = getattr(record, key)
        if record.exc_info:
            data["exc"] = record.exc_info[0].__name__ if record.exc_info[0] else "error"
        return json.dumps(data)


def configure(level: int = logging.INFO) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level)
    logging.getLogger("httpx").setLevel(logging.WARNING)  # its INFO lines include full URLs with query strings


def install_middleware(app) -> None:
    log = logging.getLogger("rook.http")

    @app.middleware("http")
    async def _log_requests(request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        token = request_id.set(rid)
        start = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            response.headers["x-request-id"] = rid
            return response
        finally:
            # path only (no query string: it can contain OAuth codes)
            log.info("request", extra={"method": request.method, "path": request.url.path, "status": status,
                                       "duration_ms": round((time.perf_counter() - start) * 1000, 1)})
            request_id.reset(token)
