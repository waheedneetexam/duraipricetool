import time
from datetime import datetime, timezone
from typing import Any

import duckdb

from app.core.config import DB_ENGINE, DUCKDB_PATH
from app.db.duckdb_client import db_client
from app.db.postgres_client import pg_client


def _serialize_datetime(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    return str(value)


def check_postgres_health() -> dict:
    if DB_ENGINE not in {"postgres", "hybrid"}:
        return {"status": "skipped", "reason": f"DB_ENGINE={DB_ENGINE} (Postgres not in use)"}

    start = time.monotonic()
    try:
        pg_client.execute("SELECT 1 AS ok")
        duration_ms = int((time.monotonic() - start) * 1000)
        return {"status": "ok", "duration_ms": duration_ms}
    except Exception as exc:  # pragma: no cover - health guard
        duration_ms = int((time.monotonic() - start) * 1000)
        return {"status": "error", "error": str(exc), "duration_ms": duration_ms}


def check_duckdb_health() -> dict:
    info = {
        "status": "ok",
        "path": str(DUCKDB_PATH),
        "read_only_mode": db_client.read_only,
        "connection_available": db_client.conn is not None,
        "concurrency_lock": "read_only" if db_client.read_only else "unlocked",
    }

    start = time.monotonic()
    try:
        if db_client.conn is not None:
            db_client.execute("SELECT 1 AS ok")
        else:
            with duckdb.connect(str(DUCKDB_PATH), read_only=True) as conn:
                conn.execute("SELECT 1 AS ok")
        info["duration_ms"] = int((time.monotonic() - start) * 1000)
    except Exception as exc:  # pragma: no cover - health guard
        info["status"] = "error"
        info["error"] = str(exc)
        info["duration_ms"] = int((time.monotonic() - start) * 1000)

    return info


def check_sync_health() -> dict:
    if DB_ENGINE not in {"postgres", "hybrid"}:
        return {"status": "skipped", "reason": f"DB_ENGINE={DB_ENGINE} (syncs disabled)"}

    start = time.monotonic()
    try:
        rows = pg_client.execute(
            """
            SELECT sync_name, last_cursor_ts, last_cursor_id, updated_at
            FROM sync_state
            ORDER BY sync_name
            """
        )
        serialized = [
            {
                "sync_name": row["sync_name"],
                "last_cursor_ts": _serialize_datetime(row["last_cursor_ts"]),
                "last_cursor_id": row["last_cursor_id"],
                "updated_at": _serialize_datetime(row["updated_at"]),
            }
            for row in rows
        ]
        last_run = None
        for row in rows:
            candidate = row.get("updated_at")
            if candidate and (last_run is None or candidate > last_run):
                last_run = candidate

        duration_ms = int((time.monotonic() - start) * 1000)
        return {
            "status": "ok",
            "last_run_at": _serialize_datetime(last_run),
            "tables": serialized,
            "count": len(serialized),
            "duration_ms": duration_ms,
        }
    except Exception as exc:  # pragma: no cover - health guard
        duration_ms = int((time.monotonic() - start) * 1000)
        return {"status": "error", "error": str(exc), "duration_ms": duration_ms}


def build_health_payload(start_time: datetime) -> dict:
    now = datetime.now(timezone.utc)
    api_uptime = int((now - start_time).total_seconds())

    components = {
        "api": {
            "status": "ok",
            "started_at": start_time.astimezone(timezone.utc).isoformat(),
            "server_time": now.isoformat(),
            "uptime_seconds": api_uptime,
            "db_engine": DB_ENGINE,
        },
        "duckdb": check_duckdb_health(),
    }

    if DB_ENGINE in {"postgres", "hybrid"}:
        components["postgres"] = check_postgres_health()
        components["pg_to_duck_sync"] = check_sync_health()

    overall_status = "ok"
    for component in components.values():
        if component.get("status") == "error":
            overall_status = "degraded"
            break

    return {
        "status": overall_status,
        "server_time": now.isoformat(),
        "components": components,
    }
