from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from app.config import get_settings
from app.errors import install_error_handlers
from app.routers import (
    activities,
    agent,
    auth,
    companies,
    contacts,
    dashboard,
    deals,
    demo,
    fields,
    health,
    notes,
    onboarding,
    pipelines,
    tasks,
    workspaces,
)

API_PREFIX = "/api/v1"


def _operation_id(route: APIRoute) -> str:
    return route.name


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=f"{settings.app_name} API",
        version="0.1.0",
        generate_unique_id_function=_operation_id,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(app)
    for module in (
        health,
        auth,
        workspaces,
        fields,
        pipelines,
        companies,
        contacts,
        deals,
        tasks,
        notes,
        activities,
        dashboard,
        onboarding,
        agent,
        demo,
    ):
        app.include_router(module.router, prefix=API_PREFIX)
    return app


app = create_app()
