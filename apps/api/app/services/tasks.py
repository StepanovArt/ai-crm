import uuid
from datetime import datetime, timedelta

from sqlalchemy import case, func, select

from app.models import Task
from app.models.base import utcnow
from app.schemas.work import TaskCreate, TaskFilter, TaskOut, TaskUpdate
from app.services.activities import record_activity
from app.services.common import ensure_member
from app.services.context import Ctx
from app.services.listing import ListParams, like, sort_clauses
from app.services.related import ensure_related, resolve
from app.services.scoping import get_scoped, scoped


def day_bounds(now: datetime | None = None) -> tuple[datetime, datetime]:
    now = now or utcnow()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return start, start + timedelta(days=1)


async def enrich(ctx: Ctx, tasks: list[Task]) -> list[TaskOut]:
    related = await resolve(ctx, ((t.related_type, t.related_id) for t in tasks))
    out: list[TaskOut] = []
    for t in tasks:
        item = TaskOut.model_validate(t)
        if t.related_type and t.related_id:
            item.related = related.get((t.related_type, t.related_id))
        out.append(item)
    return out


async def list_tasks(ctx: Ctx, params: ListParams, flt: TaskFilter) -> tuple[list[TaskOut], int]:
    stmt = scoped(Task, ctx.workspace_id)
    if params.q:
        stmt = stmt.where(Task.title.ilike(like(params.q)))
    if flt.ids:
        stmt = stmt.where(Task.id.in_(flt.ids))
    if flt.done is not None:
        stmt = stmt.where(Task.done == flt.done)
    if flt.assignee_id:
        stmt = stmt.where(Task.assignee_id == flt.assignee_id)
    if flt.related_type:
        stmt = stmt.where(Task.related_type == flt.related_type)
    if flt.related_id:
        stmt = stmt.where(Task.related_id == flt.related_id)
    if flt.created_by:
        stmt = stmt.where(Task.created_by == flt.created_by)
    if flt.bucket:
        start, end = day_bounds()
        if flt.bucket == "overdue":
            stmt = stmt.where(Task.done.is_(False), Task.due_at < start)
        elif flt.bucket == "today":
            stmt = stmt.where(Task.done.is_(False), Task.due_at >= start, Task.due_at < end)
        elif flt.bucket == "upcoming":
            stmt = stmt.where(Task.done.is_(False), (Task.due_at >= end) | Task.due_at.is_(None))
        elif flt.bucket == "open":
            stmt = stmt.where(Task.done.is_(False))
        else:
            stmt = stmt.where(Task.done.is_(True))
    total = await ctx.session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    order = sort_clauses(
        params.sort,
        {
            "due_at": Task.due_at,
            "created_at": Task.created_at,
            "title": Task.title,
            "done": case((Task.done.is_(True), 1), else_=0),
            "completed_at": Task.completed_at,
        },
        default="done,due_at",
    )
    stmt = stmt.order_by(*order, Task.id).offset(params.offset).limit(params.safe_limit)
    rows = list((await ctx.session.scalars(stmt)).all())
    return await enrich(ctx, rows), total


async def get_task(ctx: Ctx, task_id: uuid.UUID) -> TaskOut:
    task = await get_scoped(ctx, Task, task_id, "Task")
    return (await enrich(ctx, [task]))[0]


async def create_task(ctx: Ctx, data: TaskCreate) -> Task:
    await ensure_related(ctx, data.related_type, data.related_id)
    await ensure_member(ctx, data.assignee_id, "Assignee")
    task = Task(
        workspace_id=ctx.workspace_id,
        title=data.title.strip(),
        due_at=data.due_at,
        done=False,
        assignee_id=data.assignee_id or ctx.user_id,
        related_type=data.related_type,
        related_id=data.related_id,
        created_by="agent" if ctx.actor_type == "agent" else "user",
    )
    ctx.session.add(task)
    await ctx.session.flush()
    if task.related_type and task.related_id:
        await record_activity(
            ctx,
            "task_created",
            task.related_type,
            task.related_id,
            {"task_id": str(task.id), "title": task.title},
        )
    return task


async def update_task(ctx: Ctx, task_id: uuid.UUID, data: TaskUpdate) -> Task:
    task = await get_scoped(ctx, Task, task_id, "Task")
    patch = data.model_dump(exclude_unset=True)
    if "assignee_id" in patch:
        await ensure_member(ctx, patch["assignee_id"], "Assignee")
        task.assignee_id = patch["assignee_id"]
    if patch.get("title"):
        task.title = patch["title"].strip()
    if "due_at" in patch:
        task.due_at = patch["due_at"]
    if "done" in patch and patch["done"] is not None and patch["done"] != task.done:
        task.done = patch["done"]
        task.completed_at = utcnow() if task.done else None
        if task.done and task.related_type and task.related_id:
            await record_activity(
                ctx,
                "task_completed",
                task.related_type,
                task.related_id,
                {"task_id": str(task.id), "title": task.title},
            )
    await ctx.session.flush()
    return task


async def delete_task(ctx: Ctx, task_id: uuid.UUID) -> None:
    task = await get_scoped(ctx, Task, task_id, "Task")
    await ctx.session.delete(task)
    await ctx.session.flush()
