import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampedMixin, WorkspaceScopedMixin


class Company(WorkspaceScopedMixin, Base):
    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(String(200), index=True)
    domain: Mapped[str | None] = mapped_column(String(200), default=None)
    industry: Mapped[str | None] = mapped_column(String(120), default=None)
    size: Mapped[str | None] = mapped_column(String(32), default=None)
    logo_url: Mapped[str | None] = mapped_column(String(500), default=None)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    custom: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class Contact(WorkspaceScopedMixin, Base):
    __tablename__ = "contacts"

    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="SET NULL"),
        default=None,
        index=True,
    )
    first_name: Mapped[str] = mapped_column(String(120))
    last_name: Mapped[str] = mapped_column(String(120), default="")
    email: Mapped[str | None] = mapped_column(String(320), default=None)
    phone: Mapped[str | None] = mapped_column(String(64), default=None)
    title: Mapped[str | None] = mapped_column(String(160), default=None)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    lead_status: Mapped[str] = mapped_column(String(32), default="new")
    score: Mapped[int] = mapped_column(Integer, default=0)
    custom: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class Pipeline(WorkspaceScopedMixin, Base):
    __tablename__ = "pipelines"

    name: Mapped[str] = mapped_column(String(120))
    position: Mapped[int] = mapped_column(Integer, default=0)


class Stage(TimestampedMixin, Base):
    __tablename__ = "stages"

    pipeline_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pipelines.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    position: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[str] = mapped_column(String(24), default="slate")
    probability: Mapped[int] = mapped_column(Integer, default=0)
    kind: Mapped[str] = mapped_column(String(8), default="open")  # open | won | lost


class Deal(WorkspaceScopedMixin, Base):
    __tablename__ = "deals"

    pipeline_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pipelines.id", ondelete="CASCADE"), index=True
    )
    stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stages.id"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    value: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="SET NULL"),
        default=None,
        index=True,
    )
    primary_contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), default=None, index=True
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), default=None
    )
    expected_close: Mapped[date | None] = mapped_column(Date, default=None)
    position: Mapped[float] = mapped_column(Float, default=0.0)
    custom: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    last_activity_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    stage_entered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
