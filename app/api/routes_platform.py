"""Platform management routes — SuperAdmin only.
Requires permission: platform.tenants.manage or platform.users.manage.
"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import AuthContext, require_auth
from app.models.schemas import (
    CreateTenantRequest,
    CreatePlatformUserRequest,
    AssignTenantRequest,
    SetTenantActiveRequest,
)
from app.services.platform_service import (
    assign_user_to_tenant,
    create_platform_user,
    create_tenant,
    list_all_users,
    list_tenants,
    list_available_roles,
    set_tenant_active,
)
from app.services.audit_service import log_action

router = APIRouter(prefix="/platform", tags=["platform"], dependencies=[Depends(require_auth)])


def _require_permission(ctx: AuthContext, perm: str) -> None:
    if "*" not in ctx.permissions and perm not in ctx.permissions:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Missing permission: {perm}")


# ── Tenants ──────────────────────────────────────────────────────────────────

@router.get("/tenants")
def get_tenants(context: AuthContext = Depends(require_auth)):
    _require_permission(context, "platform.tenants.manage")
    return {"success": True, "data": list_tenants()}


@router.post("/tenants")
def post_tenant(payload: CreateTenantRequest, context: AuthContext = Depends(require_auth)):
    _require_permission(context, "platform.tenants.manage")
    try:
        data = create_tenant(tenant_name=payload.tenant_name)
        log_action(
            actor_user_id=context.user_id,
            actor_tenant_id=context.tenant_id,
            target_type="tenant",
            target_id=data["tenant_id"],
            action="create",
            detail={"tenant_name": payload.tenant_name}
        )
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.patch("/tenants/{tenant_id}")
def patch_tenant(tenant_id: str, payload: SetTenantActiveRequest, context: AuthContext = Depends(require_auth)):
    _require_permission(context, "platform.tenants.manage")
    try:
        data = set_tenant_active(tenant_id, payload.active)
        log_action(
            actor_user_id=context.user_id,
            actor_tenant_id=context.tenant_id,
            target_type="tenant",
            target_id=tenant_id,
            action="activate" if payload.active else "suspend",
            detail={"active": payload.active}
        )
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


# ── Users ────────────────────────────────────────────────────────────────────

@router.get("/users")
def get_users(context: AuthContext = Depends(require_auth)):
    _require_permission(context, "platform.users.manage")
    return {"success": True, "data": list_all_users()}


@router.post("/users")
def post_user(payload: CreatePlatformUserRequest, context: AuthContext = Depends(require_auth)):
    _require_permission(context, "platform.users.manage")
    try:
        data = create_platform_user(
            email=payload.email,
            full_name=payload.full_name,
            password=payload.password,
            tenant_id=payload.tenant_id,
            role_name=payload.role,
        )
        log_action(
            actor_user_id=context.user_id,
            actor_tenant_id=context.tenant_id,
            target_type="user",
            target_id=data["user_id"],
            action="create_platform_user",
            detail={"email": payload.email, "tenant_id": payload.tenant_id, "role": payload.role}
        )
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.post("/users/{user_id}/assign-tenant")
def post_assign_tenant(user_id: str, payload: AssignTenantRequest, context: AuthContext = Depends(require_auth)):
    _require_permission(context, "platform.users.manage")
    try:
        data = assign_user_to_tenant(user_id=user_id, tenant_id=payload.tenant_id, role_name=payload.role)
        log_action(
            actor_user_id=context.user_id,
            actor_tenant_id=context.tenant_id,
            target_type="user",
            target_id=user_id,
            action="assign_tenant",
            detail={"tenant_id": payload.tenant_id, "role": payload.role}
        )
        return {"success": True, "data": data}
    except ValueError as exc:
        return {"success": False, "error": str(exc)}


@router.get("/roles")
def get_roles(context: AuthContext = Depends(require_auth)):
    _require_permission(context, "platform.users.manage")
    return {"success": True, "data": list_available_roles(for_superadmin=True)}
