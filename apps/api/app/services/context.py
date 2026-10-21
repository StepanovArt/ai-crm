import uuid
from dataclasses import dataclass, replace
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

ActorType = Literal["user", "agent", "system"]


@dataclass(frozen=True)
class Ctx:
    """Everything a service needs: DB session, tenant, and who is acting."""

    session: AsyncSession
    workspace_id: uuid.UUID
    user_id: uuid.UUID | None
    actor_type: ActorType = "user"

    def as_agent(self) -> "Ctx":
        return replace(self, actor_type="agent")
