import uuid

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class UserOut(ORMModel):
    id: uuid.UUID
    email: str
    full_name: str
    avatar_url: str | None = None


class Terminology(BaseModel):
    deal: str = "Deal"
    deals: str = "Deals"
    company: str = "Company"
    companies: str = "Companies"
    contact: str = "Contact"
    contacts: str = "Contacts"
    pipeline: str = "Pipeline"


class WorkspaceOut(ORMModel):
    id: uuid.UUID
    name: str
    industry: str
    terminology: Terminology
    onboarding_completed: bool


class MemberOut(UserOut):
    role: str


class MeOut(BaseModel):
    user: UserOut
    workspace: WorkspaceOut
    role: str


class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    full_name: str = Field(min_length=1, max_length=200)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    terminology: dict[str, str] | None = None


class WorkspaceDetailOut(WorkspaceOut):
    members: list[MemberOut]
