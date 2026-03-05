"""Audit log routes."""
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import AuthContext, require_auth
from app.services.audit_service import list_audit_logs

router = APIRouter(prefix="/audit", tags=["audit"], dependencies=[Depends(require_auth)])


def _require_permission(ctx: AuthContext, perm: str) -> None:
    if "*" not in ctx.permissions and perm not in ctx.permissions:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Missing permission: {perm}")


@router.get("/admin")
def get_tenant_audit_logs(
    limit: int = 100,
    offset: int = 0,
    target_type: str | None = None,
    context: AuthContext = Depends(require_auth)
):
    """TenantAdmin reads audit logs for their own tenant."""
    _require_permission(context, "tenant.audit.read")
    return {"success": True, "data": list_audit_logs(tenant_id=context.tenant_id, target_type=target_type, limit=limit, offset=offset)}


@router.get("/platform")
def get_platform_audit_logs(
    tenant_id: str | None = None,
    target_type: str | None = None,
    limit: int = 100,
    offset: int = 0,
    context: AuthContext = Depends(require_auth)
):
    """SuperAdmin reads audit logs across all tenants."""
    _require_permission(context, "platform.audit.read")
    return {"success": True, "data": list_audit_logs(tenant_id=tenant_id, target_type=target_type, limit=limit, offset=offset)}
