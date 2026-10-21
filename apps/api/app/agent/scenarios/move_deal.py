"""S3 — "Move Acme to Negotiation": fuzzy-match deal + stage → plan → move_card animation."""

from typing import Any

from app.agent.matching import best_matches, match_stage
from app.agent.providers.base import PlannedStep, PlanStep, SuggestionsStep, ToolCallStep
from app.agent.scenarios.common import INVALIDATE_ALL, ScenarioGen, items, need
from app.agent.scenarios.kit import Kit
from app.agent.scenarios.parse import parse_move, refers_to_context
from app.agent.timeutil import money


async def run(kit: Kit) -> ScenarioGen:
    parsed = parse_move(kit.message)
    deal_word = kit.term("deal").lower()
    if parsed is None:
        async for s in kit.say(
            f"Which {deal_word} should I move, and to which stage? For example: *Move Acme to Negotiation*."
        ):
            yield s
        return
    deal_query, stage_query = parsed

    async for s in kit.think(f"Finding the {deal_word}"):
        yield s
    deal: dict[str, Any] | None = None
    if refers_to_context(deal_query) and kit.ctx.record_type == "deal" and kit.ctx.record_id:
        got = need(
            (
                yield ToolCallStep(
                    "get_record", {"record_type": "deal", "record_id": str(kit.ctx.record_id)}
                )
            )
        )
        deal = got.data.get("record") if got.ok else None
    else:
        found = need(
            (
                yield ToolCallStep(
                    "search_records", {"object_type": "deal", "query": deal_query, "limit": 10}
                )
            )
        )
        candidates = items(found)
        if not candidates:
            # No substring hit: fuzzy-match across open deals (handles typos like "Akme").
            wide = need(
                (
                    yield ToolCallStep(
                        "search_records", {"object_type": "deal", "status": "open", "limit": 50}
                    )
                )
            )
            candidates = [
                c
                for c, _ in best_matches(
                    deal_query, [(c, c["title"]) for c in items(wide)], threshold=0.62
                )
            ]
        open_first = sorted(candidates, key=lambda c: (c.get("stage") or {}).get("kind") != "open")
        ranked = [
            c
            for c, _ in best_matches(
                deal_query, [(c, c["title"]) for c in open_first], threshold=0.0
            )
        ] or open_first
        if len(ranked) > 1:
            top, second = best_matches(
                deal_query, [(c, c["title"]) for c in ranked[:2]], threshold=0.0
            )[:2]
            both_open = all((c.get("stage") or {}).get("kind") == "open" for c, _ in (top, second))
            if both_open and abs(top[1] - second[1]) < 0.04:
                names = [c["title"] for c in ranked[:3]]
                async for s in kit.say(
                    f"I found a few {kit.term('deals').lower()} matching “{deal_query}”. Which one did you mean?"
                ):
                    yield s
                yield SuggestionsStep([f"Move {n} to {stage_query}" for n in names])
                return
        deal = ranked[0] if ranked else None

    if deal is None:
        async for s in kit.say(
            f"I couldn't find a {deal_word} matching “{deal_query}”. Could you give me a bit more of the name?"
        ):
            yield s
        return

    stats = need(
        (
            yield ToolCallStep(
                "pipeline_stats", {"pipeline_id": deal["pipeline_id"]}, "Checking the stages"
            )
        )
    )
    stages: list[dict[str, Any]] = list(stats.data.get("stages", []))
    target = match_stage(stage_query, [(s, s["name"]) for s in stages])
    if target is None:
        stage_names = ", ".join(st["name"] for st in stages)
        async for s in kit.say(
            f"There's no stage called “{stage_query}” in this pipeline. The stages are: {stage_names}."
        ):
            yield s
        return
    current = deal.get("stage") or {}
    if current.get("id") == target["id"]:
        async for s in kit.say(
            f"**{deal['title']}** is already in *{target['name']}* — nothing to change."
        ):
            yield s
        return

    value = money(deal["value"], deal.get("currency", "USD"))
    async for s in kit.say(
        f"**{deal['title']}** is in *{current.get('name', 'its current stage')}* ({value}). "
        f"I'll move it to **{target['name']}** and log the change on its timeline."
    ):
        yield s
    card = f"deal-card-{deal['id']}"
    board_href = f"/pipeline/{deal['pipeline_id']}"
    prelude = (
        [] if kit.ctx.route.startswith(board_href) else [{"kind": "navigate", "href": board_href}]
    )
    yield PlanStep(
        title=f"Move {deal['title']} to {target['name']}",
        steps=[
            PlannedStep(
                label=f"Move from {current.get('name', '—')} to {target['name']}",
                tool="move_deal_stage",
                args={"deal_id": deal["id"], "stage_id": target["id"], "index": 0},
                before=[{"kind": "highlight", "target": card, "duration_ms": 900}],
                after=[
                    {"kind": "move_card", "deal_id": deal["id"], "to_stage_id": target["id"]},
                    {"kind": "highlight", "target": card, "duration_ms": 900},
                ],
            )
        ],
        prelude=prelude,
        finale=[
            {"kind": "invalidate", "query_keys": INVALIDATE_ALL},
            {"kind": "toast", "text": f"Moved {deal['title']} to {target['name']}"},
        ],
        thinking=f"Moving the {deal_word}",
        summary=f"Moved **{deal['title']}** to **{target['name']}** and logged it on the timeline.",
        failure=f"I couldn't move the {deal_word} — it's unchanged.",
    )
    async for s in kit.say("Approve to apply it."):
        yield s
