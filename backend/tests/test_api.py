from tests.conftest import login


def test_requires_auth(client):
    assert client.get("/api/brief").status_code == 401


def test_brief(client):
    h = login(client)
    b = client.get("/api/brief", headers=h).json()
    assert b["greeting"].endswith("Yamini")
    labels = {a["label"] for a in b["attention"]}
    assert {"Decision required", "Follow-up overdue", "Risk detected"} <= labels
    assert b["counts"]["meetings_today"] == 4 and b["counts"]["prep_required"] >= 1
    assert any(p["name"] == "David Kim" and p["days_since"] >= 14 for p in b["people"])


def test_ask_answers_with_evidence(client):
    h = login(client)
    r = client.post("/api/ask", json={"question": "Why is the launch at risk?"}, headers=h).json()
    assert r["intent"] == "why_risk" and r["sources"]
    r = client.post("/api/ask", json={"question": "What did we decide about the office move?"}, headers=h).json()
    assert r["answer"].startswith("I couldn't find enough evidence")


def test_permissions_hide_restricted_sources(client):
    """The compensation email is restricted to David and Sarah: not even the CEO sees it via ROOK."""
    h = login(client)
    r = client.post("/api/ask", json={"question": "executive compensation adjustments"}, headers=h).json()
    assert all("compensation" not in s["title"].lower() for s in r["sources"])


def test_member_cannot_see_restricted_or_admin(client):
    h = login(client, "marcus@acme.example")
    assert client.put("/api/admin/policy", json={"send_email": "auto"}, headers=h).status_code == 403
    # Marcus was not on the CFO email thread, so its derived context is not visible to him.
    titles = [c["title"] for c in client.get("/api/brief", headers=h).json()["changes"]]
    assert all("pricing" not in t.lower() for t in titles)


def test_followup_draft_requires_approval_then_executes(client):
    h = login(client)
    overdue = [c for c in client.get("/api/commitments?scope=waiting", headers=h).json() if c["status"] == "overdue"][0]
    draft = client.post(f"/api/commitments/{overdue['id']}/followup", json={"tone": "diplomatic"}, headers=h).json()
    assert draft["status"] == "draft" and "Sarah" in draft["payload"]["body"]
    done = client.post(f"/api/actions/{draft['id']}/approve", headers=h).json()
    assert done["status"] == "executed"
    actions = [a["action"] for a in client.get("/api/audit", headers=h).json()]
    assert "action.prepared" in actions and "action.executed" in actions


def test_policy_never_blocks_execution(client):
    h = login(client)
    client.put("/api/admin/policy", json={"send_email": "never"}, headers=h)
    c = client.get("/api/commitments?scope=waiting", headers=h).json()[0]
    draft = client.post(f"/api/commitments/{c['id']}/followup", json={}, headers=h).json()
    assert client.post(f"/api/actions/{draft['id']}/approve", headers=h).json()["status"] == "blocked"


def test_transcript_upload_extracts_intelligence(client):
    h = login(client)
    m = [m for m in client.get("/api/meetings", headers=h).json() if m["title"] == "Payments Migration steering"][0]
    text = ("Lena Park: We decided to use a phased cutover for the payments migration.\n"
            "Tom Becker: I'll publish the cutover runbook by tomorrow.")
    r = client.post(f"/api/meetings/{m['id']}/transcript", json={"text": text}, headers=h).json()
    assert r["decisions"][0]["statement"].startswith("Use a phased cutover")
    assert r["commitments"][0]["owner"] == "Tom Becker"
    risks = client.get("/api/risks", headers=h).json()
    assert not any(x["rule"] == "unresolved_discussion" for x in risks), "a decision closes the repeated-discussion risk"


def test_accept_inferred_commitment(client):
    h = login(client)
    proposed = client.get("/api/commitments?scope=proposed", headers=h).json()[0]
    r = client.post(f"/api/commitments/{proposed['id']}/accept", json={"owner_name": "Tom Becker"}, headers=h).json()
    assert r["status"] == "open" and r["owner"] == "Tom Becker" and r["owner_email"] == "tom@acme.example"


def test_sources_catalog_and_unconfigured_sync(client):
    h = login(client)
    cat = {c["kind"]: c for c in client.get("/api/sources", headers=h).json()}
    assert cat["demo"]["connection"]["status"] == "connected"
    assert "ROOK_GOOGLE_CLIENT_ID" in cat["gmail"]["required_env"]
    conn = client.post("/api/sources", json={"kind": "gmail"}, headers=h).json()
    assert client.post(f"/api/sources/{conn['id']}/sync", headers=h).status_code == 409


