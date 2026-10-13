"""Meeting preparation is honest about the context it had (context coverage).

ROOK finds decisions, risks and related correspondence only through a meeting's ROOK project. Without one they are
not evaluated, so their absence must be reported as UNKNOWN, never as "none".
"""

from datetime import timedelta

from rook.models import Commitment, Meeting, Project, User, utcnow
from tests.conftest import connect_m365, entra_sign_in, login

PREP_KEYS = {"meeting", "participants", "prep_reasons", "previous_meetings", "decisions", "open_commitments", "risks",
             "related_signals", "suggested_questions"}


def _prep(client, headers, title):
    m = next(x for x in client.get("/api/meetings", headers=headers).json() if x["title"] == title)
    return client.get(f"/api/meetings/{m['id']}/prep", headers=headers).json()


def _meeting(session_factory, title, project_name=None, attendees=("yamini@acme.example",), days=2):
    with session_factory() as db:
        yamini = db.query(User).filter_by(email="yamini@acme.example").one()
        project_id = None
        if project_name:
            p = Project(org_id=yamini.org_id, name=project_name, aliases=[])
            db.add(p)
            db.flush()
            project_id = p.id
        start = utcnow() + timedelta(days=days)
        db.add(Meeting(org_id=yamini.org_id, external_id=f"t:{title}:{days}", title=title, purpose="", starts_at=start,
                       ends_at=start + timedelta(hours=1), attendees=list(attendees), organizer=attendees[0],
                       project_id=project_id))
        db.commit()


def _texts(cov, claim_type):
    return [r["text"] for r in cov["reasons"] if r["claim_type"] == claim_type]


def _no_absence_claims(cov):
    for r in cov["reasons"]:
        assert not r["text"].lower().startswith(("no risk", "no decision", "there are no")), r


def test_meeting_without_project_reports_unknown_instead_of_none(client, session_factory):
    h = login(client)
    with session_factory() as db:  # nothing else about this meeting: no open actions owned by its participant
        db.query(Commitment).filter_by(owner_email="yamini@acme.example").update({"status": "done"})
        db.commit()
    _meeting(session_factory, "Quarterly vendor sync")
    prep = _prep(client, h, "Quarterly vendor sync")
    cov = prep["context_coverage"]
    assert cov["project"] == {"linked": False, "name": None}
    assert cov["state"] == "insufficient" and cov["label"] == "Insufficient context"
    assert cov["items"]["risks"] == {"evaluated": False, "count": 0}
    assert cov["items"]["decisions"] == {"evaluated": False, "count": 0}
    assert cov["items"]["sources"] == {"evaluated": False, "count": 0}
    assert cov["items"]["commitments"]["evaluated"] and cov["items"]["previous_meetings"]["evaluated"]
    assert "This meeting is not linked to a ROOK project." in _texts(cov, "FACT")
    assert any("cannot be evaluated" in t for t in _texts(cov, "UNKNOWN"))
    assert any("define a project" in t for t in _texts(cov, "RECOMMENDATION"))
    _no_absence_claims(cov)
    assert prep["risks"] == [] and prep["decisions"] == [] and prep["suggested_questions"] == []  # unchanged


def test_meeting_without_project_but_with_a_participant_action_is_limited(client, session_factory):
    _meeting(session_factory, "Hiring sync")
    cov = _prep(client, login(client), "Hiring sync")["context_coverage"]
    assert cov["state"] == "limited" and not cov["project"]["linked"]
    assert cov["items"]["commitments"]["count"] >= 1 and not cov["items"]["risks"]["evaluated"]
    assert any(t.endswith("open action owned by participants.") for t in _texts(cov, "FACT"))
    _no_absence_claims(cov)


def test_meeting_without_project_but_with_earlier_meetings_is_limited(client, session_factory):
    _meeting(session_factory, "Weekly 1:1", days=-7)
    _meeting(session_factory, "Weekly 1:1", days=1)
    h = login(client)
    upcoming = next(m for m in client.get("/api/meetings", headers=h).json() if m["title"] == "Weekly 1:1" and not m["past"])
    cov = client.get(f"/api/meetings/{upcoming['id']}/prep", headers=h).json()["context_coverage"]
    assert cov["state"] == "limited" and not cov["project"]["linked"]
    assert cov["items"]["previous_meetings"] == {"evaluated": True, "count": 1}
    assert "1 earlier meeting on this topic." in _texts(cov, "FACT")


def test_project_linked_with_nothing_found_reports_evaluated_zeroes(client, session_factory):
    _meeting(session_factory, "Atlas kickoff", project_name="Atlas")
    cov = _prep(client, login(client), "Atlas kickoff")["context_coverage"]
    assert cov["project"] == {"linked": True, "name": "Atlas"}
    assert cov["state"] == "limited"
    assert cov["items"]["risks"] == {"evaluated": True, "count": 0}  # zero risks: actually evaluated
    assert cov["items"]["decisions"] == {"evaluated": True, "count": 0}  # zero decisions: actually evaluated
    assert any(t.startswith("Checked Atlas: 0 decisions, 0 open risks") for t in _texts(cov, "FACT"))
    assert _texts(cov, "UNKNOWN") == [] and _texts(cov, "RECOMMENDATION") == []


def test_project_linked_demo_meeting_keeps_its_preparation(client):
    prep = _prep(client, login(client), "Phoenix Product Review")
    assert PREP_KEYS <= set(prep)  # backward compatible: every existing field is still there
    cov = prep["context_coverage"]
    assert cov["project"]["linked"] and cov["project"]["name"] == "Project Phoenix"
    assert cov["state"] == "sufficient"
    assert cov["items"]["risks"] == {"evaluated": True, "count": len(prep["risks"])} and prep["risks"]
    assert cov["items"]["decisions"] == {"evaluated": True, "count": len(prep["decisions"])} and prep["decisions"]
    assert cov["items"]["commitments"]["count"] == len(prep["open_commitments"])
    assert cov["items"]["sources"]["count"] == len(prep["related_signals"])
    assert prep["suggested_questions"] and all(q["claim_type"] == "RECOMMENDATION" for q in prep["suggested_questions"])


def test_calendar_only_microsoft_meeting_is_honest(client, session_factory, m365):
    """A real-shaped Microsoft 365 calendar import with no ROOK projects defined (the fake Microsoft 365)."""
    h = entra_sign_in(client, session_factory, m365)
    cid = connect_m365(client, session_factory, m365, h)
    client.post(f"/api/sources/{cid}/sync", headers=h)
    meetings = client.get("/api/meetings", headers=h).json()
    assert meetings
    for m in meetings:
        cov = client.get(f"/api/meetings/{m['id']}/prep", headers=h).json()["context_coverage"]
        assert not cov["project"]["linked"] and cov["state"] in ("limited", "insufficient")
        assert not cov["items"]["risks"]["evaluated"] and not cov["items"]["decisions"]["evaluated"]
        _no_absence_claims(cov)
