from app.onboarding.templates.b2b_saas import TEMPLATE as B2B_SAAS
from app.onboarding.templates.base import IndustryTemplate

TEMPLATES: dict[str, IndustryTemplate] = {t.key: t for t in (B2B_SAAS,)}
DEFAULT_TEMPLATE = B2B_SAAS

__all__ = ["DEFAULT_TEMPLATE", "TEMPLATES", "IndustryTemplate"]
