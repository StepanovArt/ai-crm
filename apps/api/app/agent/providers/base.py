"""Provider abstraction.

A provider is an async generator of `ProviderStep`s. When it yields a `ToolCallStep`
the orchestrator executes the tool and sends the `ToolOutcome` back via `asend`.
Plans are stored as data so any provider can execute an approved plan the same way.
"""

import uuid
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from typing import Any, Protocol

from app.agent.context import PageContext
from app.agent.tools import ToolRegistry


@dataclass
class TextStep:
    text: str


@dataclass
class ThinkingStep:
    label: str


@dataclass
class ToolCallStep:
    tool: str
    args: dict[str, Any]
    label: str | None = None


@dataclass
class PlannedStep:
    label: str
    tool: str
    args: dict[str, Any]
    before: list[dict[str, Any]] = field(default_factory=list)
    after: list[dict[str, Any]] = field(default_factory=list)
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])


@dataclass
class PlanStep:
    title: str
    steps: list[PlannedStep]
    prelude: list[dict[str, Any]] = field(default_factory=list)
    finale: list[dict[str, Any]] = field(default_factory=list)
    thinking: str = "Working on it"
    summary: str = "Done."
    failure: str = "Some steps failed — nothing else was changed."


@dataclass
class UIActionStep:
    action: dict[str, Any]


@dataclass
class CardStep:
    kind: str
    data: dict[str, Any]


@dataclass
class SuggestionsStep:
    prompts: list[str]


ProviderStep = (
    TextStep | ThinkingStep | ToolCallStep | PlanStep | UIActionStep | CardStep | SuggestionsStep
)


@dataclass
class ToolOutcome:
    ok: bool
    summary: str
    data: dict[str, Any]


@dataclass
class HistoryMessage:
    role: str
    content: str


@dataclass
class ConversationState:
    conversation_id: uuid.UUID
    message: str
    history: list[HistoryMessage]
    user_name: str
    terminology: dict[str, str]


@dataclass
class StoredPlan:
    plan_id: uuid.UUID
    title: str
    payload: dict[str, Any]


ProviderRun = AsyncGenerator[ProviderStep, ToolOutcome | None]


class LLMProvider(Protocol):
    def run(
        self, conv: ConversationState, ctx: PageContext, tools: ToolRegistry
    ) -> ProviderRun: ...

    def execute_plan(
        self, plan: StoredPlan, ctx: PageContext, tools: ToolRegistry
    ) -> ProviderRun: ...


def plan_to_payload(plan: PlanStep) -> dict[str, Any]:
    return {
        "title": plan.title,
        "thinking": plan.thinking,
        "summary": plan.summary,
        "failure": plan.failure,
        "prelude": plan.prelude,
        "finale": plan.finale,
        "steps": [
            {
                "id": s.id,
                "label": s.label,
                "tool": s.tool,
                "args": s.args,
                "before": s.before,
                "after": s.after,
            }
            for s in plan.steps
        ],
    }
