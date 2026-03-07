from __future__ import annotations

import json
import threading
from pathlib import Path
from urllib.parse import urlparse

from vanna.chromadb import ChromaDB_VectorStore
from vanna.openai import OpenAI_Chat

from app.core.config import DATA_DIR, OPENAI_API_KEY, PG_DSN
from app.services.ai_provider_service import get_openai_api_key


class DuraiVanna(ChromaDB_VectorStore, OpenAI_Chat):
    def __init__(self, config: dict):
        ChromaDB_VectorStore.__init__(self, config=config)
        OpenAI_Chat.__init__(self, config=config)


_vn_lock = threading.Lock()
_vn_instance: DuraiVanna | None = None
_trained_flag = DATA_DIR / "vanna" / "trained.flag"


def _resolve_openai_key(tenant_id: str | None) -> str | None:
    if tenant_id:
        key_row = get_openai_api_key(tenant_id)
        key = (key_row.get("api_key") or "").strip()
        if key:
            return key
    return OPENAI_API_KEY


def _parse_pg_dsn() -> dict:
    parsed = urlparse(PG_DSN)
    return {
        "host": parsed.hostname or "127.0.0.1",
        "port": parsed.port or 5432,
        "dbname": (parsed.path or "").lstrip("/") or "postgres",
        "user": parsed.username or "postgres",
        "password": parsed.password or "",
    }


def _get_vn(tenant_id: str | None) -> DuraiVanna:
    global _vn_instance
    with _vn_lock:
        if _vn_instance is None:
            api_key = _resolve_openai_key(tenant_id)
            if not api_key:
                raise ValueError("OpenAI API key is not configured for this tenant.")

            persist_path = DATA_DIR / "vanna" / "chroma"
            persist_path.mkdir(parents=True, exist_ok=True)

            config = {
                "api_key": api_key,
                "model": "gpt-4o",
                "path": str(persist_path),
            }
            _vn_instance = DuraiVanna(config=config)

            pg = _parse_pg_dsn()
            _vn_instance.connect_to_postgres(
                host=pg["host"],
                dbname=pg["dbname"],
                user=pg["user"],
                password=pg["password"],
                port=pg["port"],
            )

            _ensure_trained(_vn_instance)

    return _vn_instance


def _ensure_trained(vn: DuraiVanna) -> None:
    if _trained_flag.exists():
        return

    df_information_schema = vn.run_sql("SELECT * FROM INFORMATION_SCHEMA.COLUMNS")
    plan = vn.get_training_plan_generic(df_information_schema)
    vn.train(plan=plan)

    _trained_flag.parent.mkdir(parents=True, exist_ok=True)
    _trained_flag.write_text("trained")


def generate_sql_with_vanna(question: str, tenant_id: str | None = None) -> str:
    vn = _get_vn(tenant_id)
    sql = vn.generate_sql(question=question)
    if isinstance(sql, (list, dict)):
        return json.dumps(sql)
    return str(sql or "")
