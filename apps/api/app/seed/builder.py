"""Deterministic workspace builder shared by the demo seed and onboarding.

Each step is a separate coroutine so onboarding can stream progress between steps.
Randomness comes from one seeded `random.Random` + `Faker`, so the same seed always
produces the same records (including ids).
"""

import itertools
import random
import re
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, time, timedelta
from decimal import Decimal
from typing import Any

from faker import Faker
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Activity,
    Company,
    Contact,
    Deal,
    FieldDefinition,
    Membership,
    Note,
    Pipeline,
    Stage,
    Task,
    User,
    Workspace,
)
from app.models.base import utcnow
from app.onboarding.templates.base import FieldSpec, IndustryTemplate
from app.services.context import Ctx
from app.services.scoring import recompute_all
from app.services.workspaces import effective_terminology

# How many deals land in each stage, by stage index (open stages first, then won, lost).
_STAGE_WEIGHTS_OPEN = (4, 4, 4, 4, 3)


@dataclass
class _DealPlan:
    deal: Deal
    stage_index: int
    created_at: datetime
    stale: bool
    hot: bool


@dataclass
class WorkspaceBuilder:
    session: AsyncSession
    workspace: Workspace
    owner: User
    template: IndustryTemplate
    seed: int
    now: datetime = field(default_factory=utcnow)

    def __post_init__(self) -> None:
        self.rng = random.Random(self.seed)
        self.fake = Faker()
        self.fake.seed_instance(self.seed)
        self.users: list[User] = [self.owner]
        self.pipeline: Pipeline | None = None
        self.stages: list[Stage] = []
        self.fields: dict[str, list[FieldDefinition]] = {}
        self.companies: list[Company] = []
        self.contacts: list[Contact] = []
        self.deal_plans: list[_DealPlan] = []
        self.activity_count = 0

    # ---- helpers ---------------------------------------------------------------------------

    def uid(self) -> uuid.UUID:
        return uuid.UUID(int=self.rng.getrandbits(128), version=4)

    def ago(self, days: float, *, jitter_hours: bool = True) -> datetime:
        hours = self.rng.uniform(-3, 3) if jitter_hours else 0
        when = self.now - timedelta(days=days, hours=hours)
        return min(when, self.now - timedelta(minutes=5))

    def pick_owner(self) -> User:
        # The signed-in user owns a bit more than half of everything.
        if len(self.users) == 1 or self.rng.random() < 0.55:
            return self.owner
        return self.rng.choice(self.users[1:])

    @property
    def ctx(self) -> Ctx:
        return Ctx(
            session=self.session,
            workspace_id=self.workspace.id,
            user_id=self.owner.id,
            actor_type="system",
        )

    def _activity(
        self,
        type: str,
        related_type: str,
        related_id: uuid.UUID,
        when: datetime,
        payload: dict[str, Any],
        actor: User | None = None,
    ) -> Activity:
        self.activity_count += 1
        activity = Activity(
            id=self.uid(),
            workspace_id=self.workspace.id,
            type=type,
            actor_type="user",
            actor_id=(actor or self.owner).id,
            related_type=related_type,
            related_id=related_id,
            payload=payload,
            occurred_at=when,
            created_at=when,
            updated_at=when,
        )
        self.session.add(activity)
        return activity

    # ---- steps -----------------------------------------------------------------------------

    async def apply_terminology(self) -> dict[str, str]:
        self.workspace.industry = self.template.key
        self.workspace.terminology = effective_terminology(self.template.terminology)
        await self.session.flush()
        return self.workspace.terminology

    async def add_teammates(self, password_hash: str, email_domain: str) -> list[User]:
        for full_name in self.template.teammates:
            first, last = full_name.lower().split(" ", 1)
            user = User(
                id=self.uid(),
                email=f"{first}.{last.replace(' ', '')}@{email_domain}",
                password_hash=password_hash,
                full_name=full_name,
            )
            self.session.add(user)
            await self.session.flush()
            self.session.add(
                Membership(user_id=user.id, workspace_id=self.workspace.id, role="member")
            )
            self.users.append(user)
        await self.session.flush()
        return self.users[1:]

    async def create_pipeline(self) -> list[Stage]:
        self.pipeline = Pipeline(
            id=self.uid(),
            workspace_id=self.workspace.id,
            name=self.template.pipeline_name,
            position=0,
        )
        self.session.add(self.pipeline)
        await self.session.flush()
        for i, spec in enumerate(self.template.stages):
            stage = Stage(
                id=self.uid(),
                pipeline_id=self.pipeline.id,
                name=spec.name,
                position=i,
                color=spec.color,
                probability=spec.probability,
                kind=spec.kind,
            )
            self.session.add(stage)
            self.stages.append(stage)
        await self.session.flush()
        return self.stages

    async def create_fields(self) -> dict[str, list[FieldDefinition]]:
        for object_type, specs in self.template.fields.items():
            defs: list[FieldDefinition] = []
            for i, spec in enumerate(specs):
                defn = FieldDefinition(
                    id=self.uid(),
                    workspace_id=self.workspace.id,
                    object_type=object_type,
                    key=spec.key,
                    label=spec.label,
                    type=spec.type,
                    options=[
                        {"value": o.value, "label": o.label, "color": o.color} for o in spec.options
                    ],
                    position=i,
                    is_required=False,
                    is_system=False,
                )
                self.session.add(defn)
                defs.append(defn)
            self.fields[object_type] = defs
        await self.session.flush()
        return self.fields

    def _custom_values(self, object_type: str, context: dict[str, str]) -> dict[str, Any]:
        values: dict[str, Any] = {}
        for spec in self.template.fields.get(object_type, ()):
            if self.rng.random() > spec.fill_rate:
                continue
            value = self._sample(spec, context)
            if value is not None:
                values[spec.key] = value
        return values

    def _sample(self, spec: FieldSpec, context: dict[str, str]) -> Any:
        rng = self.rng
        if spec.type == "select" and spec.options:
            return rng.choice(spec.options).value
        if spec.type == "multi_select" and spec.options:
            k = rng.randint(1, min(3, len(spec.options)))
            return [o.value for o in rng.sample(list(spec.options), k)]
        if spec.type == "number":
            lo, hi = spec.number_range or (1, 100)
            return int(rng.uniform(lo, hi))
        if spec.type == "currency":
            lo, hi = spec.number_range or (1_000, 100_000)
            return str(Decimal(int(rng.uniform(lo, hi) / 500) * 500).quantize(Decimal("0.01")))
        if spec.type == "date":
            return (self.now + timedelta(days=rng.randint(10, 300))).date().isoformat()
        if spec.type == "checkbox":
            return rng.random() < 0.5
        if spec.type == "url":
            slug = context.get("slug", "profile")
            return f"https://linkedin.com/in/{slug}"
        if spec.type == "email":
            return self.fake.email()
        if spec.type == "phone":
            return self.fake.phone_number()
        if spec.type in ("text", "long_text"):
            return rng.choice(spec.samples) if spec.samples else None
        return None

    async def create_companies(self, count: int = 30) -> list[Company]:
        flavor = self.template.flavor
        names = list(flavor.company_names[:count])
        while len(names) < count:
            names.append(
                f"{self.fake.last_name()} {self.rng.choice(['Group', 'Partners', 'Holdings'])}"
            )
        for i, name in enumerate(names):
            slug = re.sub(r"[^a-z0-9]", "", name.lower())
            company = Company(
                id=self.uid(),
                workspace_id=self.workspace.id,
                name=name,
                domain=f"{slug}{flavor.tlds[i % len(flavor.tlds)]}" if flavor.domains else None,
                industry=self.rng.choice(flavor.industries),
                size=self.rng.choice(flavor.sizes),
                owner_id=self.pick_owner().id,
                custom=self._custom_values("company", {}),
                created_at=self.ago(self.rng.uniform(45, 90)),
            )
            self.session.add(company)
            self.companies.append(company)
        await self.session.flush()
        return self.companies

    async def create_contacts(self, count: int = 60) -> list[Contact]:
        flavor = self.template.flavor
        for i in range(count):
            company = self.companies[i % len(self.companies)] if self.companies else None
            first, last = self.fake.first_name(), self.fake.last_name()
            title = flavor.titles[(i * 7 + self.rng.randint(0, 3)) % len(flavor.titles)]
            if flavor.personal_email_domains:
                domain = self.rng.choice(flavor.personal_email_domains)
            else:
                domain = company.domain if company and company.domain else "example.com"
            slug = f"{first}-{last}".lower()
            contact = Contact(
                id=self.uid(),
                workspace_id=self.workspace.id,
                company_id=company.id if company else None,
                first_name=first,
                last_name=last,
                email=f"{first}.{last}@{domain}".lower(),
                phone=self.fake.numerify("+1 (###) ###-####"),
                title=title,
                owner_id=company.owner_id if company else self.owner.id,
                lead_status="new",
                score=0,
                custom=self._custom_values("contact", {"slug": slug}),
                created_at=self.ago(self.rng.uniform(30, 75)),
            )
            self.session.add(contact)
            self.contacts.append(contact)
        await self.session.flush()
        return self.contacts

    def _stage_layout(self, count: int) -> list[int]:
        """Stage index per deal, spread like a real funnel."""
        open_idx = [i for i, s in enumerate(self.stages) if s.kind == "open"]
        won_idx = next(i for i, s in enumerate(self.stages) if s.kind == "won")
        lost_idx = next(i for i, s in enumerate(self.stages) if s.kind == "lost")
        layout: list[int] = []
        weights = list(_STAGE_WEIGHTS_OPEN) + [3] * max(0, len(open_idx) - len(_STAGE_WEIGHTS_OPEN))
        for idx, weight in zip(open_idx, weights, strict=False):
            layout += [idx] * weight
        layout += [won_idx] * 4 + [lost_idx] * 2
        while len(layout) < count:
            layout.append(self.rng.choice(open_idx))
        return layout[:count]

    async def create_deals(self, count: int = 25) -> list[Deal]:
        assert self.pipeline is not None, "create_pipeline first"
        flavor = self.template.flavor
        lo, hi = flavor.value_range
        layout = self._stage_layout(count)
        # Companies with a primary contact (contacts are assigned round-robin to companies).
        positions: dict[int, int] = {}
        stale_budget = {"count": 0}
        for i, stage_index in enumerate(layout):
            company = self.companies[i % len(self.companies)]
            contact = next((c for c in self.contacts if c.company_id == company.id), None)
            stage = self.stages[stage_index]
            created = self.ago(self.rng.uniform(12, 58))
            pattern = flavor.deal_patterns[i % len(flavor.deal_patterns)]
            unit = ""
            if "{unit}" in pattern:  # only draw when used, so other templates' data stays stable
                prefix = self.rng.choice(flavor.unit_prefixes)
                unit = f"{prefix}-{self.rng.randint(1, 24)}{self.rng.randint(1, 12):02d}"
            name = pattern.format(
                company=company.name, first=contact.first_name if contact else "", unit=unit
            )
            value = Decimal(int(self.rng.uniform(lo, hi) / 500) * 500)
            is_open = stage.kind == "open"
            # Roughly every 4th open deal (but never in the first stage) goes stale.
            stale = is_open and stage_index > 0 and (i % 4 == 1) and stale_budget["count"] < 6
            if stale:
                stale_budget["count"] += 1
            hot = is_open and not stale and stage_index >= 2
            if is_open:
                expected = (self.now + timedelta(days=self.rng.randint(6, 80))).date()
            else:
                expected = (self.now - timedelta(days=self.rng.randint(1, 20))).date()
            pos = positions.get(stage_index, 0)
            positions[stage_index] = pos + 1
            deal = Deal(
                id=self.uid(),
                workspace_id=self.workspace.id,
                pipeline_id=self.pipeline.id,
                stage_id=stage.id,
                name=name,
                value=value,
                currency=flavor.currency,
                company_id=company.id,
                primary_contact_id=contact.id if contact else None,
                owner_id=company.owner_id,
                expected_close=expected,
                position=float(pos * 1000),
                custom=self._custom_values("deal", {}),
                created_at=created,
            )
            self.session.add(deal)
            self.deal_plans.append(_DealPlan(deal, stage_index, created, stale, hot))
        await self.session.flush()
        return [p.deal for p in self.deal_plans]

    async def create_history(self) -> int:
        """Activities + notes that make timelines, scores and staleness realistic."""
        flavor = self.template.flavor
        rng = self.rng
        contacts_by_id = {c.id: c for c in self.contacts}
        deal_contacts: set[uuid.UUID] = set()
        won_this_month = 0
        month_start = self.now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        for plan in self.deal_plans:
            deal = plan.deal
            owner = next((u for u in self.users if u.id == deal.owner_id), self.owner)
            # Last touch: stale deals went quiet 9-30 days ago, others within the last week.
            target = plan.stage_index
            stage_kind = self.stages[target].kind
            if stage_kind != "open":
                # Two wins land this month (for "won this month"); other closes happened earlier.
                if stage_kind == "won" and won_this_month < 2:
                    won_this_month += 1
                    closed_at = max(month_start + timedelta(hours=10), self.ago(rng.uniform(1, 6)))
                    closed_at = min(closed_at, self.now - timedelta(hours=3))
                else:
                    closed_at = self.ago(rng.uniform(24, 45))
                if plan.created_at > closed_at - timedelta(days=10):
                    plan.created_at = closed_at - timedelta(days=rng.uniform(15, 35))
                    deal.created_at = plan.created_at
                last_touch = closed_at
            elif plan.stale:
                last_touch = self.ago(rng.uniform(9, 30))
            else:
                last_touch = self.ago(rng.uniform(0.2, 6))
            last_touch = max(last_touch, plan.created_at + timedelta(hours=2))
            self._activity(
                "record_created", "deal", deal.id, plan.created_at, {"name": deal.name}, owner
            )

            # Stage progression from the first stage to the current one.
            path = (
                list(range(0, target + 1))
                if stage_kind == "open"
                else [*range(0, rng.randint(2, 4)), target]
            )
            span = (last_touch - plan.created_at).total_seconds()
            entered = plan.created_at
            # Open deals entered their current stage a while before the last touch.
            reach = 1.0 if stage_kind != "open" or plan.stale else rng.uniform(0.45, 0.85)
            for step, (frm, to) in enumerate(itertools.pairwise(path), start=1):
                frac = reach * step / max(1, len(path) - 1)
                when = plan.created_at + timedelta(seconds=span * frac)
                self._activity(
                    "stage_changed",
                    "deal",
                    deal.id,
                    when,
                    {
                        "from_stage_id": str(self.stages[frm].id),
                        "from_stage": self.stages[frm].name,
                        "to_stage_id": str(self.stages[to].id),
                        "to_stage": self.stages[to].name,
                    },
                    owner,
                )
                entered = when
            deal.stage_entered_at = entered
            deal.last_activity_at = max(last_touch, entered)

            contact = (
                contacts_by_id.get(deal.primary_contact_id) if deal.primary_contact_id else None
            )
            if contact is None:
                continue
            deal_contacts.add(contact.id)
            payload_deal = {"deal_id": str(deal.id)}
            n_touches = rng.randint(3, 7)
            for k in range(n_touches):
                frac = (k + 1) / n_touches
                when = plan.created_at + (last_touch - plan.created_at) * frac
                self._interaction(contact, when, payload_deal, owner, allow_reply=not plan.stale)
            if plan.hot:
                reply_at = self.ago(rng.uniform(0.5, 9))
                self._activity(
                    "email_received",
                    "contact",
                    contact.id,
                    reply_at,
                    {
                        "subject": rng.choice(flavor.reply_subjects or ("Re: Next steps",)),
                        "snippet": "Thanks — this looks good. Can we get the team together next week?",
                        **payload_deal,
                    },
                    owner,
                )
                scheduled = self.now + timedelta(days=rng.randint(1, 8))
                while scheduled.weekday() >= 5:
                    scheduled += timedelta(days=1)
                scheduled = datetime.combine(
                    scheduled.date(), time(rng.choice([10, 11, 14, 15, 16])), UTC
                )
                self._activity(
                    "meeting",
                    "contact",
                    contact.id,
                    self.ago(rng.uniform(0.5, 4)),
                    {
                        "title": rng.choice(flavor.meeting_titles or ("Follow-up meeting",)),
                        "scheduled_for": scheduled.isoformat(),
                        "duration_min": rng.choice([30, 45, 60]),
                        "status": "scheduled",
                        **payload_deal,
                    },
                    owner,
                )
                deal.last_activity_at = max(deal.last_activity_at or reply_at, reply_at)

        # Contacts without deals: light outreach, some with recent replies.
        for contact in self.contacts:
            if contact.id in deal_contacts:
                continue
            roll = rng.random()
            if roll < 0.45:
                continue  # never contacted
            owner = next((u for u in self.users if u.id == contact.owner_id), self.owner)
            touches = rng.randint(1, 3)
            for _ in range(touches):
                self._interaction(
                    contact, self.ago(rng.uniform(3, 50)), {}, owner, allow_reply=roll > 0.8
                )
            if roll > 0.85:
                self._activity(
                    "email_received",
                    "contact",
                    contact.id,
                    self.ago(rng.uniform(0.5, 10)),
                    {
                        "subject": rng.choice(flavor.reply_subjects or ("Re: Intro",)),
                        "snippet": "Interesting — send me more details when you get a chance.",
                    },
                    owner,
                )

        await self._create_notes()
        self._assign_lead_statuses()
        await self.session.flush()
        return self.activity_count

    def _assign_lead_statuses(self) -> None:
        """Lead status follows the furthest deal a contact is on, else whether we reached out."""
        touched = {
            a.related_id
            for a in self.session.new
            if isinstance(a, Activity) and a.related_type == "contact"
        }
        best: dict[uuid.UUID, str] = {}
        for plan in self.deal_plans:
            cid = plan.deal.primary_contact_id
            if cid is None:
                continue
            kind = self.stages[plan.stage_index].kind
            status = (
                "customer"
                if kind == "won"
                else "unqualified"
                if kind == "lost"
                else "qualified"
                if plan.stage_index >= 1
                else "contacted"
            )
            rank = ["new", "contacted", "unqualified", "qualified", "customer"]
            if rank.index(status) > rank.index(best.get(cid, "new")):
                best[cid] = status
        for contact in self.contacts:
            contact.lead_status = best.get(
                contact.id, "contacted" if contact.id in touched else "new"
            )

    def _interaction(
        self,
        contact: Contact,
        when: datetime,
        extra: dict[str, Any],
        owner: User,
        *,
        allow_reply: bool,
    ) -> None:
        flavor = self.template.flavor
        rng = self.rng
        kind = rng.choices(
            ["email_sent", "email_received", "call", "meeting"],
            weights=[5, 3 if allow_reply else 0, 3, 1],
        )[0]
        if kind == "email_sent":
            payload = {
                "subject": rng.choice(flavor.email_subjects or ("Following up",)),
                "snippet": f"Hi {contact.first_name}, following up on our last conversation.",
                "opens": rng.choice([0, 1, 1, 2, 3, 4]),
            }
        elif kind == "email_received":
            payload = {
                "subject": rng.choice(flavor.reply_subjects or ("Re: Following up",)),
                "snippet": "Thanks for the details, let me check with the team.",
            }
        elif kind == "call":
            payload = {
                "summary": rng.choice(flavor.call_summaries or ("Quick check-in call.",)),
                "duration_min": rng.choice([5, 12, 18, 25, 30]),
                "outcome": rng.choice(["connected", "connected", "voicemail"]),
            }
        else:
            payload = {
                "title": rng.choice(flavor.meeting_titles or ("Meeting",)),
                "duration_min": rng.choice([30, 45, 60]),
                "status": "completed",
            }
        self._activity(kind, "contact", contact.id, when, {**payload, **extra}, owner)

    async def _create_notes(self) -> None:
        bodies = self.template.flavor.note_bodies
        if not bodies:
            return
        targets = [p for p in self.deal_plans if self.stages[p.stage_index].kind == "open"][:12]
        for i, plan in enumerate(targets):
            when = plan.created_at + (self.now - plan.created_at) * self.rng.uniform(0.2, 0.7)
            body = bodies[i % len(bodies)]
            note = Note(
                id=self.uid(),
                workspace_id=self.workspace.id,
                related_type="deal",
                related_id=plan.deal.id,
                body=body,
                author_id=plan.deal.owner_id,
                created_by="user",
                created_at=when,
                updated_at=when,
            )
            self.session.add(note)
            author = next((u for u in self.users if u.id == plan.deal.owner_id), self.owner)
            self._activity(
                "note",
                "deal",
                plan.deal.id,
                when,
                {"note_id": str(note.id), "excerpt": body[:140]},
                author,
            )

    async def create_tasks(self, count: int = 40) -> list[Task]:
        flavor = self.template.flavor
        rng = self.rng
        open_plans = [p for p in self.deal_plans if self.stages[p.stage_index].kind == "open"]
        contacts_by_id = {c.id: c for c in self.contacts}
        companies_by_id = {c.id: c for c in self.companies}
        today = self.now.replace(hour=0, minute=0, second=0, microsecond=0)
        # bucket: (count share, due offset days range, done)
        buckets = [
            (6, (-6, -1), False),
            (7, (0, 0), False),
            (14, (1, 12), False),
            (13, (-20, -1), True),
        ]
        tasks: list[Task] = []
        i = 0
        for share, (lo, hi), done in buckets:
            for _ in range(round(share * count / 40)):
                plan = open_plans[i % len(open_plans)] if open_plans else None
                i += 1
                contact = (
                    contacts_by_id.get(plan.deal.primary_contact_id)
                    if plan and plan.deal.primary_contact_id
                    else None
                )
                company = (
                    companies_by_id.get(plan.deal.company_id)
                    if plan and plan.deal.company_id
                    else None
                )
                pattern = (
                    flavor.task_titles[i % len(flavor.task_titles)]
                    if flavor.task_titles
                    else "Follow up"
                )
                title = pattern.format(
                    first=contact.first_name if contact else "the team",
                    company=company.name if company else "the account",
                    deal=plan.deal.name if plan else "",
                )
                hour = rng.choice([9, 10, 11, 13, 14, 15, 16, 17])
                due = today + timedelta(days=rng.randint(lo, hi), hours=hour)
                use_contact = contact is not None and rng.random() < 0.35
                related_type = "contact" if use_contact else "deal" if plan else None
                related_id = (
                    contact.id if use_contact and contact else plan.deal.id if plan else None
                )
                task = Task(
                    id=self.uid(),
                    workspace_id=self.workspace.id,
                    title=title,
                    due_at=due,
                    done=done,
                    completed_at=due + timedelta(hours=1) if done else None,
                    assignee_id=self.owner.id if rng.random() < 0.7 else self.pick_owner().id,
                    related_type=related_type,
                    related_id=related_id,
                    created_by="user",
                    created_at=min(
                        due - timedelta(days=rng.randint(1, 5)), self.now - timedelta(hours=1)
                    ),
                )
                self.session.add(task)
                tasks.append(task)
        await self.session.flush()
        return tasks

    async def finalize(self) -> None:
        await self.session.flush()
        await recompute_all(self.ctx)
        self.workspace.onboarding_completed = True
        await self.session.flush()

    async def build_all(
        self,
        *,
        companies: int = 30,
        contacts: int = 60,
        deals: int = 25,
        tasks: int = 40,
    ) -> None:
        await self.apply_terminology()
        await self.create_pipeline()
        await self.create_fields()
        await self.create_companies(companies)
        await self.create_contacts(contacts)
        await self.create_deals(deals)
        await self.create_history()
        await self.create_tasks(tasks)
        await self.finalize()
