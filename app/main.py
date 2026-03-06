from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_auth import router as auth_router
from app.api.routes_admin import router as admin_router
from app.api.routes_analytics import router as analytics_router
from app.api.routes_chatbot import router as chatbot_router
from app.api.routes_master_data import router as master_data_router
from app.api.routes_platform import router as platform_router
from app.api.routes_quotes import router as quotes_router
from app.api.routes_audit import router as audit_router
from app.core.config import DB_ENGINE
from app.db.postgres_client import pg_client
from app.services.auth_service import ensure_auth_seed_data
from app.services.health_service import build_health_payload

app = FastAPI(
    title="Durai Pricing Tool",
    description="Modular CPQ/PRO platform blueprint with DuckDB analytics and dynamic quoting.",
    version="0.1.0",
)

APP_START_TIME = datetime.now(timezone.utc)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router)
app.include_router(analytics_router)
app.include_router(master_data_router)
app.include_router(platform_router)
app.include_router(audit_router)
app.include_router(quotes_router)
app.include_router(chatbot_router)
app.include_router(auth_router)


@app.on_event("startup")
def startup_init():
    if DB_ENGINE in {"postgres", "hybrid"}:
        pg_client.initialize_schema()
    ensure_auth_seed_data()


@app.get("/")
def root():
    return {
        "name": "Durai Pricing Tool API",
        "status": "running",
        "health": "/health",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return build_health_payload(APP_START_TIME)