def test_signal_access_check(client):
    h = login(client)
    restricted = [s for s in range(1, 30) if client.get(f"/api/signals/{s}", headers=h).status_code == 403]
    assert restricted, "the restricted compensation email must be refused"


def test_only_the_sender_can_approve_external_communication(client):
    marcus, yamini = login(client, "marcus@acme.example"), login(client)
    c = client.get("/api/commitments?scope=waiting", headers=marcus).json()[0]
    draft = client.post(f"/api/commitments/{c['id']}/followup", json={}, headers=marcus).json()
    r = client.post(f"/api/actions/{draft['id']}/approve", headers=yamini)  # an admin, but not the sender
    assert r.status_code == 409 and "person sending" in r.json()["detail"]


def test_request_logs_exclude_query_strings_and_content(client, caplog):
    import json
    import logging

    from rook.logging import JsonFormatter

    with caplog.at_level(logging.INFO, logger="rook.http"):
        client.get("/api/auth/microsoft/callback?code=SECRET-CODE&state=x", follow_redirects=False)
    lines = [JsonFormatter().format(r) for r in caplog.records if r.name == "rook.http"]
    assert lines and all("SECRET-CODE" not in line for line in lines)
    assert json.loads(lines[-1])["path"] == "/api/auth/microsoft/callback"


def test_health(client):
    assert client.get("/api/health").json() == {"ok": True, "llm": "rules"}


def test_detail_endpoints(client):
    h = login(client)
    d = next(d for d in client.get("/api/decisions", headers=h).json() if d["code"] == "D-1001")
    dd = client.get(f"/api/decisions/{d['id']}", headers=h).json()
    assert dd["statement"] == d["statement"] and any(r["rule"] == "dependency_delay" for r in dd["related_risks"])
    perf = next(c for c in client.get("/api/commitments", headers=h).json() if "performance testing" in c["description"])
    cd = client.get(f"/api/commitments/{perf['id']}", headers=h).json()
    assert cd["related_risks"] and cd["followups"] == []
    client.post(f"/api/commitments/{perf['id']}/followup", json={}, headers=h)
    assert len(client.get(f"/api/commitments/{perf['id']}", headers=h).json()["followups"]) == 1
    risk = next(r for r in client.get("/api/risks", headers=h).json() if r["rule"] == "dependency_delay")
    rd = client.get(f"/api/risks/{risk['id']}", headers=h).json()
    assert rd["related_commitments"][0]["id"] == perf["id"] and rd["related_decisions"][0]["code"] == "D-1001"
    assert client.get("/api/risks/999999", headers=h).status_code == 404
    assert client.get(f"/api/decisions/{d['id']}").status_code == 401


def test_detail_hides_restricted_items_from_non_participants(client):
    """A transcript of Yamini's 1:1 with the CFO is restricted to its attendees; Marcus must get 404, not 403."""
    yamini, marcus = login(client), login(client, "marcus@acme.example")
    m = next(m for m in client.get("/api/meetings", headers=yamini).json() if m["title"].startswith("1:1 with David"))
    r = client.post(f"/api/meetings/{m['id']}/transcript", headers=yamini,
                    json={"text": "David Kim: We decided to freeze hiring in Q4.\nDavid Kim: I'll send the revised budget by tomorrow."}).json()
    did, cid = r["decisions"][0]["id"], r["commitments"][0]["id"]
    assert client.get(f"/api/decisions/{did}", headers=yamini).status_code == 200
    assert client.get(f"/api/decisions/{did}", headers=marcus).status_code == 404
    assert client.get(f"/api/commitments/{cid}", headers=marcus).status_code == 404
    assert client.get(f"/api/meetings/{m['id']}/prep", headers=marcus).status_code == 404


def test_timezone_accepts_legacy_browser_aliases(client):
    """Chromium/Edge report India as 'Asia/Calcutta'; it must be accepted, not rejected with 422."""
    h = login(client)
    for tz in ("Asia/Calcutta", "Asia/Kolkata", "America/New_York"):
        r = client.patch("/api/me", json={"timezone": tz}, headers=h)
        assert r.status_code == 200 and r.json()["timezone"] == tz
    assert client.patch("/api/me", json={"timezone": "Mars/Olympus"}, headers=h).status_code == 422
