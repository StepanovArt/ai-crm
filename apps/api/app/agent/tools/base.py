"""Tool contract: typed args, a UI label, `run`, and for mutating tools an exact `undo`."""

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, ClassVar

from pydantic import BaseModel

from app.services.context import Ctx


@dataclass
class ToolContext:
    ctx: Ctx  # actor_type is "agent"
    conversation_id: uuid.UUID | None = None
    plan_id: uuid.UUID | None = None
    timezone: str | None = None


@dataclass
class ToolResult:
    ok: bool
    summary: str
    data: dict[str, Any] = field(default_factory=dict)
    inverse_data: dict[str, Any] | None = None


class Tool[A: BaseModel](ABC):
    name: ClassVar[str]
    label: ClassVar[str]
    description: ClassVar[str]
    mutating: ClassVar[bool] = False
    Args: type[A]

    def parse(self, raw: dict[str, Any]) -> A:
        return self.Args.model_validate(raw)

    def describe(self, args: A) -> str:
        """Human label for the tool chip (e.g. "Moving Acme to Negotiation")."""
        return self.label

    @abstractmethod
    async def run(self, tctx: ToolContext, args: A) -> ToolResult: ...

    def inverse(self, result: ToolResult) -> dict[str, Any]:
        """How to revert this call. Mutating tools must return enough to restore state exactly."""
        if self.mutating and result.inverse_data is None:
            raise RuntimeError(f"{self.name} is mutating but returned no inverse")
        return result.inverse_data or {}

    async def undo(self, tctx: ToolContext, inverse: dict[str, Any]) -> None:
        if self.mutating:
            raise NotImplementedError(f"{self.name} must implement undo")

    def json_schema(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.Args.model_json_schema(),
        }
