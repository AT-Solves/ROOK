"""Tenant isolation (R20, ADR-0011): another organization's records behave as if they do not exist, on every route.

The victim is the demo organization (Acme), which has meetings, decisions, commitments, risks, projects, signals,
a connector, a follow-up draft and audit entries. The attacker is an administrator of a different organization who even
shares a victim's email address, so the tests also prove that email never crosses an organization boundary.
"""

import pytest
from sqlalchemy import select

from rook.models import (
    ActionProposal,
    Commitment,
    Connector,
    Decision,
    Meeting,
    Organization,
    Project,
    Risk,
    Signal,
    User,
)
from tests.conftest import connect_m365, entra_sign_in, login, session_for
from tests.fixtures.m365 import OTHER_TENANT

VICTIM_MARKERS = ("Phoenix", "acme.example", "Acme Robotics", "Northwind")


@pytest.fixture()
def world(client, session_factory):
    victim = login(client)  # yamini@acme.example, admin of the demo organization
    with session_factory() as db:
        acme = db.scalar(select(Organization).where(Organization.is_demo.is_(True)))
        overdue = db.scalar(select(Commitment).where(Commitment.org_id == acme.id,
                                                     Commitment.description.contains("financial forecast")))
        overdue_status = overdue.status
    draft = client.post(f"/api/commitments/{overdue.id}/followup", json={}, headers=victim)
    assert draft.status_code == 200, draft.text
    with session_factory() as db:
        other = Organization(name="Fabrikam", slug="fabrikam", identity_provider="microsoft", tenant_id=OTHER_TENANT,
                             status="active", ai_policy={})
        db.add(other)
        db.flush()
        eve = User(org_id=other.id, email="yamini@acme.example", name="Eve", role="admin",
                   external_subject="microsoft:oid-eve")
        db.add(eve)
        db.commit()
        ids = {
            "meeting": db.scalar(select(Meeting.id).where(Meeting.org_id == acme.id)),
            "decision": db.scalar(select(Decision.id).where(Decision.org_id == acme.id)),
            "commitment": overdue.id,
            "risk": db.scalar(select(Risk.id).where(Risk.org_id == acme.id, Risk.status == "open")),
            "project": db.scalar(select(Project.id).where(Project.org_id == acme.id)),
            "signal": db.scalar(select(Signal.id).where(Signal.org_id == acme.id)),
            "connector": db.scalar(select(Connector.id).where(Connector.org_id == acme.id)),
            "action": draft.json()["id"],
        }
        attacker = session_for(eve)
    return {"victim": victim, "attacker": attacker, "ids": ids, "acme": acme.id, "commitment_status": overdue_status}


ID_ROUTES = [
    ("get", "/api/meetings/{meeting}/prep", None),
    ("get", "/api/meetings/{meeting}/intelligence", None),
    ("post", "/api/meetings/{meeting}/transcript", {"text": "Eve: We decided to cancel everything."}),
    ("get", "/api/decisions/{decision}", None),
    ("get", "/api/commitments/{commitment}", None),
    ("post", "/api/commitments/{commitment}/accept", {}),
    ("post", "/api/commitments/{commitment}/dismiss", None),
    ("post", "/api/commitments/{commitment}/complete", None),
    ("post", "/api/commitments/{commitment}/followup", {}),
    ("get", "/api/risks/{risk}", None),
    ("post", "/api/risks/{risk}/acknowledge", None),
    ("get", "/api/projects/{project}", None),
    ("get", "/api/signals/{signal}", None),
    ("post", "/api/sources/{connector}/sync", None),
    ("post", "/api/sources/{connector}/disconnect", None),
    ("patch", "/api/actions/{action}", {"subject": "pwned"}),
    ("post", "/api/actions/{action}/approve", None),
    ("post", "/api/actions/{action}/reject", None),
]


@pytest.mark.parametrize("method, path, body", ID_ROUTES, ids=[f"{m.upper()} {p}" for m, p, _ in ID_ROUTES])
def test_another_organizations_ids_do_not_exist(client, session_factory, world, method, path, body):
    url = path.format(**world["ids"])
    r = getattr(client, method)(url, headers=world["attacker"], **({"json": body} if body is not None else {}))
    assert r.status_code == 404, (url, r.status_code, r.text)
    assert not any(m in r.text for m in VICTIM_MARKERS)


