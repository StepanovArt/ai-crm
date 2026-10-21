import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, WorkspaceScopedMixin, utcnow


class Task(WorkspaceScopedMixin, Base):
    __tablename__ = "tasks"

    title: Mapped[str] = mapped_column(String(300))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    related_type: Mapped[str | None] = mapped_column(String(16), default=None)
    related_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), default=None)
    created_by: Mapped[str] = mapped_column(String(8), default="user")  # user | agent


class Note(WorkspaceScopedMixin, Base):
    __tablename__ = "notes"

    related_type: Mapped[str] = mapped_column(String(16))
    related_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    body: Mapped[str] = mapped_column(Text)
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    created_by: Mapped[str] = mapped_column(String(8), default="user")  # user | agent


class Activity(WorkspaceScopedMixin, Base):
    __tablename__ = "activities"
    __table_args__ = (Index("ix_activities_related", "related_type", "related_id"),)

    type: Mapped[str] = mapped_column(String(32))
    actor_type: Mapped[str] = mapped_column(String(8), default="user")  # user | agent | system
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), default=None)
    related_type: Mapped[str] = mapped_column(String(16))
    related_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
