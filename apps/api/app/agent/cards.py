"""Typed payloads for `card` events (exposed via OpenAPI for the web client)."""

from typing import Literal

from pydantic import BaseModel

from app.agent.drafting import EmailDraft
from app.agent.insights import NextStep


class RecordItem(BaseModel):
    type: Literal["task", "contact", "deal", "company"]
    id: str
    title: str
    subtitle: str | None = None
    badge: str | None = None
    tone: Literal["danger", "warning", "positive", "neutral"] = "neutral"
    href: str


class RecordsCard(BaseModel):
    title: str
    items: list[RecordItem]


class ChartSeriesItem(BaseModel):
    id: str
    name: str
    color: str
    kind: str
    count: int
    value: str
    weighted: str


class ChartTotals(BaseModel):
    open_value: str
    weighted_value: str
    won_this_month_value: str
    won_this_month_count: int
    open_count: int
    stale_count: int


class ChartCard(BaseModel):
    title: str
    currency: str
    series: list[ChartSeriesItem]
    totals: ChartTotals


class CardSchemas(BaseModel):
    records: RecordsCard
    chart: ChartCard
    email_draft: EmailDraft
    next_step: NextStep
