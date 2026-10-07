"""Decision / commitment / completion extraction (README §9–12).

Two interchangeable engines share one output contract:

* ``RuleExtractor`` — deterministic, explainable patterns. Always available; used in tests.
* ``LLMExtractor`` — any configured model. Every item it returns must quote the source verbatim;
  items whose quote is not found in the signal are discarded (evidence validation, §32 / §51).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from .providers import LLMError, LLMProvider, get_provider

log = logging.getLogger(__name__)

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september",
          "october", "november", "december"]


@dataclass
class ExtractedDecision:
    statement: str
    quote: str
    owner: str = ""
    rationale: str = ""
    pending: bool = False
    confidence: str = "medium"


@dataclass
class ExtractedCommitment:
    owner_name: str
    description: str
    quote: str
    due_date: date | None = None
    kind: str = "explicit"  # explicit | inferred
    confidence: str = "medium"


@dataclass
class ExtractedCompletion:
    author_name: str
    text: str
    quote: str


@dataclass
class Extraction:
    decisions: list[ExtractedDecision] = field(default_factory=list)
    commitments: list[ExtractedCommitment] = field(default_factory=list)
    completions: list[ExtractedCompletion] = field(default_factory=list)
    engine: str = "rules"


# --------------------------------------------------------------------------- date parsing

_MONTH_DAY = re.compile(r"\b(" + "|".join(MONTHS) + r")\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?", re.I)


def parse_due(text: str, ref: date) -> date | None:
    t = text.lower()
    if m := _MONTH_DAY.search(t):
        month = MONTHS.index(m.group(1).lower()) + 1
        year = int(m.group(3)) if m.group(3) else ref.year
        try:
            d = date(year, month, int(m.group(2)))
        except ValueError:
            return None
        if not m.group(3) and d < ref - timedelta(days=180):
            d = d.replace(year=year + 1)
        return d
    if re.search(r"\b(by |)(today|end of day|eod)\b", t):
        return ref
    if "tomorrow" in t:
        return ref + timedelta(days=1)
    if re.search(r"\bnext week\b", t):
        return ref + timedelta(days=(7 - ref.weekday()) + 4)
    if re.search(r"\b(this week|end of (the )?week|eow)\b", t):
        return ref + timedelta(days=max(0, 4 - ref.weekday()))
    for i, name in enumerate(WEEKDAYS):
        if re.search(rf"\b(by|on|before|until)\s+{name}\b", t):
            delta = (i - ref.weekday()) % 7 or 7
            return ref + timedelta(days=delta)
    return None


# --------------------------------------------------------------------------- rules engine

_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z])")
_SPEAKER = re.compile(r"^([A-Z][\w'.-]+(?: [A-Z][\w'.-]+){0,3}):\s+(.*)$")

_DECIDED = re.compile(
    r"\b(?:we|the team|leadership|i)\s+(?:have\s+)?(?:decided|agreed|approved|chose)\s+(?:to\s+|that\s+|on\s+)?(?P<what>.+)", re.I)
_DECISION_LABEL = re.compile(r"^decision:\s*(?P<what>.+)", re.I)
_PENDING_NEED = re.compile(
    r"\bneeds?\s+(?P<who>[A-Z]\w+)\s+to\s+(?P<verb>approve|decide on|decide|sign off on|choose)\s+(?P<what>.+)")
_PENDING_NEEDED = re.compile(
    r"\bdecision\s+(?:is\s+)?(?:needed|required|pending)\s+on\s+(?P<what>.+?)(?=\s+(?:before|by|so)\b|[.]|$)", re.I)
_VOCATIVE = re.compile(r"^(?P<who>[A-Z]\w+),\s")
_REASON = re.compile(r"^(?:reason|because|rationale)[:,]?\s*(?P<why>.+)", re.I)

_FIRST_PERSON = re.compile(r"^(?:I'll|I will|I am going to|I'm going to)\s+(?P<what>.+)", re.I)
_WE = re.compile(r"^(?:we'll|we will)\s+(?P<what>.+)", re.I)
_TEAM = re.compile(r"^(?P<team>[A-Z][a-zA-Z]+(?: team)?)\s+will\s+(?P<what>.+)")
_NOT_TEAMS = {"this", "that", "it", "there", "which", "who", "what", "nobody", "everyone"}
_INFERRED = re.compile(r"\b(?:someone|somebody)\s+(?:probably\s+)?(?:needs?|should|must)\s+(?:to\s+)?(?P<what>.+)", re.I)
_COMPLETION = re.compile(
    r"^(?:I|we)\s+(?:have\s+|just\s+|already\s+)?(?:sent|completed|finished|shared|delivered|submitted|closed|resolved)\b(?P<what>.*)", re.I)


def _clean(s: str) -> str:
    s = s.strip().rstrip(".!")
    return s[:1].upper() + s[1:] if s else s


def _utterances(body: str, kind: str, author: str) -> list[tuple[str, str]]:
    """(speaker, sentence) pairs. Transcripts carry 'Name: text' lines; other signals use the author."""
    out: list[tuple[str, str]] = []
    for line in body.splitlines():
        line = line.strip()
        if not line:
            continue
        speaker, text = author, line
        if kind == "meeting_transcript" and (m := _SPEAKER.match(line)):
            speaker, text = m.group(1), m.group(2)
        out.extend((speaker, s.strip()) for s in _SENT_SPLIT.split(text) if s.strip())
    return out


class RuleExtractor:
    name = "rules"

    def extract(self, *, body: str, kind: str, author: str, occurred_at: datetime) -> Extraction:
        ref = occurred_at.date()
        result = Extraction(engine=self.name)
        utts = _utterances(body, kind, author)
        for i, (speaker, sentence) in enumerate(utts):
            if sentence.endswith("?"):
                continue
            # Commitments may follow a lead-in clause ("Confirming from Monday: Engineering will ...").
            clause = sentence.split(": ", 1)[1] if ": " in sentence and not _DECISION_LABEL.match(sentence) else sentence

            if m := (_DECIDED.search(sentence) or _DECISION_LABEL.match(sentence)):
                rationale = ""
                if i + 1 < len(utts) and (r := _REASON.match(utts[i + 1][1])):
                    rationale = _clean(r.group("why"))
                result.decisions.append(ExtractedDecision(
                    statement=_clean(m.group("what")), quote=sentence, owner=speaker, rationale=rationale,
                    confidence="high" if kind == "meeting_transcript" else "medium"))
                continue
            if m := _PENDING_NEED.search(sentence):
                result.decisions.append(ExtractedDecision(
                    statement=_clean(f"{m.group('verb')} {m.group('what')}"), quote=sentence, owner=m.group("who"), pending=True))
                continue
            if m := _PENDING_NEEDED.search(sentence):
                who = v.group("who") if (v := _VOCATIVE.match(sentence)) else ""
                result.decisions.append(ExtractedDecision(
                    statement=_clean(f"decide on {m.group('what')}"), quote=sentence, owner=who, pending=True))
                continue
            if m := _COMPLETION.match(clause):
                result.completions.append(ExtractedCompletion(speaker, _clean(clause), sentence))
                continue
            if m := _INFERRED.search(clause):
                result.commitments.append(ExtractedCommitment(
                    owner_name="", description=_clean(m.group("what")), quote=sentence,
                    due_date=parse_due(clause, ref), kind="inferred", confidence="low"))
                continue
            m_first, m_we, m_team = _FIRST_PERSON.match(clause), _WE.match(clause), _TEAM.match(clause)
            if m_team and m_team.group("team").split()[0].lower() in _NOT_TEAMS:
                m_team = None
            if m_first or m_we or m_team:
                if m_first:
                    desc = _clean(m_first.group("what"))
                elif m_we:
                    desc = "Team will " + m_we.group("what").strip().rstrip(".")
                else:
                    desc = f"{m_team.group('team')} will {m_team.group('what').strip().rstrip('.')}"
                due = parse_due(clause, ref)
                result.commitments.append(ExtractedCommitment(
                    owner_name=speaker, description=desc, quote=sentence, due_date=due, kind="explicit",
                    confidence="high" if (m_first and due) else "medium"))
        return result


# --------------------------------------------------------------------------- LLM engine

_SYSTEM = (
    "You are the extraction component of ROOK, an enterprise AI Chief of Staff. Extract only what the text "
    "explicitly supports. Never invent people, dates, decisions or commitments. Every item MUST include a "
    "'quote' copied verbatim from the text."
)

_PROMPT = """Reference date (when the text was written): {ref}
Author: {author}
Kind: {kind}