def test_failed_attempts_change_nothing_in_the_victim_organization(client, session_factory, world):
    for method, path, body in ID_ROUTES:
        getattr(client, method)(path.format(**world["ids"]), headers=world["attacker"],
                                **({"json": body} if body is not None else {}))
    ids = world["ids"]
    with session_factory() as db:
        assert db.get(Commitment, ids["commitment"]).status == world["commitment_status"]
        assert db.get(Risk, ids["risk"]).status == "open"
        assert db.get(Connector, ids["connector"]).status == "connected"
        action = db.get(ActionProposal, ids["action"])
        assert action.status == "draft" and action.payload.get("subject") != "pwned"
        assert not db.scalars(select(Signal).where(Signal.body.contains("cancel everything"))).all()


LIST_ROUTES = [
    ("get", "/api/meetings", None),
    ("get", "/api/decisions", None),
    ("get", "/api/commitments?scope=all", None),
    ("get", "/api/risks", None),
    ("get", "/api/projects", None),
    ("get", "/api/people", None),
    ("get", "/api/sources", None),
    ("get", "/api/actions", None),
    ("get", "/api/audit", None),
    ("get", "/api/admin/policy", None),
    ("get", "/api/brief", None),
    ("get", "/api/me", None),
    ("post", "/api/ask", {"question": "Why is Phoenix at risk and who owns the Northwind follow-up?"}),
]


@pytest.mark.parametrize("method, path, body", LIST_ROUTES, ids=[f"{m.upper()} {p}" for m, p, _ in LIST_ROUTES])
def test_lists_never_include_another_organizations_records(client, world, method, path, body):
    r = getattr(client, method)(path, headers=world["attacker"], **({"json": body} if body is not None else {}))
    assert r.status_code == 200, r.text
    text = r.text.replace("yamini@acme.example", "")  # the attacker's own (coincidentally identical) email
    if body and "question" in body:
        text = text.replace(body["question"], "")  # Ask echoes the attacker's own question
    assert not any(m in text for m in VICTIM_MARKERS), (path, text[:400])


def test_policy_and_projects_written_by_another_organization_stay_there(client, session_factory, world):
    before = client.get("/api/admin/policy", headers=world["victim"]).json()
    assert client.put("/api/admin/policy", json={"send_email": "auto"}, headers=world["attacker"]).status_code in (200, 422)
    assert client.get("/api/admin/policy", headers=world["victim"]).json() == before
    client.post("/api/projects", json={"name": "Eve's project", "aliases": []}, headers=world["attacker"])
    names = [p["name"] for p in client.get("/api/projects", headers=world["victim"]).json()]
    assert "Eve's project" not in names


def test_a_session_cannot_be_moved_to_another_organization(client, session_factory, world):
    from rook.auth import issue_token

    with session_factory() as db:
        eve = db.scalar(select(User).where(User.name == "Eve"))
        eve.org_id = world["acme"]  # the token says Fabrikam; the user row now says Acme
        forged = issue_token(User(id=eve.id, org_id=999999, email=eve.email, name=eve.name))
    assert client.get("/api/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_demo_login_never_reaches_a_real_tenant_user(client, session_factory, world):
    # Eve's email equals a demo user's: demo login finds only the demo user, never Eve in Fabrikam.
    me = client.get("/api/me", headers=login(client, "yamini@acme.example")).json()
    assert me["org"]["is_demo"] is True and me["user"]["name"] != "Eve"
    with session_factory() as db:
        db.add(User(org_id=db.scalar(select(Organization.id).where(Organization.slug == "fabrikam")),
                    email="ceo@fabrikam.example", name="Fabrikam CEO", role="admin"))
        db.commit()
    assert client.post("/api/auth/login", json={"email": "ceo@fabrikam.example"}).status_code == 401


def test_microsoft_connections_are_isolated_between_tenants(client, session_factory, m365):
    a = entra_sign_in(client, session_factory, m365)
    cid = connect_m365(client, session_factory, m365, a)
    m365.tid, m365.oid, m365.email = OTHER_TENANT, "oid-ana", "ana@fabrikam.example"
    b = entra_sign_in(client, session_factory, m365)
    assert client.post(f"/api/sources/{cid}/sync", headers=b).status_code == 404
    assert client.post(f"/api/sources/{cid}/disconnect", headers=b).status_code == 404
    sources = client.get("/api/sources", headers=b).json()
    assert "yamini@contoso.example" not in str(sources)
    assert all(s.get("connector_id") != cid for s in sources if isinstance(s, dict))
    assert client.get("/api/meetings", headers=b).json() == []
    with session_factory() as db:
        assert db.get(Connector, cid).status == "connected"
