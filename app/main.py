from datetime import datetime, timezone
import html

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

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
def health(request: Request):
    payload = build_health_payload(APP_START_TIME)
    wants_json = request.query_params.get("format") == "json"
    accept = request.headers.get("accept", "").lower()
    wants_html = "text/html" in accept and not wants_json

    if not wants_html:
        return payload

    def status_badge(status: str) -> str:
        s = (status or "unknown").lower()
        color = "#16a34a" if s == "ok" else "#ca8a04" if s == "degraded" else "#dc2626" if s == "error" else "#6b7280"
        return f'<span style="display:inline-block;padding:2px 10px;border-radius:999px;background:{color};color:#fff;font-weight:600;">{html.escape(status.upper())}</span>'

    components = payload.get("components", {})
    component_rows = []
    for name, component in components.items():
        status = str(component.get("status", "unknown"))
        details = []
        for key, value in component.items():
            if key == "status":
                continue
            details.append(f"<div><b>{html.escape(str(key))}:</b> {html.escape(str(value))}</div>")
        component_rows.append(
            f"""
            <tr>
              <td style="padding:10px 12px;border-top:1px solid #e5e7eb;"><b>{html.escape(name)}</b></td>
              <td style="padding:10px 12px;border-top:1px solid #e5e7eb;">{status_badge(status)}</td>
              <td style="padding:10px 12px;border-top:1px solid #e5e7eb;">{''.join(details) if details else '-'}</td>
            </tr>
            """
        )

    page = f"""
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>DuraiPrice Health</title>
      </head>
      <body style="margin:0;background:#f8fafc;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
        <div style="max-width:1000px;margin:32px auto;padding:0 16px;">
          <h1 style="margin:0 0 8px 0;">DuraiPrice Health</h1>
          <div style="margin:0 0 16px 0;">Overall: {status_badge(str(payload.get('status', 'unknown')))}</div>
          <div style="margin:0 0 24px 0;color:#334155;">
            <div><b>server_time:</b> {html.escape(str(payload.get('server_time')))}</div>
            <div><b>json endpoint:</b> <a href="/health?format=json">/health?format=json</a></div>
          </div>
          <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="text-align:left;padding:10px 12px;">Component</th>
                <th style="text-align:left;padding:10px 12px;">Status</th>
                <th style="text-align:left;padding:10px 12px;">Details</th>
              </tr>
            </thead>
            <tbody>
              {''.join(component_rows)}
            </tbody>
          </table>
        </div>
      </body>
    </html>
    """
    return HTMLResponse(content=page)
