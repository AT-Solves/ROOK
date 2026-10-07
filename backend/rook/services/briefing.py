"""Daily Executive Brief (README §6–7, §23, §47)."""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Commitment, Decision, Evidence, Person, Risk, Signal, User, utcnow
from .meetings import prep_reasons, visible_meetings
from .views import Viewer, iso, signal_ref

LEVEL_ORDER = {"high": 0, "medium": 1, "low": 2}


def _greeting(now: datetime) -> str:
    return "Good morning" if now.hour < 12 else ("Good afternoon" if now.hour < 18 else "Good evening")


def _people_attention(db: Session, v: Viewer, now: datetime, open_commitments: list[Commitment]) -> list[dict]:
    me = v.user.email.lower()
    signals = [s for s in db.scalars(select(Signal).where(Signal.org_id == v.user.org_id)).all() if v.signal(s.id)]
    meetings = visible_meetings(db, v.user)
    out = []
    for p in db.scalars(select(Person).where(Person.org_id == v.user.org_id)).all():
        email = p.email.lower()
        if email == me:
            continue
        touch = [s.occurred_at for s in signals
                 if (s.author_email.lower() == email and me in s.participants)
                 or (s.author_email.lower() == me and email in s.participants)]
        touch += [m.ends_at for m in meetings if m.ends_at <= now and email in m.attendees]
        last = max(touch) if touch else None
        days = (now - last).days if last else None
        upcoming = [m for m in meetings if m.starts_at >= now and m.starts_at <= now + timedelta(days=2) and email in m.attendees]
        owes = [c for c in open_commitments if c.owner_email.lower() == email]
        reasons = []
        if days is not None and days >= 14:
            reasons.append(f"No interaction in {days} days")
        overdue = [c for c in owes if c.due_date and c.due_date < now.date()]
        if overdue:
            reasons.append(f"{len(overdue)} overdue commitment{'s' * (len(overdue) != 1)} to you")
        if reasons:
            if upcoming:
                reasons.append(f"Meeting: {upcoming[0].title} {upcoming[0].starts_at:%H:%M}")
            out.append({"name": p.name, "email": p.email, "title": p.title, "last_interaction": iso(last),
                        "days_since": days, "reasons": reasons})
    return out


def build_brief(db: Session, user: User, now: datetime | None = None) -> dict:
    now = now or utcnow()
    today = now.date()
    v = Viewer(db, user)
    org = user.org_id

    decisions = [d for d in db.scalars(select(Decision).where(Decision.org_id == org)).all() if v.visible(d)]
    commitments = [c for c in db.scalars(select(Commitment).where(Commitment.org_id == org)).all() if v.visible(c)]
    risks = sorted([r for r in db.scalars(select(Risk).where(Risk.org_id == org, Risk.status == "open")).all() if v.visible(r)],
                   key=lambda r: LEVEL_ORDER[r.level])

    pending = [d for d in decisions if d.status == "pending"]
    mine = [c for c in commitments if c.status == "open" and v.is_me(c.owner_name, c.owner_email)]
    waiting = [c for c in commitments if c.status == "open" and not v.is_me(c.owner_name, c.owner_email)]
    proposed = [c for c in commitments if c.status == "proposed"]
    open_c = [c for c in commitments if c.status == "open"]

    day_start = datetime.combine(today, datetime.min.time())
    meetings_today = [m for m in visible_meetings(db, user) if day_start <= m.starts_at < max(now + timedelta(hours=12), day_start + timedelta(days=1))]
    today_items = []
    for m in meetings_today:
        reasons = prep_reasons(db, v, m)
        today_items.append(v.meeting(m) | {"prep_required": bool(reasons), "prep_reasons": reasons,
                                            "past": m.ends_at < now})

    attention: list[dict] = []
    for r in risks:
        if r.level == "high":
            attention.append({"type": "risk", "label": "Risk detected", "title": r.title, "level": r.level,
                              "confidence": r.confidence, "id": r.id, "why": r.explanation})
    for d in pending:
        if v.is_me(d.owner):
            attention.append({"type": "decision", "label": "Decision required", "title": d.statement, "level": "high",
                              "confidence": d.confidence, "id": d.id, "why": f"{d.code} is waiting for you."})
    for c in waiting:
        if c.due_date and c.due_date < today:
            attention.append({"type": "commitment", "label": "Follow-up overdue", "title": f"{c.owner_name}: {c.description}",
                              "level": "medium", "confidence": c.confidence, "id": c.id,
                              "why": f"Due {c.due_date:%b} {c.due_date.day}; no completion detected. A reminder can be drafted for your approval."})
    for c in mine:
        if c.due_date and c.due_date <= today + timedelta(days=2):
            attention.append({"type": "commitment", "label": "Your commitment", "title": c.description, "level": "medium",
                              "confidence": c.confidence, "id": c.id, "why": f"You committed to this; due {c.due_date:%b} {c.due_date.day}."})
    attention.sort(key=lambda a: LEVEL_ORDER[a["level"]])

    # Changes in the last 36h, described by what ROOK derived from each signal.
    window = now - timedelta(hours=36)
    changes = []
    for s in db.scalars(select(Signal).where(Signal.org_id == org, Signal.occurred_at >= window)
                        .order_by(Signal.occurred_at.desc())).all():
        if not v.signal(s.id):
            continue
        derived = db.scalars(select(Evidence).where(Evidence.org_id == org, Evidence.signal_id == s.id)).all()
        notes = sorted({f"{e.entity_type}{' (' + e.note + ')' if e.note else ''}" for e in derived})
        changes.append(signal_ref(s) | {"derived": notes, "summary": s.body.split(". ")[0][:180]})

    prep = [m for m in today_items if m["prep_required"] and not m["past"]]
    top = attention[:3]
    headline = [f"{len(attention)} item{'s' * (len(attention) != 1)} require{'s' * (len(attention) == 1)} your attention today."]
    headline += [f"{i + 1}. {a['title']}" for i, a in enumerate(top)]
    headline.append(f"You have {len(meetings_today)} meeting{'s' * (len(meetings_today) != 1)} today. "
                    f"{len(prep)} require{'s' * (len(prep) == 1)} preparation.")

    first = user.name.split()[0]
    return {
        "greeting": f"{_greeting(now)}, {first}",
        "date": f"{now:%A}, {now:%B} {now.day}",
        "generated_at": iso(now),
        "headline": headline,
        "counts": {
            "attention": len(attention), "meetings_today": len(meetings_today), "prep_required": len(prep),
            "decisions_pending": len(pending), "my_commitments": len(mine),
            "my_due_today": len([c for c in mine if c.due_date == today]), "waiting_for": len(waiting),
            "at_risk": len({r.project_id for r in risks if r.project_id}), "risks": len(risks), "changes": len(changes),
            "proposed": len(proposed),
        },
        "attention": attention,
        "today": today_items,
        "decisions_pending": [v.decision(d) for d in pending],
        "my_commitments": [v.commitment(c, today) for c in mine],
        "waiting_for": [v.commitment(c, today) for c in waiting],
        "proposed": [v.commitment(c, today) for c in proposed],
        "risks": [v.risk(r) for r in risks],
        "changes": changes,
        "people": _people_attention(db, v, now, open_c),
    }
