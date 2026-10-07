from sqlalchemy import select

from rook.models import Commitment, Decision, Evidence, Project, Risk


def test_cross_channel_commitment_is_deduplicated(db):
    perf = [c for c in db.scalars(select(Commitment)).all() if "performance testing" in c.description]
    assert len(perf) == 1, "teams transcript + outlook email should be one commitment"
    ev = db.scalars(select(Evidence).where(Evidence.entity_type == "commitment", Evidence.entity_id == perf[0].id)).all()
    assert len(ev) == 2 and perf[0].confidence == "high"


def test_completion_closes_commitment(db):
    recon = db.scalar(select(Commitment).where(Commitment.description.contains("reconciliation")))
    assert recon.status == "done" and recon.completed_signal_id is not None


def test_inferred_actions_need_approval(db):
    inferred = db.scalars(select(Commitment).where(Commitment.kind == "inferred")).all()
    assert inferred and all(c.status == "proposed" and c.owner_name == "Unassigned" for c in inferred)


def test_decisions_and_pending_decision(db):
    decisions = db.scalars(select(Decision)).all()
    made = [d for d in decisions if d.status == "made"]
    pending = [d for d in decisions if d.status == "pending"]
    assert made[0].code == "D-1001" and "Phoenix" in made[0].statement
    assert len(pending) == 1, "pricing decision in transcript + email should merge"


def test_risk_rules_are_explained_and_cited(db):
    risks = {r.rule: r for r in db.scalars(select(Risk)).all()}
    assert set(risks) == {"overdue_commitment", "dependency_delay", "unresolved_discussion", "unowned_escalation"}
    delay = risks["dependency_delay"]
    assert delay.level == "high" and "API release" in delay.explanation and "D-1001" in delay.explanation
    for r in risks.values():
        assert db.scalars(select(Evidence).where(Evidence.entity_type == "risk", Evidence.entity_id == r.id)).all()
    phoenix = db.scalar(select(Project).where(Project.name == "Project Phoenix"))
    assert phoenix.status == "at_risk"


def test_risks_resolve_when_trigger_clears(db):
    from rook.services import risk

    sarah = db.scalar(select(Commitment).where(Commitment.owner_name == "Sarah Okafor"))
    sarah.status = "done"
    risk.detect(db, sarah.org_id)
    r = db.scalar(select(Risk).where(Risk.rule == "overdue_commitment"))
    assert r.status == "resolved"
