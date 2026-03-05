"""Audit service for logging and retrieving administrative actions."""
import json
import time
from typing import Any
from uuid import uuid4

from app.core.config import DB_ENGINE
from app.db.duckdb_client import db_client
from app.db.postgres_client import pg_client


def _pg() -> bool:
    return DB_ENGINE in {"postgres", "hybrid"}


def log_action(
    actor_user_id: str,
    actor_tenant_id: str,
    target_type: str,
    target_id: str,
    action: str,
    detail: dict[str, Any] | None = None,
) -> str:
    """Log an administrative action to the audit_log table."""
    log_id = str(uuid4())
    detail_json = json.dumps(detail or {})
    now = int(time.time())

    if _pg():
        pg_client.execute(
            """
            INSERT INTO audit_log (log_id, actor_user_id, actor_tenant_id, target_type, target_id, action, detail, created_at_epoch)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (log_id, actor_user_id, actor_tenant_id, target_type, target_id, action, detail_json, now),
        )
    else:
        db_client.execute(
            """
            INSERT INTO audit_log (log_id, actor_user_id, actor_tenant_id, target_type, target_id, action, detail, created_at_epoch)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (log_id, actor_user_id, actor_tenant_id, target_type, target_id, action, detail_json, now),
        )
    return log_id


def list_audit_logs(
    tenant_id: str | None = None,
    target_type: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Retrieve audit logs, optionally filtered by tenant."""
    query = "SELECT log_id, actor_user_id, actor_tenant_id, target_type, target_id, action, detail, created_at_epoch FROM audit_log"
    where_clauses = []
    params = []

    if tenant_id:
        where_clauses.append("actor_tenant_id = %s" if _pg() else "actor_tenant_id = ?")
        params.append(tenant_id)
    
    if target_type:
        where_clauses.append("target_type = %s" if _pg() else "target_type = ?")
        params.append(target_type)

    if where_clauses:
        query += " WHERE " + " AND ".join(where_clauses)

    query += " ORDER BY created_at_epoch DESC LIMIT %s OFFSET %s" if _pg() else " ORDER BY created_at_epoch DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    if _pg():
        rows = pg_client.execute(query, tuple(params))
        return [dict(r) for r in rows]
    
    rows = db_client.execute(query, tuple(params)).fetchall()
    result = []
    for r in rows:
        # DuckDB might return detail as a string or as a JSON object depending on how it's stored/retrieved
        detail_val = r[6]
        if isinstance(detail_val, str):
            try:
                detail_val = json.loads(detail_val)
            except:
                pass

        result.append({
            "log_id": r[0],
            "actor_user_id": r[1],
            "actor_tenant_id": r[2],
            "target_type": r[3],
            "target_id": r[4],
            "action": r[5],
            "detail": detail_val,
            "created_at_epoch": r[7],
        })
    return result
