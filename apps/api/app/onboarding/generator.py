"""Mock onboarding generator.

Matches a one-sentence business description to an industry template, then builds the
workspace step by step with `WorkspaceBuilder`, streaming progress so the frontend can
assemble a live skeleton of the app. Everything runs in one transaction: a dropped
connection leaves the workspace untouched and onboarding can simply be retried.
"""

import asyncio
import logging
import random
import re
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.agent.timeutil import money
from app.errors import ConflictError, NotFoundError
from app.models import (
    Activity,
    Company,
    Contact,
    Deal,
    FieldDefinition,
    Note,
    Pipeline,
    Task,
    User,
    Workspace,
)
from app.onboarding.events import (
    AnyOnboardingEvent,
    DealPreview,
    FieldPreview,
    OnboardingDoneEvent,
    OnboardingErrorEvent,
    OnboardingStepEvent,
    OnboardingTemplateEvent,
    OnboardingThinkingEvent,
    StagePreview,
    StepId,
    StepOutline,
)
from app.onboarding.templates import DEFAULT_TEMPLATE, TEMPLATES, IndustryTemplate
from app.seed.builder import WorkspaceBuilder
from app.services.scoring import HOT_SCORE
from app.services.workspaces import DEFAULT_TERMINOLOGY, effective_terminology

log = logging.getLogger(__name__)

# Teammates get a password hash argon2 can never verify, so they cannot sign in.
UNUSABLE_PASSWORD = "!unusable"
COUNTS = {"companies": 30, "contacts": 60, "deals": 25, "tasks": 40}
_OBJECTS = (("deal", "deals"), ("company", "companies"), ("contact", "contacts"))


# ---- template matching ---------------------------------------------------------------------


@dataclass(frozen=True)
class TemplateMatch:
    template: IndustryTemplate
    matched: list[str]


def match_template(description: str) -> TemplateMatch:
    """Keyword match with word boundaries. Phrases weigh more than single words; ties go
    to the template whose first match appears earliest (the sentence's subject)."""
    text = " ".join(description.lower().split())
    best: tuple[int, int] | None = None
    result = TemplateMatch(DEFAULT_TEMPLATE, [])
    for template in TEMPLATES.values():
        score, first, hits = 0, len(text), list[str]()
        for raw in template.keywords:
            keyword = raw.strip().lower()
            found = re.search(rf"(?<!\w){re.escape(keyword)}(?!\w)", text)
            if found:
                score += len(keyword.split())
                first = min(first, found.start())
                hits.append(keyword)
        if score and (best is None or (score, -first) > best):
            best = (score, -first)
            # Drop words already covered by a matched phrase ("industrial" in "industrial equipment").
            shown = [h for h in hits if not any(h != o and h in o.split() for o in hits)]
            result = TemplateMatch(template, shown)
    return result


# ---- workspace preparation -----------------------------------------------------------------


def workspace_seed(workspace_id: uuid.UUID) -> int:
    return workspace_id.int % 2**31


async def clear_workspace(session: AsyncSession, workspace_id: uuid.UUID) -> None:
    """Remove records created before onboarding finished (pipelines cascade to stages/deals)."""
    for model in (Activity, Note, Task, Deal, Contact, Company, Pipeline, FieldDefinition):
        await session.execute(delete(model).where(model.workspace_id == workspace_id))
    await session.flush()


async def lock_pending_workspace(
    session: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID
) -> tuple[Workspace, User]:
    """Lock the workspace row so concurrent onboarding requests run one after another."""
    workspace = await session.scalar(
        select(Workspace).where(Workspace.id == workspace_id).with_for_update()
    )
    user = await session.get(User, user_id)
    if workspace is None or user is None:
        raise NotFoundError("Workspace not found")
    if workspace.onboarding_completed:
        raise ConflictError("This workspace is already set up")
    return workspace, user


def make_builder(
    session: AsyncSession, workspace: Workspace, owner: User, template: IndustryTemplate
) -> WorkspaceBuilder:
    return WorkspaceBuilder(session, workspace, owner, template, seed=workspace_seed(workspace.id))


