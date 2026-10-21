"""Typed SSE events streamed while onboarding builds a workspace (mirrored in web types)."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.schemas.common import Money

StepId = Literal[
    "terminology", "pipeline", "fields", "companies", "contacts", "deals", "history", "tasks"
]


class StagePreview(BaseModel):
    name: str
    color: str
    kind: str
    probability: int


class FieldPreview(BaseModel):
    object_type: str
    label: str
    type: str


class DealPreview(BaseModel):
    name: str
    stage_index: int
    value: Money
    currency: str
    company: str | None = None


class StepOutline(BaseModel):
    id: StepId
    label: str


class OnboardingThinkingEvent(BaseModel):
    type: Literal["thinking"] = "thinking"
    text: str


class OnboardingTemplateEvent(BaseModel):
    type: Literal["template"] = "template"
    key: str
    name: str
    tagline: str
    matched: list[str]
    steps: list[StepOutline]


class OnboardingStepEvent(BaseModel):
    type: Literal["step"] = "step"
    id: StepId
    status: Literal["running", "done"]
    label: str
    detail: str | None = None
    terminology: dict[str, str] | None = None
    stages: list[StagePreview] | None = None
    fields: list[FieldPreview] | None = None
    count: int | None = None
    samples: list[str] | None = None
    deals: list[DealPreview] | None = None


class OnboardingDoneEvent(BaseModel):
    type: Literal["done"] = "done"
    workspace_id: str
    redirect: str = "/today"


class OnboardingErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str


OnboardingEvent = Annotated[
    OnboardingThinkingEvent
    | OnboardingTemplateEvent
    | OnboardingStepEvent
    | OnboardingDoneEvent
    | OnboardingErrorEvent,
    Field(discriminator="type"),
]

AnyOnboardingEvent = (
    OnboardingThinkingEvent
    | OnboardingTemplateEvent
    | OnboardingStepEvent
    | OnboardingDoneEvent
    | OnboardingErrorEvent
)
