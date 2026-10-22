from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

APP_NAME = "Halo CRM"
DEV_JWT_SECRET = "dev-only-secret-change-me-in-production-0123456789"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../../.env"), extra="ignore")

    app_name: str = APP_NAME
    env: Literal["dev", "test", "prod"] = "dev"
    database_url: str = "postgresql+asyncpg://halo:halo@localhost:5432/halo"
    test_database_url: str = "postgresql+asyncpg://halo:halo@localhost:5432/halo_test"
    jwt_secret: str = DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 14
    cookie_name: str = "halo_session"
    cookie_secure: bool = False
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    llm_provider: Literal["mock", "openai"] = "mock"
    # Multiplier for the mock agent's streaming delays. 1.0 = realistic, 0 = instant (tests).
    agent_delay_scale: float = 1.0
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    sql_echo: bool = False

    @model_validator(mode="after")
    def _require_real_secret_in_prod(self) -> "Settings":
        # Fail fast: with the public dev secret anyone could forge a session cookie.
        if self.env == "prod" and (self.jwt_secret == DEV_JWT_SECRET or len(self.jwt_secret) < 32):
            raise ValueError("JWT_SECRET must be set to a random string of 32+ characters in prod")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
