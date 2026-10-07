"""Trust layer: FACT / INFERENCE / RECOMMENDATION / UNKNOWN and provenance (PRD §7, R16–R17)."""

from rook.trust import FACT, INFERENCE, RECOMMENDATION, UNKNOWN, claim
from tests.conftest import login

TYPES = {FACT, INFERENCE, RECOMMENDATION, UNKNOWN}


def test_uncited_fact_is_downgraded_to_unknown():
    c = claim("Launch is on Oct 18", FACT, confidence="high", evidence=[])
    assert c["claim_type"] == UNKNOWN and c["confidence"] == "low"
    assert claim("Do X", RECOMMENDATION)["claim_type"] == RECOMMENDATION  # recommendations are not facts


def test_registers_carry_claim_types_and_evidence(client):
    h = login(client)
    for d in client.get("/api/decisions", headers=h).json():
        assert d["claim_type"] == FACT and d["evidence"] and d["basis"]
    commitments = client.get("/api/commitments", headers=h).json()
    for c in commitments:
        assert c["evidence"]
        assert c["claim_type"] == (FACT if c["kind"] == "explicit" else INFERENCE), "inferred must never be FACT"
        if c["status"] == "overdue":
            assert c["status_claim_type"] == INFERENCE and "no completion" in c["status_basis"]
    for r in client.get("/api/risks", headers=h).json():
        assert r["claim_type"] == INFERENCE and r["evidence"]
        assert r["recommended_action"]["claim_type"] == RECOMMENDATION and r["recommended_action"]["text"]


def test_decision_commitment_links(client):
    h = login(client)
    launch = next(d for d in client.get("/api/decisions", headers=h).json() if d["code"] == "D-1001")
    assert launch["participants"] and launch["context"]
    assert any("performance testing" in c["description"] for c in launch["related_commitments"])
    perf = next(c for c in client.get("/api/commitments", headers=h).json() if "performance testing" in c["description"])
    assert perf["related_decision"]["code"] == "D-1001" and perf["related_decision"]["claim_type"] == FACT


def test_brief_items_are_typed_and_cited(client):
    h = login(client)
    b = client.get("/api/brief", headers=h).json()
    for a in b["attention"]:
        assert a["claim_type"] in TYPES and a["evidence"]
        if a["recommended_action"]:
            assert a["recommended_action"]["claim_type"] == RECOMMENDATION
    assert all(c["claim_type"] == FACT for c in b["changes"])


def test_meeting_prep_questions_are_recommendations(client):
    h = login(client)
    m = next(m for m in client.get("/api/meetings", headers=h).json() if m["title"] == "Phoenix Product Review")
    prep = client.get(f"/api/meetings/{m['id']}/prep", headers=h).json()
    assert prep["suggested_questions"] and all(q["claim_type"] == RECOMMENDATION for q in prep["suggested_questions"])