Text:
<<<
{body}
>>>

Return JSON:
{{"decisions":[{{"statement":str,"owner":str,"rationale":str,"pending":bool,"confidence":"high|medium|low","quote":str}}],
 "commitments":[{{"owner_name":str (empty if nobody explicitly committed),"description":str,"due_date":"YYYY-MM-DD"|null,
   "kind":"explicit|inferred","confidence":"high|medium|low","quote":str}}],
 "completions":[{{"author_name":str,"text":str,"quote":str}}]}}
A commitment is 'explicit' only when a named person or team says they will do something; otherwise it is 'inferred'.
A decision is 'pending' when someone states it still needs to be made, and 'owner' is who must make it."""


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()


class LLMExtractor:
    def __init__(self, provider: LLMProvider, fallback: RuleExtractor | None = None):
        self.provider = provider
        self.name = f"llm:{provider.name}"
        self.fallback = fallback or RuleExtractor()

    def extract(self, *, body: str, kind: str, author: str, occurred_at: datetime) -> Extraction:
        try:
            data = self.provider.complete_json(
                _SYSTEM, _PROMPT.format(ref=occurred_at.date().isoformat(), author=author, kind=kind, body=body))
        except LLMError as exc:
            log.warning("LLM extraction failed (%s); using rules", exc)
            return self.fallback.extract(body=body, kind=kind, author=author, occurred_at=occurred_at)

        source = _norm(body)

        def grounded(item: dict) -> bool:
            return bool(item.get("quote")) and _norm(str(item["quote"])) in source

        out = Extraction(engine=self.name)
        for d in data.get("decisions", []):
            if grounded(d):
                out.decisions.append(ExtractedDecision(
                    statement=str(d.get("statement", ""))[:500], quote=d["quote"], owner=str(d.get("owner", "")),
                    rationale=str(d.get("rationale", "")), pending=bool(d.get("pending")),
                    confidence=d.get("confidence") if d.get("confidence") in {"high", "medium", "low"} else "medium"))
        for c in data.get("commitments", []):
            if not grounded(c):
                continue
            try:
                due = date.fromisoformat(c["due_date"]) if c.get("due_date") else None
            except ValueError:
                due = None
            kind_ = "explicit" if c.get("kind") == "explicit" and c.get("owner_name") else "inferred"
            out.commitments.append(ExtractedCommitment(
                owner_name=str(c.get("owner_name", "")) if kind_ == "explicit" else "",
                description=str(c.get("description", ""))[:500], quote=c["quote"], due_date=due, kind=kind_,
                confidence="low" if kind_ == "inferred" else (c.get("confidence") or "medium")))
        for c in data.get("completions", []):
            if grounded(c):
                out.completions.append(ExtractedCompletion(str(c.get("author_name", author)), str(c.get("text", "")), c["quote"]))
        return out


def get_extractor():
    provider = get_provider()
    return LLMExtractor(provider) if provider else RuleExtractor()
