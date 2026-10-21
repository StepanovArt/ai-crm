import uuid

from fastapi import APIRouter, status

from app.deps import CtxDep
from app.routers.params import FilterQuery
from app.schemas.common import OkOut
from app.schemas.pipelines import (
    BoardOut,
    PipelineCreate,
    PipelineOut,
    PipelineUpdate,
    StageCreate,
    StageOut,
    StageReorder,
    StageUpdate,
)
from app.schemas.records import DealFilter
from app.services import pipelines as service
from app.services.listing import parse_filter

router = APIRouter(tags=["pipelines"])


@router.get("/pipelines", response_model=list[PipelineOut])
async def list_pipelines(ctx: CtxDep) -> list[PipelineOut]:
    return await service.list_pipelines(ctx)


@router.post("/pipelines", response_model=PipelineOut, status_code=status.HTTP_201_CREATED)
async def create_pipeline(body: PipelineCreate, ctx: CtxDep) -> PipelineOut:
    return await service.create_pipeline(ctx, body)


@router.get("/pipelines/{pipeline_id}", response_model=PipelineOut)
async def get_pipeline(pipeline_id: uuid.UUID, ctx: CtxDep) -> PipelineOut:
    return await service.get_pipeline(ctx, pipeline_id)


@router.patch("/pipelines/{pipeline_id}", response_model=PipelineOut)
async def update_pipeline(pipeline_id: uuid.UUID, body: PipelineUpdate, ctx: CtxDep) -> PipelineOut:
    return await service.update_pipeline(ctx, pipeline_id, body)


@router.delete("/pipelines/{pipeline_id}", response_model=OkOut)
async def delete_pipeline(pipeline_id: uuid.UUID, ctx: CtxDep) -> OkOut:
    await service.delete_pipeline(ctx, pipeline_id)
    return OkOut()


@router.get("/pipelines/{pipeline_id}/board", response_model=BoardOut)
async def get_board(pipeline_id: uuid.UUID, ctx: CtxDep, filter: FilterQuery = None) -> BoardOut:
    return await service.board(ctx, pipeline_id, parse_filter(filter, DealFilter))


@router.post(
    "/pipelines/{pipeline_id}/stages", response_model=StageOut, status_code=status.HTTP_201_CREATED
)
async def create_stage(pipeline_id: uuid.UUID, body: StageCreate, ctx: CtxDep) -> StageOut:
    return await service.create_stage(ctx, pipeline_id, body)


@router.post("/pipelines/{pipeline_id}/stages/reorder", response_model=PipelineOut)
async def reorder_stages(pipeline_id: uuid.UUID, body: StageReorder, ctx: CtxDep) -> PipelineOut:
    return await service.reorder_stages(ctx, pipeline_id, body)


@router.patch("/stages/{stage_id}", response_model=StageOut)
async def update_stage(stage_id: uuid.UUID, body: StageUpdate, ctx: CtxDep) -> StageOut:
    return await service.update_stage(ctx, stage_id, body)


@router.delete("/stages/{stage_id}", response_model=OkOut)
async def delete_stage(stage_id: uuid.UUID, ctx: CtxDep) -> OkOut:
    await service.delete_stage(ctx, stage_id)
    return OkOut()
