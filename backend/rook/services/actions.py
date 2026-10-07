"""Follow-up engine + communication copilot + human-in-the-loop execution (README §12, §19, §20, §33)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit
from ..ai.providers import LLMError, get_provider
from ..connectors import OutboundMessage, get_connector_class
from ..models import ActionProposal, Commitment, Connector, Organization, Risk, Signal, User, utcnow
from ..trust import RECOMMENDATION
from .views import Viewer

# External communication is human-controlled in the MVP (C-001, ADR-0005): these kinds can never be "auto".
EXTERNAL_COMMUNICATION = {"send_email", "send_message"}

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


def _template_reminder(user: User, c: Commitment, source: Signal, tone: str, risk: Risk | None = None) -> str:
    first = c.owner_name.split()[0]
    due = f" (due {c.due_date:%A %B} {c.due_date.day})" if c.due_date else ""
    ask = ("Could you share where it stands and the expected date? If something is blocking it, let me know how I can help."
           if risk is None or risk.rule != "dependency_delay" else
           "I understand a dependency has slipped. Could you share a recovery plan and a confirmed date, "
           "and let me know what you need from me to protect the plan?")
    return (
        f"Hi {first},\n\n{_OPENERS.get(tone, _OPENERS['executive'])} \u201c{c.description}\u201d{due}, "
        f"which came out of {source.title.split(' — ')[0]} on {source.occurred_at:%B} {source.occurred_at.day}.\n\n"
        f"{ask}\n\nThanks,\n{user.name.split()[0]}"
    )


def draft_followup(db: Session, user: User, commitment: Commitment, tone: str = "executive",
                   risk: Risk | None = None) -> ActionProposal:
    """Prepare (never send) a follow-up. Sending is a separate step that needs the user's explicit approval."""
    source = db.get(Signal, commitment.source_signal_id)
    v = Viewer(db, user)
    cv = v.commitment(commitment)
    context = {"why": cv["status_basis"] or cv["basis"], "commitment": {k: cv[k] for k in ("id", "owner", "description", "due_date", "status")},
               "evidence": cv["evidence"], "claim_type": RECOMMENDATION}
    if risk is not None and v.visible(risk):
        rv = v.risk(risk)
        context["why"] = rv["explanation"]
        context["risk"] = {"id": rv["id"], "title": rv["title"], "level": rv["level"]}
        context["evidence"] = rv["evidence"]
    body = _template_reminder(user, commitment, source, tone, risk)
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
                 "body": body, "tone": tone, "engine": engine, "context": context},
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
    if proposal.kind in EXTERNAL_COMMUNICATION and proposal.user_id != user.id:
        raise PolicyError("Only the person sending this message can approve it.")
    if proposal.user_id != user.id and user.role != "admin":
        raise PolicyError("Only the requesting user or an admin can approve this action.")

    proposal.status = "approved"
    # Send only through a connector that belongs to the approving user (their own mailbox) and allows sending.
    sender = next((c for c in db.scalars(select(Connector).where(Connector.org_id == user.org_id)).all()
                   if c.status == "connected" and get_connector_class(c.kind).sending_enabled()
                   and (c.created_by in (None, user.id) if c.kind == "demo" else c.created_by == user.id)), None)
    p = proposal.payload
    if not p.get("to"):
        proposal.result = "Approved, but the recipient's address is unknown. Copy the draft and send it yourself."
    elif sender is None:
        proposal.result = "Approved. No connected source is allowed to send for you; copy the draft and send it yourself."
    else:
        from .pipeline import connector_instance

        proposal.result = connector_instance(db, sender).send(
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
