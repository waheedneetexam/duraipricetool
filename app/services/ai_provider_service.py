from __future__ import annotations

import re

from openai import OpenAI

from app.db.postgres_client import pg_client


DEFAULT_TENANT_ID = "default"
PROVIDER_OPENAI = "openai"


def _normalize_tenant_id(tenant_id: str | None) -> str:
    raw = (tenant_id or "").strip()
    return raw or DEFAULT_TENANT_ID


def _ensure_tables() -> None:
    pg_client.execute(
        """
        CREATE TABLE IF NOT EXISTS ai_provider_keys (
            tenant_id TEXT NOT NULL,
            provider TEXT NOT NULL,
            api_key TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (tenant_id, provider)
        )
        """
    )


def save_openai_api_key(tenant_id: str | None, api_key: str) -> None:
    _ensure_tables()
    tenant = _normalize_tenant_id(tenant_id)
    key = (api_key or "").strip()
    if not key:
        raise ValueError("api_key is required")

    pg_client.execute(
        """
        INSERT INTO ai_provider_keys (tenant_id, provider, api_key, created_at, updated_at)
        VALUES (%s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (tenant_id, provider)
        DO UPDATE SET api_key = EXCLUDED.api_key, updated_at = CURRENT_TIMESTAMP
        """,
        (tenant, PROVIDER_OPENAI, key),
    )


def get_openai_api_key(tenant_id: str | None) -> dict:
    _ensure_tables()
    tenant = _normalize_tenant_id(tenant_id)

    rows = pg_client.execute(
        """
        SELECT api_key, updated_at
        FROM ai_provider_keys
        WHERE tenant_id = %s AND provider = %s
        """,
        (tenant, PROVIDER_OPENAI),
    )

    if not rows:
        return {"api_key": None, "updated_at": None}

    row = rows[0]
    return {
        "api_key": row.get("api_key"),
        "updated_at": row.get("updated_at"),
    }


def get_openai_key_status(tenant_id: str | None) -> dict:
    data = get_openai_api_key(tenant_id)
    configured = bool(data.get("api_key"))
    return {
        "configured": configured,
        "updated_at": data.get("updated_at"),
    }


def delete_openai_api_key(tenant_id: str | None) -> None:
    _ensure_tables()
    tenant = _normalize_tenant_id(tenant_id)

    pg_client.execute(
        """
        DELETE FROM ai_provider_keys
        WHERE tenant_id = %s AND provider = %s
        """,
        (tenant, PROVIDER_OPENAI),
    )


def _redact_secrets(message: str) -> str:
    if not message:
        return message
    message = re.sub(r"\bsk-[A-Za-z0-9]{8,}\b", "sk-***", message)
    message = re.sub(r"\brk-[A-Za-z0-9]{8,}\b", "rk-***", message)
    return message


def validate_openai_api_key(api_key: str) -> dict:
    key = (api_key or "").strip()
    if not key:
        raise ValueError("api_key is required")
    if not key.startswith("sk-") or len(key) < 20:
        return {"valid": False, "message": "Key format looks invalid (expected to start with 'sk-')."}

    try:
        client = OpenAI(api_key=key)
        _ = client.models.list()
        return {"valid": True, "message": "Key validated successfully."}
    except Exception as exc:
        return {"valid": False, "message": _redact_secrets(str(exc)) or "Key validation failed."}
