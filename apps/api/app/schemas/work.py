import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import ORMModel, OutModel

RelatedType = Literal["company", "contact", "deal"]


class RelatedBrief(OutModel):
    type: RelatedType
    id: uuid.UUID
    name: str


class TaskOut(ORMModel):
    id: uuid.UUID
    title: str
    due_at: datetime | None
    done: bool
    completed_at: datetime | None
    assignee_id: uuid.UUID | None
    related_type: str | None
    related_id: uuid.UUID | None
    related: RelatedBrief | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    due_at: datetime | None = None
    assignee_id: uuid.UUID | None = None
    related_type: RelatedType | None = None
    related_id: uuid.UUID | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    due_at: datetime | None = None
    done: bool | None = None
    assignee_id: uuid.UUID | None = None


class TaskFilter(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ids: list[uuid.UUID] | None = None
    done: bool | None = None
    assignee_id: uuid.UUID | None = None
    related_type: RelatedType | None = None
    related_id: uuid.UUID | None = None
    created_by: Literal["user", "agent"] | None = None
    bucket: Literal["overdue", "today", "upcoming", "done", "open"] | None = None


class NoteOut(ORMModel):
    id: uuid.UUID
    related_type: str
    related_id: uuid.UUID
    body: str
    author_id: uuid.UUID | None
    created_by: str
    created_at: datetime
    updated_at: datetime


class NoteCreate(BaseModel):
    related_type: RelatedType
    related_id: uuid.UUID
    body: str = Field(min_length=1, max_length=20_000)


class NoteUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=20_000)


class ActivityOut(ORMModel):
    id: uuid.UUID
    type: str
    actor_type: str
    actor_id: uuid.UUID | None
    related_type: str
    related_id: uuid.UUID
    related: RelatedBrief | None = None
    payload: dict[str, Any]
    occurred_at: datetime
