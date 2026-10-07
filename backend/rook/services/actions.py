"""Follow-up engine + communication copilot + human-in-the-loop execution (README §12, §19, §20, §33)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit
from ..ai.providers import LLMError, get_provider
from ..connectors import OutboundMessage, get_connector_class
from ..models import ActionProposal, Commitment, Connector, Organization, Signal, User, utcnow

TONES = ("executive", "concise", "diplomatic", "direct", "collaborative", "formal")

_OPENERS = {
    "executive": "Quick check-in on",
    "concise": "Status on",
    "diplomatic": "I wanted to gently follow up on",
    "direct": "Following up on",
    "collaborative": "Checking in on how we're tracking with",
    "formal": "I am writing to follow up regarding",
}


class PolicyError(Exception):
    pass


def _template_reminder(user: User, c: Commitment, source: Signal, tone: str) -> str:
    first = c.owner_name.split()[0]
    due = f", which was due {c.due_date:%A %B} {c.due_date.day}" if c.due_date else ""
    return (
        f"Hi {first},\n\n{_OPENERS.get(tone, _OPENERS['executive'])} “{c.description}”{due}. "
        f"This came out of {source.title.split(' — ')[0]} on {source.occurred_at:%B} {source.occurred_at.day}.\n\n"
        "Could you share where it stands and the expected date? If something is blocking it, let me know how I can help.\n\n"
        f"Thanks,\n{user.name.split()[0]}"
    )


def draft_followup(db: Session, user: User, commitment: Commitment, tone: str = "executive") -> ActionProposal:
    """Prepare (never send) a reminder. Sending is a separate, policy-gated approval step."""
    source = db.get(Signal, commitment.source_signal_id)
    body = _template_reminder(user, commitment, source, tone)
    engine = "template"
    if provider := get_provider():
        try:
            body = provider.complete(
                "You are ROOK, drafting an email on behalf of an executive. Keep facts exactly as given; do not add "
                "commitments, dates or claims. Output only the email body.",
                f"Tone: {tone}\nRewrite this follow-up in that tone:\n\n{body}", max_tokens=400).strip() or body
            engine = provider.name
        except LLMError:
            pass
    proposal = ActionProposal(
        org_id=user.org_id, user_id=user.id, kind="send_email",
        title=f"Follow up with {commitment.owner_name}",
        payload={"to": [commitment.owner_email] if commitment.owner_email else [], "subject": f"Follow-up: {commitment.description}",
                 "body": body, "tone": tone, "engine": engine},
        related_type="commitment", related_id=commitment.id)
    db.add(proposal)
    db.flush()
    audit.record(db, org_id=user.org_id, user_id=user.id, actor="agent:communication", action="action.prepared",
                 intent="Draft follow-up reminder", tool="draft_email", input={"commitment_id": commitment.id, "tone": tone},
                 authorization="prepare (no approval needed)", result=f"proposal {proposal.id}")
    db.commit()
    return proposal


def approve(db: Session, user: User, proposal: ActionProposal) -> ActionProposal:
    org = db.get(Organization, user.org_id)
    rule = (org.ai_policy or {}).get(proposal.kind, "approval")
    if proposal.status not in {"draft", "blocked"}:
        raise PolicyError(f"Proposal is already {proposal.status}")
    if rule == "never":
        proposal.status = "blocked"
        proposal.result = f"Organisation policy forbids ROOK from executing '{proposal.kind}'."
        audit.record(db, org_id=user.org_id, user_id=user.id, actor=f"user:{user.email}", action="action.blocked",
                     tool=proposal.kind, input={"proposal_id": proposal.id}, authorization=f"policy:{rule}", result=proposal.result)
        db.commit()
        return proposal
    if proposal.user_id != user.id and user.role != "admin":
        raise PolicyError("Only the requesting user or an admin can approve this action.")

    proposal.status = "approved"
    sender = next((c for c in db.scalars(select(Connector).where(Connector.org_id == user.org_id)).all()
                   if get_connector_class(c.kind).can_send and c.status == "connected"), None)
    if sender is None:
        proposal.result = "Approved. No connected source can send messages yet; copy the draft and send it yourself."
    else:
        p = proposal.payload
        proposal.result = get_connector_class(sender.kind)(sender.config).send(
            OutboundMessage(to=p.get("to", []), subject=p.get("subject", ""), body=p.get("body", "")))
        proposal.status = "executed"
    proposal.updated_at = utcnow()
    audit.record(db, org_id=user.org_id, user_id=user.id, actor=f"user:{user.email}", action=f"action.{proposal.status}",
                 intent=proposal.title, tool=proposal.kind, input={"proposal_id": proposal.id, "to": proposal.payload.get("to")},
                 authorization=f"policy:{rule}; approved by {user.email}", result=proposal.result)
    db.commit()
    return proposal


def reject(db: Session, user: User, proposal: ActionProposal) -> ActionProposal:
    proposal.status = "rejected"
    proposal.updated_at = utcnow()
    audit.record(db, org_id=user.org_id, user_id=user.id, actor=f"user:{user.email}", action="action.rejected",
                 tool=proposal.kind, input={"proposal_id": proposal.id}, authorization="user", result="rejected")
    db.commit()
    return proposal
