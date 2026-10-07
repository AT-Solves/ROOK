"""Minimal Microsoft Graph HTTP client: auth header, paging, throttling (429/503 Retry-After), typed errors."""

from __future__ import annotations

import time
from collections.abc import Callable, Iterator

import httpx

from ..base import ConnectorAuthError

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
PREFER = 'outlook.timezone="UTC", outlook.body-content-type="text"'


class GraphError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(f"Graph {status}: {message}")
        self.status = status


class GraphClient:
    def __init__(self, token: Callable[[], str], transport: httpx.BaseTransport | None = None,
                 base: str = GRAPH_BASE, max_retries: int = 3, sleep: Callable[[float], None] = time.sleep):
        self._token, self._base, self._max_retries, self._sleep = token, base, max_retries, sleep
        self._http = httpx.Client(transport=transport, timeout=30)

    def _request(self, method: str, url: str, **kw) -> httpx.Response:
        if not url.startswith("http"):
            url = self._base + url
        for attempt in range(self._max_retries + 1):
            r = self._http.request(method, url, headers={"Authorization": f"Bearer {self._token()}", "Prefer": PREFER}, **kw)
            if r.status_code in (429, 503, 504) and attempt < self._max_retries:
                self._sleep(min(float(r.headers.get("Retry-After", 2 ** attempt)), 30.0))
                continue
            if r.status_code == 401:
                raise ConnectorAuthError("Microsoft 365 rejected the stored credentials; reconnect Microsoft 365.")
            if r.status_code >= 400:
                try:
                    msg = r.json().get("error", {}).get("message", r.text[:200])
                except ValueError:
                    msg = r.text[:200]
                raise GraphError(r.status_code, msg)
            return r
        raise GraphError(429, "throttled")  # pragma: no cover — loop always returns or raises

    def get(self, path: str, params: dict | None = None) -> dict:
        return self._request("GET", path, params=params).json()

    def get_text(self, path: str, params: dict | None = None) -> str:
        return self._request("GET", path, params=params).text

    def post(self, path: str, json: dict) -> httpx.Response:
        return self._request("POST", path, json=json)

    def iterate(self, path: str, params: dict | None = None, limit: int = 500) -> Iterator[dict]:
        """Yield items across @odata.nextLink pages, up to ``limit``."""
        count, url, p = 0, path, params
        while url:
            page = self.get(url, p)
            for item in page.get("value", []):
                yield item
                count += 1
                if count >= limit:
                    return
            url, p = page.get("@odata.nextLink"), None
