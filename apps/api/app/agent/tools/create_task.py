import uuid
from collections.abc import Mapping
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.agent.serialize import task_brief
from app.agent.timeutil import due_at
from app.agent.tools.base import Tool, ToolContext, ToolResult
from app.schemas.work import TaskCreate
from app.services import tasks as tasks_service
from app.services import undo
from app.services.activities import collect_activities


class TaskSpec(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    due_at: datetime | None = None
    due_in_days: int | None = Field(default=None, ge=0, le=365)
    related_type: Literal["company", "contact", "deal"] | None = None
    related_id: uuid.UUID | None = None


class CreateTaskArgs(BaseModel):
    tasks: list[TaskSpec] = Field(min_length=1, max_length=50)


class CreateTaskTool(Tool[CreateTaskArgs]):
    name = "create_task"
    label = "Creating tasks"
    description = "Create one or many tasks, optionally linked to a record."
    mutating = True
    Args = CreateTaskArgs

    def describe(self, args: CreateTaskArgs, terms: Mapping[str, str] | None = None) -> str:
        if len(args.tasks) == 1:
            return f"Creating task “{args.tasks[0].title}”"
        return f"Creating {len(args.tasks)} tasks"

    async def run(self, tctx: ToolContext, args: CreateTaskArgs) -> ToolResult:
        created = []
        with collect_activities() as activity_ids:
            for spec in args.tasks:
                when = spec.due_at or (
                    due_at(spec.due_in_days, tz=tctx.timezone)
                    if spec.due_in_days is not None
                    else None
                )
                task = await tasks_service.create_task(
                    tctx.ctx,
                    TaskCreate(
                        title=spec.title,
                        due_at=when,
                        related_type=spec.related_type,
                        related_id=spec.related_id,
                    ),
                )
                created.append(task)
        outs = [await tasks_service.get_task(tctx.ctx, t.id) for t in created]
        n = len(outs)
        return ToolResult(
            ok=True,
            summary=f"Created {n} task{'s' if n != 1 else ''}",
            data={"tasks": [task_brief(t) for t in outs]},
            inverse_data={
                "task_ids": [str(t.id) for t in created],
                "activity_ids": [str(a) for a in activity_ids],
            },
        )

    async def undo(self, tctx: ToolContext, inverse: dict[str, Any]) -> None:
        await undo.delete_activities(
            tctx.ctx, [uuid.UUID(a) for a in inverse.get("activity_ids", [])]
        )
        await undo.delete_tasks(tctx.ctx, [uuid.UUID(t) for t in inverse.get("task_ids", [])])
