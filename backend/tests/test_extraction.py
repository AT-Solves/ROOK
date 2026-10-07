from datetime import date, datetime

from rook.ai.extraction import RuleExtractor, parse_due

REF = datetime(2026, 10, 5, 10)  # a Monday


def extract(body, kind="meeting_transcript", author="Priya Shah"):
    return RuleExtractor().extract(body=body, kind=kind, author=author, occurred_at=REF)


def test_parse_due_variants():
    d = REF.date()
    assert parse_due("by tomorrow", d) == date(2026, 10, 6)
    assert parse_due("by Friday", d) == date(2026, 10, 9)
    assert parse_due("by Monday", d) == date(2026, 10, 12)  # same weekday means next week
    assert parse_due("by October 18", d) == date(2026, 10, 18)
    assert parse_due("next week", d) == date(2026, 10, 16)
    assert parse_due("no date here", d) is None


def test_decision_with_rationale():
    r = extract("Priya Shah: We decided to launch Phoenix on October 18. Reason: contractual commitment.")
    assert len(r.decisions) == 1
    d = r.decisions[0]
    assert d.statement == "Launch Phoenix on October 18"
    assert d.rationale == "Contractual commitment"
    assert d.owner == "Priya Shah" and not d.pending


def test_explicit_vs_inferred_commitment():
    r = extract("Sarah Okafor: I'll send the forecast by Thursday.\nMarcus Chen: Someone probably needs to check the contract.")
    explicit = [c for c in r.commitments if c.kind == "explicit"]
    inferred = [c for c in r.commitments if c.kind == "inferred"]
    assert explicit[0].owner_name == "Sarah Okafor" and explicit[0].due_date == date(2026, 10, 8)
    assert inferred[0].owner_name == "" and inferred[0].confidence == "low"


def test_team_commitment_after_lead_in():
    r = extract("Confirming from the meeting: Engineering will complete testing by October 8.", kind="email", author="Marcus Chen")
    assert r.commitments[0].owner_name == "Marcus Chen"
    assert r.commitments[0].description.startswith("Engineering will complete testing")


def test_pending_decision_and_completion():
    r = extract("Priya Shah: We need Yamini to approve the pricing tiers.\nLena Park: I sent the reconciliation report.")
    assert r.decisions[0].pending and r.decisions[0].owner == "Yamini"
    assert r.completions[0].author_name == "Lena Park"


def test_questions_are_not_commitments():
    assert not extract("Tom Becker: Will we finish by Friday?").commitments
