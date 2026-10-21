import uuid
from datetime import timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.errors import ConflictError, UnauthorizedError, ValidationFailed
from app.models import Membership, User, Workspace
from app.models.base import utcnow

_hasher = PasswordHasher()
MIN_PASSWORD = 8


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def create_token(user_id: uuid.UUID, workspace_id: uuid.UUID | None) -> str:
    settings = get_settings()
    now = utcnow()
    claims: dict[str, object] = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_expire_minutes)).timestamp()),
    }
    if workspace_id is not None:
        claims["wid"] = str(workspace_id)
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> tuple[uuid.UUID, uuid.UUID | None]:
    settings = get_settings()
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = uuid.UUID(str(claims["sub"]))
        wid = claims.get("wid")
        return user_id, uuid.UUID(str(wid)) if wid else None
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise UnauthorizedError("Session expired, please sign in again") from exc


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    return await session.scalar(select(User).where(func.lower(User.email) == email.strip().lower()))


async def signup(
    session: AsyncSession, *, email: str, password: str, full_name: str
) -> tuple[User, Workspace]:
    if len(password) < MIN_PASSWORD:
        raise ValidationFailed(f"Password must be at least {MIN_PASSWORD} characters")
    if await get_user_by_email(session, email) is not None:
        raise ConflictError("An account with this email already exists")
    full_name = full_name.strip() or email.split("@")[0]
    user = User(
        email=email.strip().lower(), password_hash=hash_password(password), full_name=full_name
    )
    first = full_name.split()[0]
    workspace = Workspace(
        name=f"{first}'s workspace",
        industry="pending",
        terminology={},
        onboarding_completed=False,
    )
    session.add_all([user, workspace])
    await session.flush()
    session.add(Membership(user_id=user.id, workspace_id=workspace.id, role="owner"))
    await session.flush()
    return user, workspace


async def authenticate(session: AsyncSession, *, email: str, password: str) -> User:
    user = await get_user_by_email(session, email)
    if user is None or not verify_password(user.password_hash, password):
        raise UnauthorizedError("Invalid email or password")
    return user


async def default_workspace_id(session: AsyncSession, user_id: uuid.UUID) -> uuid.UUID | None:
    return await session.scalar(
        select(Membership.workspace_id)
        .where(Membership.user_id == user_id)
        .order_by(Membership.created_at)
        .limit(1)
    )
