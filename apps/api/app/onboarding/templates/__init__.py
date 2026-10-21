from app.onboarding.templates.agency_services import TEMPLATE as AGENCY_SERVICES
from app.onboarding.templates.b2b_saas import TEMPLATE as B2B_SAAS
from app.onboarding.templates.base import IndustryTemplate
from app.onboarding.templates.industrial_equipment import TEMPLATE as INDUSTRIAL_EQUIPMENT
from app.onboarding.templates.real_estate import TEMPLATE as REAL_ESTATE
from app.onboarding.templates.recruitment import TEMPLATE as RECRUITMENT

TEMPLATES: dict[str, IndustryTemplate] = {
    t.key: t for t in (B2B_SAAS, REAL_ESTATE, INDUSTRIAL_EQUIPMENT, AGENCY_SERVICES, RECRUITMENT)
}
DEFAULT_TEMPLATE = B2B_SAAS

__all__ = ["DEFAULT_TEMPLATE", "TEMPLATES", "IndustryTemplate"]
