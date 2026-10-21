import uuid

from fastapi import APIRouter, status

from app.deps import CtxDep
from app.routers.params import FilterQuery, ListParamsDep
from app.schemas.common import OkOut, Page
from app.schemas.work import TaskCreate, TaskFilter, TaskOut, TaskUpdate
from app.services import tasks as service
from app.services.listing import parse_filter

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=Page[TaskOut])
async def list_tasks(
    ctx: CtxDep, params: ListParamsDep, filter: FilterQuery = None
) -> Page[TaskOut]:
    items, total = await service.list_tasks(ctx, params, parse_filter(filter, TaskFilter))
    return Page(items=items, total=total, next_cursor=params.next_cursor(total))


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(body: TaskCreate, ctx: CtxDep) -> TaskOut:
    task = await service.create_task(ctx, body)
    return await service.get_task(ctx, task.id)


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(task_id: uuid.UUID, ctx: CtxDep) -> TaskOut:
    return await service.get_task(ctx, task_id)


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(task_id: uuid.UUID, body: TaskUpdate, ctx: CtxDep) -> TaskOut:
    task = await service.update_task(ctx, task_id, body)
    return await service.get_task(ctx, task.id)


@router.delete("/{task_id}", response_model=OkOut)
async def delete_task(task_id: uuid.UUID, ctx: CtxDep) -> OkOut:
    await service.delete_task(ctx, task_id)
    return OkOut()
