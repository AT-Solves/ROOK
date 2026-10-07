from __future__ import annotations

import re

STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "will", "from", "about", "into", "have", "has", "our", "your",
    "are", "was", "were", "been", "by", "on", "to", "of", "in", "a", "an", "is", "it", "be", "as", "at", "or",
    "before", "after", "team", "send", "what", "who", "why", "how", "did", "does", "do", "we", "i", "me", "my",
    "you", "there", "their", "they", "them", "show", "everything", "related", "tell", "any", "all", "can",
}


def tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9][a-z0-9-]+", text.lower()) if t not in STOPWORDS and len(t) > 2}


def jaccard(a: str, b: str) -> float:
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def overlap(a: str, b: str) -> int:
    return len(tokens(a) & tokens(b))


def first_name(name: str) -> str:
    return name.strip().split(" ")[0].lower() if name.strip() else ""
