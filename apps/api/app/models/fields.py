from typing import Any

from sqlalchemy import Boolean, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, WorkspaceScopedMixin


class FieldDefinition(WorkspaceScopedMixin, Base):
    __tablename__ = "field_definitions"
    __table_args__ = (UniqueConstraint("workspace_id", "object_type", "key"),)

    object_type: Mapped[str] = mapped_column(String(16))  # company | contact | deal
    key: Mapped[str] = mapped_column(String(64))
    label: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(24))
    options: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
