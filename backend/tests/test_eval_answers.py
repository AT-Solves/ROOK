"""AI evaluation: structural trust checks on Ask ROOK answers (rook-ai-eval; C-008).

Rule: ROOK must decompose mixed answers into individually typed claims rather than assigning one
weakest-confidence label to the entire response. Every FACT/INFERENCE is cited, every INFERENCE has a
confidence, UNKNOWN never cites "supporting" evidence, and composite answers carry no single label.
"""

import pytest

from rook.trust import FACT, INFERENCE, RECOMMENDATION, UNKNOWN, answer_violations, claim
from tests.conftest import login

QUESTIONS = [
    "What changed and what should I do?",
    "What needs my attention?",
    "What changed?",
    "What decisions are pending?",
    "What am I waiting for?",
    "What commitments are overdue?",
    "Prepare me for my next meeting.",
    "What is at risk?",
    "Why is the launch at risk?",
    "What did we decide about the Phoenix launch?",
    "Show me everything related to Project Phoenix",
    "What did we decide about the office move?",
]


@pytest.mark.parametrize("question", QUESTIONS)
@pytest.mark.parametrize("email", ["yamini@acme.example", "marcus@acme.example"])
def test_every_answer_passes_structural_trust_checks(client, question, email):
    r = client.post("/api/ask", json={"question": question}, headers=login(client, email)).json()
    assert answer_violations(r) == []


def test_mixed_answers_are_decomposed_not_weakened(client):
    r = client.post("/api/ask", json={"question": "What changed and what should I do?"}, headers=login(client)).json()
    present = {c["claim_type"] for c in r["units"]}
    assert present == {FACT, INFERENCE, RECOMMENDATION, UNKNOWN}, "a mixed answer keeps every claim type"
    assert r["claim_type"] is None, "no single label (and no weakest label) for the whole response"


def test_validator_rejects_a_weakest_label_on_a_composite_answer():
    fact = claim("API release delayed", FACT, confidence="high", evidence=[{"signal_id": 1}])
    inference = claim("Launch at risk", INFERENCE, confidence="medium", evidence=[{"signal_id": 1}])
    weakened = {"composite": True, "claim_type": INFERENCE, "units": [fact, inference], "sections": []}
    assert any("single label" in p for p in answer_violations(weakened))
    misordered = {"composite": True, "claim_type": None, "units": [inference, fact], "sections": []}
    assert any("ordered" in p for p in answer_violations(misordered))


def test_validator_rejects_uncited_and_mis_grouped_claims():
    bad = {"composite": True, "claim_type": None, "sections": [],
           "units": [{"text": "x", "claim_type": FACT, "confidence": "high", "evidence": []}],
           "why_it_matters": [claim("y", RECOMMENDATION)],
           "unknowns": [{"text": "z", "claim_type": UNKNOWN, "confidence": "low", "evidence": [{"signal_id": 2}]}]}
    problems = answer_violations(bad)
    assert any("FACT without evidence" in p for p in problems)
    assert any("why_it_matters item typed RECOMMENDATION" in p for p in problems)
    assert any("UNKNOWN cites supporting evidence" in p for p in problems)