async def build_instantly(
    session: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID, template: IndustryTemplate
) -> Workspace:
    """The "skip" path: build the whole workspace in one go, no streaming."""
    workspace, user = await lock_pending_workspace(session, workspace_id, user_id)
    await clear_workspace(session, workspace.id)
    builder = make_builder(session, workspace, user, template)
    await builder.add_teammates(UNUSABLE_PASSWORD, _teammate_domain(workspace.id))
    await builder.build_all(**COUNTS)
    return workspace


def _teammate_domain(workspace_id: uuid.UUID) -> str:
    return f"team-{workspace_id.hex[:8]}.example.com"


# ---- step labels ---------------------------------------------------------------------------


def _terms(template: IndustryTemplate) -> dict[str, str]:
    return effective_terminology(template.terminology)


def _field_labels(template: IndustryTemplate, limit: int = 3) -> str:
    labels = [f.label for specs in template.fields.values() for f in specs]
    head = ", ".join(labels[:limit])
    return f"{head}…" if len(labels) > limit else head


def outline(template: IndustryTemplate) -> list[StepOutline]:
    t = _terms(template)
    flow = " → ".join(s.name for s in template.stages if s.kind != "lost")
    labels: list[tuple[StepId, str]] = [
        ("terminology", "Adapting the vocabulary to your business"),
        ("pipeline", f"Creating pipeline: {flow}"),
        ("fields", f"Adding fields: {_field_labels(template)}"),
        ("companies", f"Generating {COUNTS['companies']} sample {t['companies'].lower()}"),
        ("contacts", f"Adding {COUNTS['contacts']} {t['contacts'].lower()} with roles and emails"),
        ("deals", f"Spreading {COUNTS['deals']} {t['deals'].lower()} across the pipeline"),
        ("history", "Writing three months of emails, meetings and notes"),
        ("tasks", f"Scheduling follow-ups and scoring {t['contacts'].lower()}"),
    ]
    return [StepOutline(id=i, label=label) for i, label in labels]


def _renamed(terms: dict[str, str]) -> str:
    pairs = [
        f"{DEFAULT_TERMINOLOGY[plural]} → {terms[plural]}"
        for _, plural in _OBJECTS
        if terms[plural] != DEFAULT_TERMINOLOGY[plural]
    ]
    return ", ".join(pairs) if pairs else "Deals, Companies and Contacts"


# ---- streaming generator -------------------------------------------------------------------


@dataclass
class _Pacer:
    scale: float
    rng: random.Random

    async def pause(self, lo_ms: int, hi_ms: int) -> None:
        if self.scale > 0:
            await asyncio.sleep(self.rng.uniform(lo_ms, hi_ms) * self.scale / 1000)


