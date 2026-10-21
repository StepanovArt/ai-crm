import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.agent.context import PageContext
from app.agent.events import UIAction
from app.schemas.common import OutModel


class ChatIn(BaseModel):
    conversation_id: uuid.UUID | None = None
    message: str = Field(min_length=1, max_length=2000)
    context: PageContext = Field(default_factory=PageContext)


class ApproveIn(BaseModel):
    context: PageContext = Field(default_factory=PageContext)


class UndoIn(BaseModel):
    action_ids: list[uuid.UUID] = Field(min_length=1, max_length=100)


class UndoOut(OutModel):
    undone_action_ids: list[str]
    ui_actions: list[UIAction]


class ConversationOut(OutModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime


class MessageOut(OutModel):
    id: uuid.UUID
    role: str
    content: str
    events: list[dict[str, Any]]
    created_at: datetime


class ConversationDetailOut(ConversationOut):
    messages: list[MessageOut]
    plan_status: dict[str, str]
    undone_action_ids: list[str]
