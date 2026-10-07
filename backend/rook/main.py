from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router
from .bootstrap import ensure_demo_tenant
from .config import settings
from .db import SessionLocal, init_db
from .logging import configure as configure_logging
from .logging import install_middleware

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    if settings.dev_login:  # the synthetic demo tenant exists only where dev login is allowed
        with SessionLocal() as db:
            ensure_demo_tenant(db)
    yield


def create_app(use_lifespan: bool = True) -> FastAPI:
    app = FastAPI(title="ROOK API", version="0.1.0", description="Enterprise AI Chief of Staff — prototype",
                  lifespan=lifespan if use_lifespan else None)
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])
    install_middleware(app)
    app.include_router(router)
    return app


app = create_app()
