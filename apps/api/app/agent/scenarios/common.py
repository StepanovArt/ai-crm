from collections.abc import AsyncGenerator
from typing import Any

from app.agent.providers.base import ProviderStep, ToolOutcome

ScenarioGen = AsyncGenerator[ProviderStep, ToolOutcome | None]

INVALIDATE_ALL: list[list[str]] = [
    ["deals"],
    ["pipelines"],
    ["tasks"],
    ["activities"],
    ["dashboard"],
    ["contacts"],
    ["companies"],
]


def need(out: ToolOutcome | None) -> ToolOutcome:
    if out is None:
        raise RuntimeError("Expected a tool outcome")
    return out


def items(out: ToolOutcome) -> list[dict[str, Any]]:
    raw = out.data.get("items", [])
    return list(raw) if isinstance(raw, list) else []


def first_word(name: str | None) -> str:
    return (name or "").split()[0] if name else ""
