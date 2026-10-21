import uuid
from datetime import date

from app.schemas.common import Money, OutModel
from app.schemas.records import ContactOut, DealOut, ScoreSignalOut
from app.schemas.work import TaskOut


class QueueItem(OutModel):
    contact: ContactOut
    score: int
    reasons: list[ScoreSignalOut]
    open_deal: DealOut | None = None


class PipelineStats(OutModel):
    pipeline_id: uuid.UUID | None
    open_count: int
    open_value: Money
    weighted_value: Money
    won_this_month_count: int
    won_this_month_value: Money
    stale_count: int
    currency: str


class StageStat(OutModel):
    stage_id: uuid.UUID
    name: str
    color: str
    kind: str
    count: int
    value: Money


class TodayOut(OutModel):
    date: date
    first_name: str
    tasks_overdue: list[TaskOut]
    tasks_today: list[TaskOut]
    contact_queue: list[QueueItem]
    stats: PipelineStats
    stages: list[StageStat]
    stale_deals: list[DealOut]
