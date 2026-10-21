from fastapi import APIRouter

from app.deps import CtxDep
from app.schemas.identity import MemberOut, WorkspaceDetailOut, WorkspaceUpdate
from app.services import workspaces as ws_service

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


async def _detail(ctx: CtxDep) -> WorkspaceDetailOut:
    ws = await ws_service.get_workspace(ctx)
    members = await ws_service.list_members(ctx.session, ws.id)
    return WorkspaceDetailOut(
        id=ws.id,
        name=ws.name,
        industry=ws.industry,
        terminology=ws_service.effective_terminology(ws.terminology),
        onboarding_completed=ws.onboarding_completed,
        members=[
            MemberOut(
                id=u.id, email=u.email, full_name=u.full_name, avatar_url=u.avatar_url, role=r
            )
            for u, r in members
        ],
    )


@router.get("/current", response_model=WorkspaceDetailOut)
async def get_current(ctx: CtxDep) -> WorkspaceDetailOut:
    return await _detail(ctx)


@router.patch("/current", response_model=WorkspaceDetailOut)
async def update_current(body: WorkspaceUpdate, ctx: CtxDep) -> WorkspaceDetailOut:
    await ws_service.update_workspace(ctx, name=body.name, terminology=body.terminology)
    return await _detail(ctx)
