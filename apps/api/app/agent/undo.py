"""Undo agent actions by applying each tool's inverse, newest first."""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.tools import ToolContext, ToolRegistry
from app.models import AgentAction
from app.services.context import Ctx

INVALIDATE: list[list[str]] = [
    ["deals"],
    ["pipelines"],
    ["tasks"],
    ["activities"],
    ["dashboard"],
    ["contacts"],
    ["companies"],
    ["notes"],
]


async def undo_actions(
    session: AsyncSession,
    registry: ToolRegistry,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    action_ids: list[uuid.UUID],
) -> tuple[list[str], list[dict[str, Any]]]:
    rows = await session.scalars(
        select(AgentAction)
        .where(
            AgentAction.workspace_id == workspace_id,
            AgentAction.id.in_(action_ids),
            AgentAction.undone.is_(False),
        )
        .order_by(AgentAction.created_at.desc())
    )
    actions = list(rows.all())
    ctx = Ctx(session=session, workspace_id=workspace_id, user_id=user_id, actor_type="agent")
    tctx = ToolContext(ctx=ctx)
    ui: list[dict[str, Any]] = []
    for action in actions:
        tool = registry.get(action.tool)
        await tool.undo(tctx, dict(action.inverse))
        action.undone = True
        if action.tool == "move_deal_stage":
            snapshot = action.inverse.get("snapshot", {})
            ui.append(
                {
                    "kind": "move_card",
                    "deal_id": action.inverse["deal_id"],
                    "to_stage_id": snapshot.get("stage_id"),
                }
            )
    await session.flush()
    if actions:
        ui.append({"kind": "invalidate", "query_keys": INVALIDATE})
        n = len(actions)
        ui.append({"kind": "toast", "text": f"Undid {n} change{'s' if n != 1 else ''}"})
    return [str(a.id) for a in actions], ui
