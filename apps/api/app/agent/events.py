"""Typed SSE event protocol (mirrored in web/src/lib/agent/types.ts)."""

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field

# ---- UI actions ------------------------------------------------------------------------------


class NavigateAction(BaseModel):
    kind: Literal["navigate"] = "navigate"
    href: str


class HighlightAction(BaseModel):
    kind: Literal["highlight"] = "highlight"
    target: str
    duration_ms: int | None = None


class PulseAction(BaseModel):
    kind: Literal["pulse"] = "pulse"
    target: str


class MoveCardAction(BaseModel):
    kind: Literal["move_card"] = "move_card"
    deal_id: str
    to_stage_id: str


class OpenRecordAction(BaseModel):
    kind: Literal["open_record"] = "open_record"
    record_type: str
    record_id: str


class ApplyFilterAction(BaseModel):
    kind: Literal["apply_filter"] = "apply_filter"
    view: str
    filter: dict[str, Any]


class InvalidateAction(BaseModel):
    kind: Literal["invalidate"] = "invalidate"
    query_keys: list[list[str]]


class ToastAction(BaseModel):
    kind: Literal["toast"] = "toast"
    text: str


UIAction = Annotated[
    NavigateAction
    | HighlightAction
    | PulseAction
    | MoveCardAction
    | OpenRecordAction
    | ApplyFilterAction
    | InvalidateAction
    | ToastAction,
    Field(discriminator="kind"),
]

# ---- events ----------------------------------------------------------------------------------


class MessageStartEvent(BaseModel):
    type: Literal["message_start"] = "message_start"
    message_id: str
    conversation_id: str | None = None


class TokenEvent(BaseModel):
    type: Literal["token"] = "token"
    text: str


class ThinkingEvent(BaseModel):
    type: Literal["thinking"] = "thinking"
    label: str


class PlanStepOut(BaseModel):
    id: str
    label: str
    tool: str


class PlanEvent(BaseModel):
    type: Literal["plan"] = "plan"
    plan_id: str
    title: str
    steps: list[PlanStepOut]


class ToolCallEvent(BaseModel):
    type: Literal["tool_call"] = "tool_call"
    call_id: str
    tool: str
    label: str
    args: dict[str, Any]


class ToolResultEvent(BaseModel):
    type: Literal["tool_result"] = "tool_result"
    call_id: str
    ok: bool
    summary: str
    data: dict[str, Any] | None = None


class UIActionEvent(BaseModel):
    type: Literal["ui_action"] = "ui_action"
    action: UIAction


CardKind = Literal["records", "chart", "email_draft", "stats", "next_step"]


class CardEvent(BaseModel):
    type: Literal["card"] = "card"
    kind: CardKind
    data: dict[str, Any]


class MessageEndEvent(BaseModel):
    type: Literal["message_end"] = "message_end"
    message_id: str
    undo_action_ids: list[str] | None = None
    suggestions: list[str] | None = None


class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str


AgentEvent = Annotated[
    MessageStartEvent
    | TokenEvent
    | ThinkingEvent
    | PlanEvent
    | ToolCallEvent
    | ToolResultEvent
    | UIActionEvent
    | CardEvent
    | MessageEndEvent
    | ErrorEvent,
    Field(discriminator="type"),
]

AnyEvent = (
    MessageStartEvent
    | TokenEvent
    | ThinkingEvent
    | PlanEvent
    | ToolCallEvent
    | ToolResultEvent
    | UIActionEvent
    | CardEvent
    | MessageEndEvent
    | ErrorEvent
)
