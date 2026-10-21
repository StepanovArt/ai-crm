from fastapi import APIRouter, Response, status

from app.config import get_settings
from app.deps import AuthDep, SessionDep, resolve_auth
from app.models import User, Workspace
from app.schemas.common import OkOut
from app.schemas.identity import LoginIn, MeOut, SignupIn, UserOut
from app.services import auth as auth_service
from app.services.workspaces import effective_terminology

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        settings.cookie_name,
        token,
        max_age=settings.jwt_expire_minutes * 60,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )


def me_out(user: User, workspace: Workspace, role: str) -> MeOut:
    return MeOut.model_validate(
        {
            "user": UserOut.model_validate(user),
            "workspace": {
                "id": workspace.id,
                "name": workspace.name,
                "industry": workspace.industry,
                "terminology": effective_terminology(workspace.terminology),
                "onboarding_completed": workspace.onboarding_completed,
            },
            "role": role,
        }
    )


@router.post("/signup", response_model=MeOut, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupIn, response: Response, session: SessionDep) -> MeOut:
    user, workspace = await auth_service.signup(
        session, email=body.email, password=body.password, full_name=body.full_name
    )
    _set_cookie(response, auth_service.create_token(user.id, workspace.id))
    return me_out(user, workspace, "owner")


@router.post("/login", response_model=MeOut)
async def login(body: LoginIn, response: Response, session: SessionDep) -> MeOut:
    user = await auth_service.authenticate(session, email=body.email, password=body.password)
    wid = await auth_service.default_workspace_id(session, user.id)
    token = auth_service.create_token(user.id, wid)
    _set_cookie(response, token)
    state = await resolve_auth(session, token)
    return me_out(state.user, state.workspace, state.role)


@router.post("/logout", response_model=OkOut)
async def logout(response: Response) -> OkOut:
    response.delete_cookie(get_settings().cookie_name, path="/")
    return OkOut()


@router.get("/me", response_model=MeOut)
async def me(auth: AuthDep) -> MeOut:
    return me_out(auth.user, auth.workspace, auth.role)
