import uuid

from sqlalchemy import func, select

from app.errors import ConflictError, ValidationFailed
from app.models import Deal, Pipeline, Stage
from app.schemas.pipelines import (
    BoardOut,
    PipelineCreate,
    PipelineOut,
    PipelineUpdate,
    StageColumn,
    StageCreate,
    StageOut,
    StageReorder,
    StageUpdate,
)
from app.schemas.records import DealFilter
from app.services import deals as deals_service
from app.services.context import Ctx
from app.services.scoping import get_scoped, get_stage, scoped

DEFAULT_STAGES: tuple[tuple[str, int, str, str], ...] = (
    ("New", 10, "slate", "open"),
    ("In progress", 40, "blue", "open"),
    ("Committed", 75, "amber", "open"),
    ("Won", 100, "green", "won"),
    ("Lost", 0, "rose", "lost"),
)
STAGE_COLORS = ("slate", "blue", "indigo", "violet", "amber", "green", "rose", "teal")


async def _stages(ctx: Ctx, pipeline_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[Stage]]:
    out: dict[uuid.UUID, list[Stage]] = {pid: [] for pid in pipeline_ids}
    rows = await ctx.session.scalars(
        select(Stage).where(Stage.pipeline_id.in_(pipeline_ids)).order_by(Stage.position)
    )
    for stage in rows.all():
        out[stage.pipeline_id].append(stage)
    return out


def _out(pipeline: Pipeline, stages: list[Stage]) -> PipelineOut:
    return PipelineOut(
        id=pipeline.id,
        name=pipeline.name,
        position=pipeline.position,
        stages=[StageOut.model_validate(s) for s in stages],
    )


async def list_pipelines(ctx: Ctx) -> list[PipelineOut]:
    pipelines = list(
        (
            await ctx.session.scalars(
                scoped(Pipeline, ctx.workspace_id).order_by(Pipeline.position, Pipeline.created_at)
            )
        ).all()
    )
    stages = await _stages(ctx, [p.id for p in pipelines])
    return [_out(p, stages[p.id]) for p in pipelines]


async def get_pipeline(ctx: Ctx, pipeline_id: uuid.UUID) -> PipelineOut:
    pipeline = await get_scoped(ctx, Pipeline, pipeline_id, "Pipeline")
    stages = await _stages(ctx, [pipeline.id])
    return _out(pipeline, stages[pipeline.id])


async def create_pipeline(ctx: Ctx, data: PipelineCreate) -> PipelineOut:
    current = await ctx.session.scalar(
        select(func.max(Pipeline.position)).where(Pipeline.workspace_id == ctx.workspace_id)
    )
    pipeline = Pipeline(
        workspace_id=ctx.workspace_id,
        name=data.name.strip(),
        position=(current if current is not None else -1) + 1,
    )
    ctx.session.add(pipeline)
    await ctx.session.flush()
    for i, (name, prob, color, kind) in enumerate(DEFAULT_STAGES):
        ctx.session.add(
            Stage(
                pipeline_id=pipeline.id,
                name=name,
                position=i,
                color=color,
                probability=prob,
                kind=kind,
            )
        )
    await ctx.session.flush()
    return await get_pipeline(ctx, pipeline.id)


async def update_pipeline(ctx: Ctx, pipeline_id: uuid.UUID, data: PipelineUpdate) -> PipelineOut:
    pipeline = await get_scoped(ctx, Pipeline, pipeline_id, "Pipeline")
    if data.name is not None:
        pipeline.name = data.name.strip()
    if data.position is not None:
        pipeline.position = data.position
    await ctx.session.flush()
    return await get_pipeline(ctx, pipeline.id)


async def _deal_count(
    ctx: Ctx, *, pipeline_id: uuid.UUID | None = None, stage_id: uuid.UUID | None = None
) -> int:
    stmt = select(func.count()).select_from(Deal).where(Deal.workspace_id == ctx.workspace_id)
    if pipeline_id:
        stmt = stmt.where(Deal.pipeline_id == pipeline_id)
    if stage_id:
        stmt = stmt.where(Deal.stage_id == stage_id)
    return int(await ctx.session.scalar(stmt) or 0)


