import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field


class PageContext(BaseModel):
    """What the user is looking at when they talk to the agent."""

    route: str = "/"
    record_type: Literal["company", "contact", "deal"] | None = None
    record_id: uuid.UUID | None = None
    pipeline_id: uuid.UUID | None = None
    selected_ids: list[uuid.UUID] = Field(default_factory=list)
    visible_filters: dict[str, Any] = Field(default_factory=dict)
    timezone: str | None = Field(default=None, description="IANA zone, e.g. Europe/Berlin")
