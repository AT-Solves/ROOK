"""Ask ROOK: MVP minimum question set (02_MVP_SCOPE) and the combined answer (MVP success step 9)."""

import pytest

from rook.trust import FACT, INFERENCE, RECOMMENDATION, UNKNOWN
from tests.conftest import login

MVP_QUESTIONS = [
    ("What needs my attention?", "attention"),
    ("What changed?", "changes"),
    ("What decisions are pending?", "decisions_pending"),
    ("What am I waiting for?", "waiting_for"),
    ("What commitments are overdue?", "overdue"),
    ("Prepare me for my next meeting.", "meeting_prep"),
    ("What is at risk?", "at_risk"),
]


@pytest.mark.parametrize("question,intent", MVP_QUESTIONS)
def test_mvp_questions(client, question, intent):
    r = client.post("/api/ask", json={"question": question}, headers=login(client)).json()
    assert r["intent"] == intent
    assert r["sources"], "every MVP answer must be evidence-backed"
    assert r["claim_type"] in {FACT, INFERENCE} and r["key_points"]
    for kp in r["key_points"]:
        assert kp["claim_type"] in {FACT, INFERENCE, RECOMMENDATION}
        assert kp["evidence"] or kp["claim_type"] == RECOMMENDATION


def test_what_changed_and_what_should_i_do(client):
    """C-008: the combined answer is decomposed into individually typed units, never one weakest label."""
    r = client.post("/api/ask", json={"question": "What changed and what should I do?"}, headers=login(client)).json()
    assert r["intent"] == "changed_and_do" and r["composite"] is True
    assert r["claim_type"] is None and r["confidence"] is None
    assert [u["claim_type"] for u in r["units"]] == [FACT, INFERENCE, RECOMMENDATION, UNKNOWN]
    fact, inference, rec, unknown = r["units"]
    assert fact["evidence"] and fact["confidence"] == "high"
    assert inference["evidence"] and inference["confidence"] in {"high", "medium", "low"} and "D-1001" in inference["text"]
    assert rec["action"]["type"] == "draft_followup" and rec["evidence"]
    assert unknown["text"].startswith("ROOK cannot determine") and not unknown["evidence"]
    assert all(c["claim_type"] == FACT and c["evidence"] for c in r["what_changed"])
    assert all(c["claim_type"] == INFERENCE and c["evidence"] for c in r["why_it_matters"])
    assert all(c["claim_type"] == RECOMMENDATION for c in r["recommended_actions"])
    assert r["unknowns"] and all(c["claim_type"] == UNKNOWN for c in r["unknowns"])
    assert r["sources"]


def test_unanswerable_question_is_unknown(client):
    r = client.post("/api/ask", json={"question": "What did we decide about the office move?"}, headers=login(client)).json()
    assert r["claim_type"] == UNKNOWN and r["answer"].startswith("I couldn't find enough evidence") and not r["sources"]


def test_change_lines_do_not_repeat_system_authors(client):
    r = client.post("/api/ask", json={"question": "What changed?"}, headers=login(client)).json()
    texts = [c["text"] for c in r["what_changed"]]
    assert any(t.startswith("Jira: PROJ-1842") for t in texts) and not any("Jira · Jira" in t for t in texts)
