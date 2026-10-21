"""Unknown intent → helpful reply with four clickable example prompts adapted to the page."""

from app.agent.providers.base import SuggestionsStep
from app.agent.scenarios.common import ScenarioGen
from app.agent.scenarios.kit import Kit


def suggestions_for(kit: Kit) -> list[str]:
    if kit.ctx.record_type:
        return [
            "Summarize this",
            "Draft a follow-up email",
            "Remind me to follow up tomorrow",
            "What's on my plate today?",
        ]
    if kit.ctx.route.startswith("/pipeline"):
        return [
            "How's the pipeline this month?",
            "Find stale deals and create follow-ups",
            "Show me hot leads",
            "What's on my plate today?",
        ]
    return [
        "What's on my plate today?",
        "Find stale deals and create follow-ups",
        "Show me hot leads",
        "How's the pipeline this month?",
    ]


async def run(kit: Kit) -> ScenarioGen:
    async for s in kit.say(
        "I'm not sure I can help with that yet. I work best inside your pipeline — I can brief you, "
        f"find {kit.term('deals').lower()} that need attention, move cards, create tasks and draft emails. Try one of these:"
    ):
        yield s
    yield SuggestionsStep(suggestions_for(kit))
