from pydantic import BaseModel, Field

from app.schemas.common import OutModel
from app.schemas.identity import Terminology


class GenerateIn(BaseModel):
    description: str = Field(min_length=3, max_length=500)


class DemoIn(BaseModel):
    template: str | None = None


class OnboardingTemplateOut(OutModel):
    key: str
    name: str
    tagline: str
    example_prompt: str
    terminology: Terminology
    stages: list[str]
