"""A mocked Microsoft 365 tenant (Entra ID token endpoint + Microsoft Graph) for tests.

Scenario (relative to now): a leadership Teams meeting decides the Phoenix launch and Marcus commits to
performance testing; Marcus confirms by email noting a dependency on the API release; Tom emails that the
API release is delayed; an upcoming Phoenix review is on the calendar.
"""

from __future__ import annotations

import base64
import json
import time
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs

import httpx

TENANT = "11111111-2222-3333-4444-555555555555"
CLIENT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
ME = "yamini@contoso.example"


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.0000000")


def _b64(d: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()


def id_token(nonce: str, *, tid: str = TENANT, oid: str = "oid-yamini", email: str = ME, aud: str = CLIENT_ID) -> str:
    claims = {"aud": aud, "tid": tid, "iss": f"https://login.microsoftonline.com/{tid}/v2.0", "exp": int(time.time()) + 3600,
              "nonce": nonce, "oid": oid, "preferred_username": email, "name": "Yamini Devasena"}
    return f"{_b64({'alg': 'RS256'})}.{_b64(claims)}.sig"


def _addr(name: str, email: str) -> dict:
    return {"emailAddress": {"name": name, "address": email}}


class FakeM365:
    def __init__(self, now: datetime | None = None):
        self.now = now or datetime.now(UTC).replace(tzinfo=None)
        self.nonce = ""
        self.tid = TENANT
        self.sent: list[dict] = []
        self.graph_calls: list[str] = []
        self.throttle_once = False
        self.transcripts_forbidden = False
        self.refreshes = 0
        self.revoked = False  # the user revoked ROOK's access in Microsoft 365: Graph answers 401

    # -- Entra ID ------------------------------------------------------------------------
    def _token(self, request: httpx.Request) -> httpx.Response:
        form = parse_qs(request.content.decode())
        if form.get("grant_type") == ["refresh_token"]:
            self.refreshes += 1
            return httpx.Response(200, json={"access_token": "at-refreshed", "refresh_token": "rt-2", "expires_in": 3600})
        if form.get("code") != ["good-code"]:
            return httpx.Response(400, json={"error": "invalid_grant"})
        return httpx.Response(200, json={"access_token": "at-1", "refresh_token": "rt-1", "expires_in": 3600,
                                         "scope": form.get("scope", [""])[0], "id_token": id_token(self.nonce, tid=self.tid)})

    # -- Graph ---------------------------------------------------------------------------
    def messages(self) -> list[dict]:
        n = self.now
        launch, perf_due = n + timedelta(days=11), n + timedelta(days=1)
        return [
            {"id": "m1", "subject": "Re: Phoenix performance testing", "isDraft": False,
             "receivedDateTime": _iso(n - timedelta(days=3)) + "Z", "webLink": "https://outlook.office.com/m1",
             "from": _addr("Marcus Chen", "marcus@contoso.example"),
             "toRecipients": [_addr("Yamini Devasena", ME)], "ccRecipients": [_addr("Priya Shah", "priya@contoso.example")],
             "body": {"contentType": "text", "content":
                      f"Confirming from the leadership meeting: Engineering will complete Phoenix performance testing by "
                      f"{perf_due:%B} {perf_due.day}. Note that this depends on the platform team's API release.\n\n"
                      "From: Yamini Devasena\nSent: earlier\nCan you confirm the testing date?"}},
            {"id": "m2", "subject": "Phoenix API release update", "isDraft": False,
             "receivedDateTime": _iso(n - timedelta(hours=20)) + "Z", "webLink": "https://outlook.office.com/m2",
             "from": _addr("Tom Becker", "tom@contoso.example"), "toRecipients": [_addr("Yamini Devasena", ME),
                                                                              _addr("Marcus Chen", "marcus@contoso.example")],
             "body": {"contentType": "text", "content":
                      "Heads up: the API release for Phoenix is delayed. It is slipping by about a week; we are blocked on the security review."}},
            {"id": "m3", "subject": "Private: board prep", "isDraft": False,
             "receivedDateTime": _iso(n - timedelta(hours=10)) + "Z", "webLink": "https://outlook.office.com/m3",
             "from": _addr("David Kim", "david@contoso.example"), "toRecipients": [_addr("Yamini Devasena", ME)],
             "body": {"contentType": "text", "content": "Board prep notes for your eyes only."}},
            {"id": "draft", "subject": "unsent", "isDraft": True, "receivedDateTime": _iso(n) + "Z",
             "from": _addr("Yamini Devasena", ME), "body": {"content": "draft"}},
        ], launch

    def events(self) -> list[dict]:
        n = self.now
        past_start = n - timedelta(days=4, hours=2)
        nxt = (n + timedelta(hours=2)).replace(minute=0, second=0, microsecond=0)
        people = [_addr("Yamini Devasena", ME), _addr("Priya Shah", "priya@contoso.example"),
                  _addr("Marcus Chen", "marcus@contoso.example")]
        return [
            {"id": "e1", "iCalUId": "ical-lead", "subject": "Product Leadership Meeting", "bodyPreview": "Phoenix readiness",
             "start": {"dateTime": _iso(past_start), "timeZone": "UTC"},
             "end": {"dateTime": _iso(past_start + timedelta(hours=1)), "timeZone": "UTC"},
             "organizer": _addr("Priya Shah", "priya@contoso.example"), "attendees": people,
             "isOnlineMeeting": True, "onlineMeeting": {"joinUrl": "https://teams.microsoft.com/l/meetup-join/lead"}},
            {"id": "e2", "iCalUId": "ical-review", "subject": "Phoenix Product Review", "bodyPreview": "Launch readiness review",
             "start": {"dateTime": _iso(nxt), "timeZone": "UTC"}, "end": {"dateTime": _iso(nxt + timedelta(hours=1)), "timeZone": "UTC"},
             "organizer": _addr("Priya Shah", "priya@contoso.example"),
             "attendees": people + [_addr("Tom Becker", "tom@contoso.example")], "isOnlineMeeting": True,
             "onlineMeeting": {"joinUrl": "https://teams.microsoft.com/l/meetup-join/review"}},
            {"id": "e3", "subject": "Cancelled sync", "isCancelled": True,
             "start": {"dateTime": _iso(nxt), "timeZone": "UTC"}, "end": {"dateTime": _iso(nxt), "timeZone": "UTC"}},
        ]

    def vtt(self, launch: datetime) -> str:
        return (
            "WEBVTT\n\n00:00:01.000 --> 00:00:05.000\n"
            f"<v Priya Shah>We decided to launch Project Phoenix on {launch:%B} {launch.day}.</v>\n\n"
            "00:00:05.000 --> 00:00:08.000\n<v Priya Shah>Reason: customer contractual commitment.</v>\n\n"
            "00:00:09.000 --> 00:00:14.000\n"
            f"<v Marcus Chen>Engineering will complete Phoenix performance testing by {(self.now + timedelta(days=1)):%B} "
            f"{(self.now + timedelta(days=1)).day}.</v>\n\n"
            "00:00:15.000 --> 00:00:18.000\n<v Marcus Chen>Someone probably needs to check the Phoenix API rate limits.</v>\n"
        )

    def handler(self, request: httpx.Request) -> httpx.Response:
        url = request.url
        if url.host == "login.microsoftonline.com":
            return self._token(request)
        assert url.host == "graph.microsoft.com", url
        path = url.path.removeprefix("/v1.0")
        self.graph_calls.append(path)
        if self.revoked:
            return httpx.Response(401, json={"error": {"code": "InvalidAuthenticationToken", "message": "revoked"}})
        if self.throttle_once:
            self.throttle_once = False
            return httpx.Response(429, headers={"Retry-After": "0"})
        msgs, launch = self.messages()
        if path == "/me/messages":
            if url.params.get("page") == "2":
                return httpx.Response(200, json={"value": msgs[2:]})
            return httpx.Response(200, json={"value": msgs[:2],
                                             "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/messages?page=2"})
        if path == "/me/calendarView":
            return httpx.Response(200, json={"value": self.events()})
        if path == "/me/onlineMeetings":
            if self.transcripts_forbidden:
                return httpx.Response(403, json={"error": {"message": "Forbidden"}})
            mid = "om-lead" if "lead" in url.params.get("$filter", "") else "om-review"
            return httpx.Response(200, json={"value": [{"id": mid}]})
        if path == "/me/onlineMeetings/om-lead/transcripts":
            return httpx.Response(200, json={"value": [{"id": "tr-1"}]})
        if path == "/me/onlineMeetings/om-lead/transcripts/tr-1/content":
            return httpx.Response(200, text=self.vtt(launch))
        if path == "/me/sendMail":
            self.sent.append(json.loads(request.content))
            return httpx.Response(202)
        return httpx.Response(404, json={"error": {"message": f"unmocked {path}"}})

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self.handler)
