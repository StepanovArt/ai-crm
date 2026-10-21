from app.agent.providers.base import LLMProvider
from app.agent.providers.mock import MockProvider
from app.config import Settings


def get_provider(settings: Settings) -> LLMProvider:
    if settings.llm_provider == "openai":
        from app.agent.providers.openai_compat import OpenAICompatProvider

        return OpenAICompatProvider(settings)
    return MockProvider(delay_scale=settings.agent_delay_scale)
