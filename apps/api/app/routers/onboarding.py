from collections.abc import AsyncIterator

from fastapi import APIRouter
from sse_starlette import EventSourceResponse

from app.config import get_settings
from app.deps import AuthDep, SessionDep, SessionMakerDep
from app.errors import ConflictError, NotFoundError
from app.onboarding.events import OnboardingEvent
from app.onboarding.generator import build_instantly, generate
from app.onboarding.templates import DEFAULT_TEMPLATE, TEMPLATES
from app.routers.agent import SSE_RESPONSES
from app.routers.auth import me_out
from app.schemas.identity import MeOut
from app.schemas.onboarding import DemoIn, GenerateIn, OnboardingTemplateOut
from app.services.workspaces import effective_terminology

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.get("/templates", response_model=list[OnboardingTemplateOut])
async def list_templates() -> list[OnboardingTemplateOut]:
    """Industry templates, with the example sentences shown as chips."""
    return [
        OnboardingTemplateOut.model_validate(
            {
                "key": t.key,
                "name": t.name,
                "tagline": t.tagline,
                "example_prompt": t.example_prompt,
                "terminology": effective_terminology(t.terminology),
                "stages": [s.name for s in t.stages],
            }
        )
        for t in TEMPLATES.values()
    ]


@router.post("/generate", response_class=EventSourceResponse, responses=SSE_RESPONSES)
async def generate_workspace(
    body: GenerateIn, auth: AuthDep, maker: SessionMakerDep
) -> EventSourceResponse:
    """Build the workspace from a one-line business description. Streams OnboardingEvents."""
    if auth.workspace.onboarding_completed:
        raise ConflictError("This workspace is already set up")
    events = generate(
        maker,
        workspace_id=auth.workspace.id,
        user_id=auth.user.id,
        description=body.description,
        delay_scale=get_settings().agent_delay_scale,
    )

    async def gen() -> AsyncIterator[dict[str, str]]:
        async for ev in events:
            yield {"data": ev.model_dump_json()}

    return EventSourceResponse(
        gen(), ping=15, headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@router.post("/demo", response_model=MeOut)
async def use_demo_workspace(
    auth: AuthDep, session: SessionDep, body: DemoIn | None = None
) -> MeOut:
    """Skip the description and fill the workspace with the demo B2B template instantly."""
    key = body.template if body and body.template else DEFAULT_TEMPLATE.key
    template = TEMPLATES.get(key)
    if template is None:
        raise NotFoundError(f"Unknown template “{key}”")
    workspace = await build_instantly(session, auth.workspace.id, auth.user.id, template)
    return me_out(auth.user, workspace, auth.role)


@router.get("/events/schema", response_model=list[OnboardingEvent])
async def onboarding_events_schema() -> list[OnboardingEvent]:
    """Exposes the OnboardingEvent union in OpenAPI so the web client gets generated types."""
    return []
