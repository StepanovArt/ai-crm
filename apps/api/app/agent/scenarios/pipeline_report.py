"""S5 — "How's the pipeline this month?": pipeline_stats → narrative + chart card."""

from typing import Any

from app.agent.providers.base import SuggestionsStep, ToolCallStep
from app.agent.scenarios.common import ScenarioGen, need
from app.agent.scenarios.kit import Kit
from app.agent.timeutil import money


async def run(kit: Kit) -> ScenarioGen:
    async for s in kit.think("Crunching this month's numbers"):
        yield s
    stats = need((yield ToolCallStep("pipeline_stats", {})))
    if not stats.ok:
        async for s in kit.say(
            "There's no pipeline yet — create one in Settings and I'll report on it."
        ):
            yield s
        return
    d = stats.data
    cur = str(d["currency"])
    deals_word = kit.term("deals").lower()
    stages: list[dict[str, Any]] = list(d["stages"])
    open_stages = [s for s in stages if s["kind"] == "open"]
    biggest = max(open_stages, key=lambda s: float(s["value"]), default=None)
    late = max(open_stages, key=lambda s: (s["probability"], float(s["value"])), default=None)

    won_n = int(d["won_this_month_count"])
    lines = [
        (
            f"This month you've closed **{money(d['won_this_month_value'], cur)}** across {won_n} won "
            f"{kit.term('deal').lower() if won_n == 1 else deals_word}."
            if won_n
            else f"No {deals_word} closed won yet this month."
        ),
        f"Open pipeline is **{money(d['open_value'], cur)}** across {d['open_count']} {deals_word} — "
        f"**{money(d['weighted_value'], cur)}** weighted by stage probability.",
    ]
    if biggest and late and biggest["id"] != late["id"]:
        lines.append(
            f"The biggest stage is *{biggest['name']}* ({money(biggest['value'], cur)}); "
            f"*{late['name']}* holds {money(late['value'], cur)} at {late['probability']}% probability — "
            "that's where the near-term revenue is."
        )
    elif biggest:
        lines.append(
            f"Most of the value sits in *{biggest['name']}* ({money(biggest['value'], cur)})."
        )
    if d["stale_count"]:
        lines.append(
            f"Heads-up: {d['stale_count']} open {deals_word} have had no activity for a week."
        )
    async for s in kit.say(" ".join(lines)):
        yield s
    async for s in kit.card(
        "chart",
        {
            "title": f"{d['pipeline']['name']} by stage",
            "currency": cur,
            "series": [
                {
                    "id": s["id"],
                    "name": s["name"],
                    "color": s["color"],
                    "kind": s["kind"],
                    "count": s["count"],
                    "value": s["value"],
                    "weighted": s["weighted"],
                }
                for s in stages
            ],
            "totals": {
                k: d[k]
                for k in (
                    "open_value",
                    "weighted_value",
                    "won_this_month_value",
                    "won_this_month_count",
                    "open_count",
                    "stale_count",
                )
            },
        },
    ):
        yield s
    yield SuggestionsStep(
        ["Find stale deals and create follow-ups", "Show me hot leads"]
        if d["stale_count"]
        else ["Show me hot leads"]
    )
