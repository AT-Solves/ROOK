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
