"""Audit service for logging and retrieving administrative actions."""
import json
import time
from typing import Any
from uuid import uuid4

from app.db.postgres_client import pg_client


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

    pg_client.execute(
        """
        INSERT INTO audit_log (log_id, actor_user_id, actor_tenant_id, target_type, target_id, action, detail, created_at_epoch)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (log_id, actor_user_id, actor_tenant_id, target_type, target_id, action, detail_json, now),
    )
    return log_id


def list_audit_logs(
    tenant_id: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Retrieve audit logs, enriched with human-readable actor and tenant names."""
    query = """
        SELECT l.log_id, l.actor_user_id, l.actor_tenant_id, l.target_type, l.target_id, l.action, l.detail, l.created_at_epoch,
               u.full_name AS actor_name, t.tenant_name AS actor_tenant_name,
               CASE 
                 WHEN l.target_type = 'user' THEN (SELECT full_name FROM app_users WHERE user_id = l.target_id)
                 WHEN l.target_type = 'tenant' THEN (SELECT tenant_name FROM tenants WHERE tenant_id = l.target_id)
                 ELSE l.target_id
               END AS target_name
        FROM audit_log l
        LEFT JOIN app_users u ON u.user_id = l.actor_user_id
        LEFT JOIN tenants t ON t.tenant_id = l.actor_tenant_id
    """
    where_clauses = []
    params = []

    if tenant_id:
        where_clauses.append("l.actor_tenant_id = %s")
        params.append(tenant_id)
    
    if target_type:
        where_clauses.append("l.target_type = %s")
        params.append(target_type)
    
    if target_id:
        where_clauses.append("l.target_id = %s")
        params.append(target_id)

    if where_clauses:
        query += " WHERE " + " AND ".join(where_clauses)

    query += " ORDER BY l.created_at_epoch DESC LIMIT %s OFFSET %s"
    params.extend([limit, offset])

    rows = pg_client.execute(query, tuple(params))
    return [dict(r) for r in rows]
