"""Fuzzy matching of free-text names against records and stages."""

import re
from collections.abc import Sequence
from difflib import SequenceMatcher

_WORD = re.compile(r"[a-z0-9]+")
_STOP = {"the", "a", "an", "deal", "deals", "to", "with", "for", "and", "inc", "llc", "co"}


def tokens(text: str) -> list[str]:
    return [t for t in _WORD.findall(text.lower()) if t not in _STOP]


def similarity(query: str, candidate: str) -> float:
    """0..1 score that rewards whole-token hits and tolerates typos."""
    q, c = tokens(query), tokens(candidate)
    if not q or not c:
        return 0.0
    hits = 0.0
    for qt in q:
        best = max(SequenceMatcher(None, qt, ct).ratio() for ct in c)
        prefix = any(ct.startswith(qt) and len(qt) >= 3 for ct in c)
        hits += 1.0 if prefix else best if best >= 0.75 else 0.0
    token_score = hits / len(q)
    whole = SequenceMatcher(None, " ".join(q), " ".join(c)).ratio()
    return max(token_score * 0.85 + whole * 0.15, whole)


def best_matches[T](
    query: str, candidates: Sequence[tuple[T, str]], *, threshold: float = 0.6
) -> list[tuple[T, float]]:
    scored = [(item, similarity(query, text)) for item, text in candidates]
    good = [(item, s) for item, s in scored if s >= threshold]
    return sorted(good, key=lambda x: -x[1])


def match_stage[T](name: str, stages: Sequence[tuple[T, str]]) -> T | None:
    exact = [s for s, label in stages if label.lower() == name.strip().lower()]
    if exact:
        return exact[0]
    found = best_matches(name, stages, threshold=0.7)
    return found[0][0] if found else None
