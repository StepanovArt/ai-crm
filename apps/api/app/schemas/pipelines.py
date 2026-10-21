import uuid

from pydantic import BaseModel, Field

from app.schemas.common import Money, ORMModel, OutModel
from app.schemas.records import DealOut

StageKind = str


class StageOut(ORMModel):
    id: uuid.UUID
    pipeline_id: uuid.UUID
    name: str
    position: int
    color: str
    probability: int
    kind: str


class PipelineOut(ORMModel):
    id: uuid.UUID
    name: str
    position: int
    stages: list[StageOut]


class PipelineCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class PipelineUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    position: int | None = None


class StageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    color: str = Field(default="slate", max_length=24)
    probability: int = Field(default=10, ge=0, le=100)
    kind: str = Field(default="open", pattern="^(open|won|lost)$")
    position: int | None = None


class StageUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    color: str | None = Field(default=None, max_length=24)
    probability: int | None = Field(default=None, ge=0, le=100)
    kind: str | None = Field(default=None, pattern="^(open|won|lost)$")


class StageReorder(BaseModel):
    stage_ids: list[uuid.UUID]


class StageColumn(OutModel):
    stage: StageOut
    count: int
    total_value: Money
    weighted_value: Money


class BoardOut(OutModel):
    pipeline: PipelineOut
    columns: list[StageColumn]
    deals: list[DealOut]
