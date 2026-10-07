"""MVP success definition (product owner, 2026-10-07), steps 1–11, through a mocked Microsoft 365 tenant."""

import pytest

from rook.trust import FACT, INFERENCE, RECOMMENDATION
from tests.conftest import connect_m365, entra_sign_in


@pytest.fixture()
def tenant(client, session_factory, m365, monkeypatch):
    monkeypatch.setenv("MICROSOFT_ENABLE_SEND", "true")
    h = entra_sign_in(client, session_factory, m365)
    client.patch("/api/me", json={"timezone": "UTC"}, headers=h)
    # Projects are ROOK concepts defined by an admin (ADR-0003).
    assert client.post("/api/projects", json={"name": "Project Phoenix", "aliases": ["phoenix"]}, headers=h).status_code == 200
    cid = connect_m365(client, session_factory, m365, h)  # step 1: user connects Microsoft 365
    return h, cid


def test_mvp_success_loop(client, m365, tenant):
    h, cid = tenant

    # 2. ROOK obtains permitted email / calendar / meeting information
    report = client.post(f"/api/sources/{cid}/sync", headers=h).json()
    assert report["signals_new"] == 4 and report["meetings_upserted"] == 2

    # 3. Executive brief
    brief = client.get("/api/brief", headers=h).json()
    assert brief["greeting"].endswith("Yamini")
    assert any(a["type"] == "risk" and "Phoenix" in a["title"] for a in brief["attention"])

    # 4. Upcoming meeting → contextual preparation
    review = next(m for m in client.get("/api/meetings", headers=h).json() if m["title"] == "Phoenix Product Review")
    assert not review["past"] and review["prep_reasons"]
    prep = client.get(f"/api/meetings/{review['id']}/prep", headers=h).json()
    assert prep["decisions"] and prep["open_commitments"] and prep["risks"] and prep["suggested_questions"]

    # 5. Explicit decision and its associated commitments
    decision = next(d for d in client.get("/api/decisions", headers=h).json() if "Launch Project Phoenix" in d["statement"])
    assert decision["claim_type"] == FACT and decision["rationale"] == "Customer contractual commitment"
    assert decision["evidence"][0]["channel"] == "Microsoft Teams"
    assert any("performance testing" in c["description"] for c in decision["related_commitments"])

    # 6. Commitments tracked — the Teams statement and Outlook confirmation are one commitment with two sources
    perf = next(c for c in client.get("/api/commitments", headers=h).json() if "performance testing" in c["description"])
    assert perf["status"] == "open" and perf["owner"] == "Marcus Chen" and perf["due_date"]
    assert {e["channel"] for e in perf["evidence"]} == {"Microsoft Teams", "Outlook"}
    inferred = [c for c in client.get("/api/commitments?scope=proposed", headers=h).json()]
    assert inferred and all(c["claim_type"] == INFERENCE for c in inferred)

    # 7–8. Dependency delayed → risk detected and explained, with evidence
    risk = next(r for r in client.get("/api/risks", headers=h).json() if r["rule"] == "dependency_delay")
    assert risk["level"] == "high" and "API release" in risk["explanation"] and decision["code"] in risk["explanation"]
    assert any(e["author"] == "Tom Becker" for e in risk["evidence"])
    assert risk["recommended_action"]["claim_type"] == RECOMMENDATION

    # 9. "What changed and what should I do?" → one evidence-backed answer
    ans = client.post("/api/ask", json={"question": "What changed and what should I do?"}, headers=h).json()
    assert ans["intent"] == "changed_and_do"
    assert any("API release" in c["text"] and c["claim_type"] == FACT for c in ans["what_changed"])
    assert ans["why_it_matters"][0]["claim_type"] == INFERENCE and decision["code"] in ans["why_it_matters"][0]["text"]
    rec = ans["recommended_actions"][0]
    assert rec["claim_type"] == RECOMMENDATION and rec["action"] == {"type": "draft_followup", "commitment_id": perf["id"]}
    assert ans["sources"] and ans["confidence"] in {"high", "medium", "low"}

    # 10. Follow-up draft on request, with supporting context
    draft = client.post(f"/api/commitments/{perf['id']}/followup", json={"risk_id": risk["id"]}, headers=h).json()
    assert draft["status"] == "draft" and draft["payload"]["to"] == ["marcus@contoso.example"]
    assert "recovery plan" in draft["payload"]["body"] and draft["payload"]["context"]["evidence"]
    assert m365.sent == [], "nothing is sent before approval"

    # 11. Explicit approval → only then is the email sent from the user's mailbox
    done = client.post(f"/api/actions/{draft['id']}/approve", headers=h).json()
    assert done["status"] == "executed" and len(m365.sent) == 1
    assert m365.sent[0]["message"]["toRecipients"][0]["emailAddress"]["address"] == "marcus@contoso.example"
    audit = [a["action"] for a in client.get("/api/audit", headers=h).json()]
    assert audit.index("action.executed") < audit.index("action.prepared")  # newest first: prepared happened before


def test_no_send_when_sending_disabled(client, m365, tenant, monkeypatch):
    h, cid = tenant
    monkeypatch.setenv("MICROSOFT_ENABLE_SEND", "false")
    client.post(f"/api/sources/{cid}/sync", headers=h)
    perf = next(c for c in client.get("/api/commitments", headers=h).json() if "performance testing" in c["description"])
    draft = client.post(f"/api/commitments/{perf['id']}/followup", json={}, headers=h).json()
    done = client.post(f"/api/actions/{draft['id']}/approve", headers=h).json()
    assert done["status"] == "approved" and "copy the draft" in done["result"] and m365.sent == []


def test_auto_send_policy_is_rejected(client, tenant):
    h, _ = tenant
    r = client.put("/api/admin/policy", json={"send_email": "auto"}, headers=h)
    assert r.status_code == 422 and "explicit approval" in r.json()["detail"]
