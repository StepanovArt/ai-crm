import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import Money, ORMModel, OutModel


class _Filter(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ids: list[uuid.UUID] | None = None
    owner_id: uuid.UUID | None = None
    custom: dict[str, Any] | None = None


# ---- briefs (embedded relations) -------------------------------------------------------------


class CompanyBrief(ORMModel):
    id: uuid.UUID
    name: str
    domain: str | None = None


class ContactBrief(OutModel):
    id: uuid.UUID
    full_name: str
    title: str | None = None
    email: str | None = None


class StageBrief(ORMModel):
    id: uuid.UUID
    name: str
    color: str
    kind: str
    probability: int
    position: int


# ---- companies -------------------------------------------------------------------------------


class CompanyOut(ORMModel):
    id: uuid.UUID
    name: str
    domain: str | None
    industry: str | None
    size: str | None
    logo_url: str | None
    owner_id: uuid.UUID | None
    custom: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    contacts_count: int = 0
    open_deals_count: int = 0
    open_deals_value: Money = Decimal("0")
    last_activity_at: datetime | None = None


class CompanyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    domain: str | None = Field(default=None, max_length=200)
    industry: str | None = Field(default=None, max_length=120)
    size: str | None = Field(default=None, max_length=32)
    logo_url: str | None = Field(default=None, max_length=500)
    owner_id: uuid.UUID | None = None
    custom: dict[str, Any] = Field(default_factory=dict)


class CompanyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    domain: str | None = Field(default=None, max_length=200)
    industry: str | None = Field(default=None, max_length=120)
    size: str | None = Field(default=None, max_length=32)
    logo_url: str | None = Field(default=None, max_length=500)
    owner_id: uuid.UUID | None = None
    custom: dict[str, Any] | None = None


class CompanyFilter(_Filter):
    industry: str | None = None
    size: str | None = None


# ---- contacts --------------------------------------------------------------------------------


LeadStatus = Literal["new", "contacted", "qualified", "unqualified", "customer"]


class ContactOut(ORMModel):
    id: uuid.UUID
    company_id: uuid.UUID | None
    company: CompanyBrief | None = None
    first_name: str
    last_name: str
    full_name: str = ""
    email: str | None
    phone: str | None
    title: str | None
    owner_id: uuid.UUID | None
    lead_status: str
    score: int
    custom: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    last_activity_at: datetime | None = None


class ContactCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(default="", max_length=120)
    company_id: uuid.UUID | None = None
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=64)
    title: str | None = Field(default=None, max_length=160)
    owner_id: uuid.UUID | None = None
    lead_status: LeadStatus = "new"
    custom: dict[str, Any] = Field(default_factory=dict)


class ContactUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=120)
    last_name: str | None = Field(default=None, max_length=120)
    company_id: uuid.UUID | None = None
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=64)
    title: str | None = Field(default=None, max_length=160)
    owner_id: uuid.UUID | None = None
    lead_status: LeadStatus | None = None
    custom: dict[str, Any] | None = None


class ContactFilter(_Filter):
    company_id: uuid.UUID | None = None
    lead_status: str | None = None
    score_min: int | None = None
    score_max: int | None = None
    has_open_deal: bool | None = None


class ScoreSignalOut(OutModel):
    key: str
    label: str
    weight: int
    active: bool
    detail: str


class ScoreOut(OutModel):
    contact_id: uuid.UUID
    score: int
    signals: list[ScoreSignalOut]


# ---- deals -----------------------------------------------------------------------------------


class DealOut(ORMModel):
    id: uuid.UUID
    pipeline_id: uuid.UUID
    stage_id: uuid.UUID
    stage: StageBrief | None = None
    name: str
    value: Money
    currency: str
    company_id: uuid.UUID | None
    company: CompanyBrief | None = None
    primary_contact_id: uuid.UUID | None
    primary_contact: ContactBrief | None = None
    owner_id: uuid.UUID | None
    expected_close: date | None
    position: float
    custom: dict[str, Any]
    last_activity_at: datetime | None
    stage_entered_at: datetime | None
    created_at: datetime
    updated_at: datetime
    agent_touched_at: datetime | None = None


class DealCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    pipeline_id: uuid.UUID | None = None
    stage_id: uuid.UUID | None = None
    value: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    company_id: uuid.UUID | None = None
    primary_contact_id: uuid.UUID | None = None
    owner_id: uuid.UUID | None = None
    expected_close: date | None = None
    custom: dict[str, Any] = Field(default_factory=dict)


class DealUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    value: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    company_id: uuid.UUID | None = None
    primary_contact_id: uuid.UUID | None = None
    owner_id: uuid.UUID | None = None
    expected_close: date | None = None
    stage_id: uuid.UUID | None = None
    custom: dict[str, Any] | None = None


class DealMove(BaseModel):
    stage_id: uuid.UUID
    index: int | None = Field(
        default=None, ge=0, description="Target index within the stage column"
    )


class DealFilter(_Filter):
    pipeline_id: uuid.UUID | None = None
    stage_id: uuid.UUID | None = None
    stage_ids: list[uuid.UUID] | None = None
    company_id: uuid.UUID | None = None
    primary_contact_id: uuid.UUID | None = None
    status: Literal["open", "won", "lost"] | None = None
    value_min: Decimal | None = None
    value_max: Decimal | None = None
    stale_days: int | None = Field(default=None, ge=1)
    close_before: date | None = None
    close_after: date | None = None
