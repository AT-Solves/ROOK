"""Epistemic labels for everything ROOK says (PRD §7, Principles 3 and 9).

* FACT           — explicitly stated in a permitted source (cited).
* INFERENCE      — derived by ROOK from one or more permitted sources (cited, with a basis).
* RECOMMENDATION — a suggested next step; never executed without the user's approval.
* UNKNOWN        — ROOK lacks the evidence to say.

``finalize`` enforces the core rule: a FACT or INFERENCE without visible evidence is downgraded to
UNKNOWN, so the UI can never present an uncited claim as established.
"""

from __future__ import annotations

FACT, INFERENCE, RECOMMENDATION, UNKNOWN = "FACT", "INFERENCE", "RECOMMENDATION", "UNKNOWN"
CLAIM_TYPES = (FACT, INFERENCE, RECOMMENDATION, UNKNOWN)
_CONF_ORDER = {"high": 0, "medium": 1, "low": 2}


def claim(
    text: str,
    claim_type: str,
    *,
    confidence: str = "medium",
    evidence: list[dict] | None = None,
    basis: str = "",
    detail: str = "",
    meta: str = "",
    action: dict | None = None,
) -> dict:
    return finalize({
        "text": text, "claim_type": claim_type, "confidence": confidence, "evidence": evidence or [],
        "basis": basis, "detail": detail, "meta": meta, **({"action": action} if action else {}),
    })


def finalize(c: dict) -> dict:
    assert c["claim_type"] in CLAIM_TYPES, c["claim_type"]
    if c["claim_type"] in (FACT, INFERENCE) and not c.get("evidence"):
        c["claim_type"], c["confidence"] = UNKNOWN, "low"
        c["basis"] = "No permitted source supports this."
    return c


def weakest(confidences: list[str]) -> str:
    return max(confidences, key=lambda c: _CONF_ORDER.get(c, 2), default="low")


# --------------------------------------------------------------------------- answer structure (C-008)
# "ROOK must decompose mixed answers into individually typed claims rather than assigning one
#  weakest-confidence label to the entire response." (product owner, 2026-10-07)

UNIT_ORDER = (FACT, INFERENCE, RECOMMENDATION, UNKNOWN)
_GROUP_TYPES = {"what_changed": FACT, "why_it_matters": INFERENCE, "recommended_actions": RECOMMENDATION, "unknowns": UNKNOWN}


def answer_violations(answer: dict) -> list[str]:
    """Structural trust checks for an Ask ROOK answer. Empty list = valid."""
    problems: list[str] = []
    units = answer.get("units") or []
    if answer.get("composite"):
        if answer.get("claim_type") is not None:
            problems.append("composite answer carries a single label for the whole response")
        if not units:
            problems.append("composite answer has no typed units")
        order = [UNIT_ORDER.index(u["claim_type"]) for u in units if u["claim_type"] in UNIT_ORDER]
        if order != sorted(order):
            problems.append("units are not ordered FACT → INFERENCE → RECOMMENDATION → UNKNOWN")
    elif answer.get("claim_type") not in CLAIM_TYPES:
        problems.append("single-type answer without a valid claim type")

    for group, expected in _GROUP_TYPES.items():
        for c in answer.get(group) or []:
            if c["claim_type"] != expected and not (expected in (FACT, INFERENCE) and c["claim_type"] == UNKNOWN):
                problems.append(f"{group} item typed {c['claim_type']}, expected {expected}: {c['text'][:60]}")

    claims = list(units) + [c for g in _GROUP_TYPES for c in answer.get(g) or []] + list(answer.get("key_points") or [])
    claims += [c for s in answer.get("sections") or [] for c in s["items"]]
    for c in claims:
        t = c.get("claim_type")
        if t not in CLAIM_TYPES:
            problems.append(f"claim without a valid type: {c.get('text', '')[:60]}")
        elif t in (FACT, INFERENCE) and not c.get("evidence"):
            problems.append(f"{t} without evidence: {c['text'][:60]}")
        elif t == INFERENCE and c.get("confidence") not in ("high", "medium", "low"):
            problems.append(f"INFERENCE without confidence: {c['text'][:60]}")
        elif t == UNKNOWN and c.get("evidence"):
            problems.append(f"UNKNOWN cites supporting evidence: {c['text'][:60]}")
    return problems
