"""Placeholder; implemented in Phase 8 (optional). The demo runs on the mock provider."""

from app.agent.providers.mock import MockProvider
from app.config import Settings


class OpenAICompatProvider(MockProvider):
    def __init__(self, settings: Settings) -> None:
        super().__init__(delay_scale=settings.agent_delay_scale)
