"""Workspace scoping helpers. Every business query must go through these."""

import uuid
from typing import Any, Protocol

from sqlalchemy import Select, select
from sqlalchemy.orm import InstrumentedAttribute

from app.errors import NotFoundError
from app.models import Pipeline, Stage
from app.services.context import Ctx


class _Scoped(Protocol):
    id: Any
    workspace_id: Any


def scoped[M: _Scoped](model: type[M], workspace_id: uuid.UUID) -> Select[M]:
    ws_col: InstrumentedAttribute[uuid.UUID] = model.workspace_id
    return select(model).where(ws_col == workspace_id)


async def get_scoped[M: _Scoped](
    ctx: Ctx, model: type[M], obj_id: uuid.UUID, label: str = "Record"
) -> M:
    id_col: InstrumentedAttribute[uuid.UUID] = model.id
    obj = await ctx.session.scalar(scoped(model, ctx.workspace_id).where(id_col == obj_id))
    if obj is None:
        raise NotFoundError(f"{label} not found")
    return obj


def scoped_stages(workspace_id: uuid.UUID) -> Select[Stage]:
    return (
        select(Stage)
        .join(Pipeline, Pipeline.id == Stage.pipeline_id)
        .where(Pipeline.workspace_id == workspace_id)
    )


async def get_stage(ctx: Ctx, stage_id: uuid.UUID) -> Stage:
    stage = await ctx.session.scalar(scoped_stages(ctx.workspace_id).where(Stage.id == stage_id))
    if stage is None:
        raise NotFoundError("Stage not found")
    return stage