async def generate(
    maker: async_sessionmaker[AsyncSession],
    *,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    description: str,
    delay_scale: float = 1.0,
) -> AsyncIterator[AnyOnboardingEvent]:
    pace = _Pacer(delay_scale, random.Random(workspace_id.int))
    match = match_template(description)
    template = match.template
    steps = {s.id: s.label for s in outline(template)}

    yield OnboardingThinkingEvent(text="Reading your description…")
    await pace.pause(700, 1000)
    if match.matched:
        quoted = ", ".join(f"“{m}”" for m in match.matched[:3])
        thought = f"Sounds like {template.name.lower()} — picked up on {quoted}."
    else:
        thought = "I'll start from a general B2B setup — everything can be renamed later."
    yield OnboardingThinkingEvent(text=thought)
    await pace.pause(600, 900)
    yield OnboardingTemplateEvent(
        key=template.key,
        name=template.name,
        tagline=template.tagline,
        matched=match.matched,
        steps=outline(template),
    )
    await pace.pause(300, 500)

    async with maker() as session:
        try:
            workspace, user = await lock_pending_workspace(session, workspace_id, user_id)
        except (ConflictError, NotFoundError) as exc:
            yield OnboardingErrorEvent(message=exc.message)
            return
        try:
            await clear_workspace(session, workspace.id)
            b = make_builder(session, workspace, user, template)

            def running(step: StepId) -> OnboardingStepEvent:
                return OnboardingStepEvent(id=step, status="running", label=steps[step])

            def done(step: StepId, **data: object) -> OnboardingStepEvent:
                return OnboardingStepEvent.model_validate(
                    {"id": step, "status": "done", "label": steps[step], **data}
                )

            yield running("terminology")
            await pace.pause(400, 600)
            terms = await b.apply_terminology()
            await b.add_teammates(UNUSABLE_PASSWORD, _teammate_domain(workspace.id))
            yield done("terminology", terminology=terms, detail=_renamed(terms))

            yield running("pipeline")
            stages = await b.create_pipeline()
            # Long enough for the skeleton to drop columns in one by one.
            await pace.pause(500 + 120 * len(stages), 700 + 140 * len(stages))
            yield done(
                "pipeline",
                stages=[
                    StagePreview(name=s.name, color=s.color, kind=s.kind, probability=s.probability)
                    for s in stages
                ],
                detail=f"{len(stages)} stages in “{template.pipeline_name}”",
            )

            yield running("fields")
            await pace.pause(400, 650)
            fields = await b.create_fields()
            previews = [
                FieldPreview(object_type=obj, label=f.label, type=f.type)
                for obj, defs in fields.items()
                for f in defs
            ]
            per_object = ", ".join(
                f"{len(fields.get(obj, []))} on {terms[plural].lower()}" for obj, plural in _OBJECTS
            )
            yield done("fields", fields=previews, count=len(previews), detail=per_object)

            yield running("companies")
            await pace.pause(350, 550)
            companies = await b.create_companies(COUNTS["companies"])
            yield done(
                "companies",
                count=len(companies),
                samples=[c.name for c in companies[:6]],
                detail=", ".join(c.name for c in companies[:2]) + "…",
            )

            yield running("contacts")
            await pace.pause(350, 550)
            contacts = await b.create_contacts(COUNTS["contacts"])
            yield done(
                "contacts",
                count=len(contacts),
                samples=[f"{c.first_name} {c.last_name}" for c in contacts[:6]],
                detail=f"{len({c.title for c in contacts})} different roles",
            )

            yield running("deals")
            await pace.pause(400, 600)
            deals = await b.create_deals(COUNTS["deals"])
            names = {c.id: c.name for c in companies}
            shown: dict[int, int] = {}
            deal_previews: list[DealPreview] = []
            for plan in b.deal_plans:
                if shown.get(plan.stage_index, 0) < 3:
                    shown[plan.stage_index] = shown.get(plan.stage_index, 0) + 1
                    deal_previews.append(
                        DealPreview(
                            name=plan.deal.name,
                            stage_index=plan.stage_index,
                            value=plan.deal.value,
                            currency=plan.deal.currency,
                            company=names.get(plan.deal.company_id)
                            if plan.deal.company_id
                            else None,
                        )
                    )
            total = sum(
                (p.deal.value or 0 for p in b.deal_plans if b.stages[p.stage_index].kind == "open"),
                start=Decimal(0),
            )
            currency = template.flavor.currency
            yield done(
                "deals",
                count=len(deals),
                deals=deal_previews,
                detail=f"{money(total, currency)} in open pipeline",
            )

            yield running("history")
            activities = await b.create_history()
            await pace.pause(300, 500)
            yield done(
                "history", count=activities, detail=f"{activities} activities on the timeline"
            )

            yield running("tasks")
            tasks = await b.create_tasks(COUNTS["tasks"])
            await b.finalize()
            hot = await session.scalar(
                select(func.count())
                .select_from(Contact)
                .where(Contact.workspace_id == workspace.id, Contact.score >= HOT_SCORE)
            )
            await pace.pause(400, 600)
            yield done(
                "tasks",
                count=len(tasks),
                detail=f"{len(tasks)} tasks, {hot or 0} hot {terms['contacts'].lower()} to call first",
            )
            await session.commit()
        except Exception:
            log.exception("onboarding build failed")
            await session.rollback()
            yield OnboardingErrorEvent(
                message="Something went wrong while building your workspace. Nothing was saved."
            )
            return

    await pace.pause(400, 600)
    yield OnboardingDoneEvent(workspace_id=str(workspace_id))
