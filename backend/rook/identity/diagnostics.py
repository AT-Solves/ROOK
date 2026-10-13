"""Safe diagnostics for Microsoft OAuth failures.

Microsoft's error replies explain why a sign-in or token exchange failed (an ``AADSTS`` code, request and correlation
ids), but its free-text ``error_description`` can repeat request details. So nothing is logged as received: only an
allow-list of fields, each checked against a strict shape (an OAuth error word, an ``AADSTS`` number, GUIDs), is
logged; anything else is dropped. Codes, tokens, secrets, PKCE verifiers, nonces, state, URLs, headers and the raw
response or description never reach the log.
"""

from __future__ import annotations

import logging
import re

log = logging.getLogger("rook.identity")

_OAUTH_ERROR = re.compile(r"[a-z_]{1,64}")
_AADSTS = re.compile(r"\bAADSTS(\d{1,8})\b")
_GUID = r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
_TRACE_ID = re.compile(rf"Trace ID:\s*({_GUID})")
_CORRELATION_ID = re.compile(rf"Correlation ID:\s*({_GUID})")


def _oauth_error(value) -> str | None:
    if not value:
        return None
    return value if isinstance(value, str) and _OAUTH_ERROR.fullmatch(value) else "unrecognized"


def _guid(value) -> str | None:
    return value.lower() if isinstance(value, str) and re.fullmatch(_GUID, value) else None


def _aadsts(codes, description) -> str | None:
    if isinstance(codes, list) and codes and isinstance(codes[0], int) and not isinstance(codes[0], bool) \
            and 0 < codes[0] < 10**8:
        return f"AADSTS{codes[0]}"
    match = _AADSTS.search(description) if isinstance(description, str) else None
    return f"AADSTS{match.group(1)}" if match else None


def _from_description(pattern: re.Pattern, description) -> str | None:
    match = pattern.search(description) if isinstance(description, str) else None
    return match.group(1).lower() if match else None


def oauth_failure(operation: str, *, account: str | None = None, error=None, error_codes=None, description=None,
                  http_status: int | None = None, request_id=None, correlation_id=None) -> None:
    """Log one Microsoft OAuth failure. ``operation`` and ``account`` are ROOK's own values; everything else comes
    from Microsoft and is reduced to the allow-listed, shape-checked fields. ``description`` is only searched for
    the AADSTS code and Microsoft's ids; it is never logged."""
    fields = {
        "provider": "microsoft",
        "operation": operation,
        "account": account if account in ("work", "personal") else None,
        "oauth_error": _oauth_error(error),
        "aadsts_code": _aadsts(error_codes, description),
        "http_status": http_status if isinstance(http_status, int) else None,
        "microsoft_request_id": _guid(request_id) or _from_description(_TRACE_ID, description),
        "microsoft_correlation_id": _guid(correlation_id) or _from_description(_CORRELATION_ID, description),
    }
    log.warning("Microsoft OAuth failure", extra={k: v for k, v in fields.items() if v is not None})
