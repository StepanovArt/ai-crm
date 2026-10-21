"""Tiny parsers for the mock intent router: names, stages, due dates."""

import re

_MOVE = re.compile(
    r"\b(?:move|push|advance|shift|set|put|drag)\s+(?P<deal>.+?)\s+(?:to|into|in)\s+(?:the\s+)?(?P<stage>[\w &'-]+?)(?:\s+stage)?[.!?]*$",
    re.IGNORECASE,
)
_RECIPIENT = re.compile(r"\b(?:to|for|with)\s+(?P<name>[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?)")
_THIS = re.compile(
    r"\b(this|it|them|him|her|the deal|this deal|this contact|this one)\b", re.IGNORECASE
)
_DAYS = re.compile(r"\bin\s+(\d{1,3})\s+days?\b", re.IGNORECASE)
_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def parse_move(message: str) -> tuple[str, str] | None:
    m = _MOVE.search(message.strip())
    if not m:
        return None
    return m.group("deal").strip(" \"'"), m.group("stage").strip(" \"'")


def refers_to_context(text: str) -> bool:
    return bool(_THIS.fullmatch(text.strip())) or text.strip().lower() in {
        "this",
        "it",
        "deal",
        "this deal",
    }


def mentions_this(message: str) -> bool:
    return bool(_THIS.search(message))


def parse_recipient(message: str) -> str | None:
    m = _RECIPIENT.search(message)
    if not m:
        return None
    name = m.group("name")
    return None if name.lower() in {"me", "him", "her", "them", "this"} else name


def parse_due_days(message: str, today_weekday: int) -> int:
    text = message.lower()
    if "today" in text or "tonight" in text:
        return 0
    if "tomorrow" in text:
        return 1
    if "next week" in text:
        return 7
    m = _DAYS.search(text)
    if m:
        return int(m.group(1))
    for i, day in enumerate(_WEEKDAYS):
        if day in text:
            delta = (i - today_weekday) % 7
            return delta or 7
    return 1


def parse_task_title(message: str) -> str:
    text = message.strip().rstrip(".!?")
    text = re.sub(
        r"^(please\s+)?(remind me to|create (a )?task( to)?|add (a )?task( to)?|make (a )?task( to)?|todo:?)\s*",
        "",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"\s+(today|tomorrow|next week|in \d+ days?|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday))$",
        "",
        text,
        flags=re.IGNORECASE,
    )
    return text[:1].upper() + text[1:] if text else "Follow up"