async def delete_pipeline(ctx: Ctx, pipeline_id: uuid.UUID) -> None:
    pipeline = await get_scoped(ctx, Pipeline, pipeline_id, "Pipeline")
    if await _deal_count(ctx, pipeline_id=pipeline.id):
        raise ConflictError("Move or delete the deals in this pipeline first")
    remaining = await ctx.session.scalar(
        select(func.count()).select_from(Pipeline).where(Pipeline.workspace_id == ctx.workspace_id)
    )
    if (remaining or 0) <= 1:
        raise ConflictError("A workspace needs at least one pipeline")
    await ctx.session.delete(pipeline)
    await ctx.session.flush()


async def create_stage(ctx: Ctx, pipeline_id: uuid.UUID, data: StageCreate) -> StageOut:
    pipeline = await get_scoped(ctx, Pipeline, pipeline_id, "Pipeline")
    stages = (await _stages(ctx, [pipeline.id]))[pipeline.id]
    # New open stages go before the closed (won/lost) ones by default.
    if data.position is not None:
        position = max(0, min(data.position, len(stages)))
    elif data.kind == "open":
        position = next((s.position for s in stages if s.kind != "open"), len(stages))
    else:
        position = len(stages)
    for s in stages:
        if s.position >= position:
            s.position += 1
    stage = Stage(
        pipeline_id=pipeline.id,
        name=data.name.strip(),
        position=position,
        color=data.color,
        probability=data.probability,
        kind=data.kind,
    )
    ctx.session.add(stage)
    await ctx.session.flush()
    return StageOut.model_validate(stage)


async def update_stage(ctx: Ctx, stage_id: uuid.UUID, data: StageUpdate) -> StageOut:
    stage = await get_stage(ctx, stage_id)
    patch = data.model_dump(exclude_unset=True)
    for key in ("name", "color", "probability", "kind"):
        if key in patch and patch[key] is not None:
            setattr(stage, key, patch[key].strip() if key == "name" else patch[key])
    await ctx.session.flush()
    return StageOut.model_validate(stage)


async def delete_stage(ctx: Ctx, stage_id: uuid.UUID) -> None:
    stage = await get_stage(ctx, stage_id)
    if await _deal_count(ctx, stage_id=stage.id):
        raise ConflictError("Move the deals out of this stage before deleting it")
    siblings = (await _stages(ctx, [stage.pipeline_id]))[stage.pipeline_id]
    if len(siblings) <= 2:
        raise ConflictError("A pipeline needs at least two stages")
    await ctx.session.delete(stage)
    await ctx.session.flush()
    for i, s in enumerate(x for x in siblings if x.id != stage.id):
        s.position = i
    await ctx.session.flush()


async def reorder_stages(ctx: Ctx, pipeline_id: uuid.UUID, data: StageReorder) -> PipelineOut:
    pipeline = await get_scoped(ctx, Pipeline, pipeline_id, "Pipeline")
    stages = {s.id: s for s in (await _stages(ctx, [pipeline.id]))[pipeline.id]}
    if set(data.stage_ids) != set(stages) or len(data.stage_ids) != len(stages):
        raise ValidationFailed("Reorder must include every stage exactly once")
    for i, sid in enumerate(data.stage_ids):
        stages[sid].position = i
    await ctx.session.flush()
    return await get_pipeline(ctx, pipeline.id)


async def board(ctx: Ctx, pipeline_id: uuid.UUID, flt: DealFilter) -> BoardOut:
    pipeline = await get_pipeline(ctx, pipeline_id)
    scoped_filter = flt.model_copy(update={"pipeline_id": pipeline.id})
    totals = await deals_service.stage_totals(ctx, pipeline.id, scoped_filter)
    deals = await deals_service.list_all_deals(ctx, scoped_filter)
    columns = []
    for stage in pipeline.stages:
        count, total, weighted = totals.get(stage.id, (0, 0, 0))
        columns.append(
            StageColumn(stage=stage, count=count, total_value=total, weighted_value=weighted)
        )
    return BoardOut(pipeline=pipeline, columns=columns, deals=deals)
