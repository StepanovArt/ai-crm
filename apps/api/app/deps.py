import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import get_settings
from app.db import default_sessionmaker
from app.errors import UnauthorizedError
from app.models import Membership, User, Workspace
from app.services.auth import decode_token
from app.services.context import Ctx


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    """Session factory dependency (overridden in tests)."""
    return default_sessionmaker()


async def get_session(
    maker: Annotated[async_sessionmaker[AsyncSession], Depends(get_sessionmaker)],
) -> AsyncIterator[AsyncSession]:
    async with maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# scope="function": commit before the response is sent, so clients never read stale data.
SessionDep = Annotated[AsyncSession, Depends(get_session, scope="function")]
SessionMakerDep = Annotated[async_sessionmaker[AsyncSession], Depends(get_sessionmaker)]


@dataclass
class AuthState:
    user: User
    workspace: Workspace
    role: str


def _token_from(request: Request) -> str:
    token = request.cookies.get(get_settings().cookie_name)
    if not token:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth[7:]
    if not token:
        raise UnauthorizedError("Not signed in")
    return token


async def resolve_auth(session: AsyncSession, token: str) -> AuthState:
    user_id, wid = decode_token(token)
    user = await session.get(User, user_id)
    if user is None:
        raise UnauthorizedError("Account no longer exists")
    stmt = (
        select(Membership, Workspace)
        .join(Workspace, Workspace.id == Membership.workspace_id)
        .where(Membership.user_id == user.id)
        .order_by(Membership.created_at)
    )
    rows = (await session.execute(stmt)).all()
    if not rows:
        raise UnauthorizedError("No workspace for this account")
    chosen = next((r for r in rows if r[1].id == wid), rows[0])
    return AuthState(user=user, workspace=chosen[1], role=chosen[0].role)


async def get_auth(request: Request, session: SessionDep) -> AuthState:
    return await resolve_auth(session, _token_from(request))


AuthDep = Annotated[AuthState, Depends(get_auth)]


async def current_user(auth: AuthDep) -> User:
    return auth.user


async def current_workspace(auth: AuthDep) -> Workspace:
    return auth.workspace


CurrentUser = Annotated[User, Depends(current_user)]
CurrentWorkspace = Annotated[Workspace, Depends(current_workspace)]


async def get_ctx(session: SessionDep, auth: AuthDep) -> Ctx:
    return Ctx(session=session, workspace_id=auth.workspace.id, user_id=auth.user.id)


CtxDep = Annotated[Ctx, Depends(get_ctx)]


def parse_uuid(value: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(value)
    except ValueError:
        return None
