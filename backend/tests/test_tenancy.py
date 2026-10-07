"""Tenant isolation (R20): another organisation's IDs behave as if they do not exist."""

from rook.models import Commitment, Organization, Signal, User
from tests.conftest import login


def test_cross_tenant_access_is_404(client, session_factory):
    with session_factory() as db:
        other = Organization(name="Other Co", slug="other", ai_policy={})
        db.add(other)
        db.flush()
        db.add(User(org_id=other.id, email="eve@other.example", name="Eve Other", role="admin"))
        db.commit()
        acme_signal = db.query(Signal).first().id
        acme_commitment = db.query(Commitment).first().id
    h = login(client, "eve@other.example")
    assert client.get(f"/api/signals/{acme_signal}", headers=h).status_code == 404
    assert client.post(f"/api/commitments/{acme_commitment}/followup", json={}, headers=h).status_code == 404
    assert client.get("/api/decisions", headers=h).json() == []
    b = client.get("/api/brief", headers=h).json()
    assert b["attention"] == [] and b["risks"] == [] and b["changes"] == []
    r = client.post("/api/ask", json={"question": "Why is Phoenix at risk?"}, headers=h).json()
    assert not r["sources"]
