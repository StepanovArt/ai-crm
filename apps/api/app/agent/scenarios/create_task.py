"""Extra — "Remind me to call Aaron tomorrow": plan a single task (linked to the open record)."""

from app.agent.providers.base import PlannedStep, PlanStep
from app.agent.scenarios.common import INVALIDATE_ALL, ScenarioGen
from app.agent.scenarios.kit import Kit
from app.agent.scenarios.parse import parse_due_days, parse_task_title
from app.agent.timeutil import local_now


async def run(kit: Kit) -> ScenarioGen:
    title = parse_task_title(kit.message)
    days = parse_due_days(kit.message, local_now(kit.ctx.timezone).weekday())
    when = "today" if days == 0 else "tomorrow" if days == 1 else f"in {days} days"
    spec: dict[str, object] = {"title": title, "due_in_days": days}
    linked = ""
    if kit.ctx.record_type and kit.ctx.record_id:
        spec.update(related_type=kit.ctx.record_type, related_id=str(kit.ctx.record_id))
        linked = f", linked to this {kit.term(kit.ctx.record_type).lower()}"
    async for s in kit.say(f"I'll create a task **{title}**, due {when} at 10:00{linked}."):
        yield s
    yield PlanStep(
        title=f"Create task: {title}",
        steps=[PlannedStep(label=title, tool="create_task", args={"tasks": [spec]})],
        finale=[
            {"kind": "invalidate", "query_keys": INVALIDATE_ALL},
            {"kind": "toast", "text": "Task created"},
        ],
        thinking="Creating the task",
        summary=f"Done — **{title}** is on your list for {when}.",
    )
