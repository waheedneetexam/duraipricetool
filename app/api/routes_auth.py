from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import AuthContext, require_auth
from app.models.schemas import AuthLoginRequest, AuthRefreshRequest
from app.services.auth_service import (
    authenticate,
    list_user_tenants,
    refresh_access_token,
    revoke_refresh_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(payload: AuthLoginRequest):
    data = authenticate(payload.email, payload.password, payload.tenant_id)
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials or tenant access")
    return {"success": True, "data": data}


@router.post("/refresh")
def refresh(payload: AuthRefreshRequest):
    data = refresh_access_token(payload.refresh_token)
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    return {"success": True, "data": data}


@router.post("/logout")
def logout(payload: AuthRefreshRequest):
    revoke_refresh_token(payload.refresh_token)
    return {"success": True}


@router.get("/me")
def me(context: AuthContext = Depends(require_auth)):
    return {
        "success": True,
        "data": {
            "user_id": context.user_id,
            "tenant_id": context.tenant_id,
            "roles": context.roles,
            "permissions": context.permissions,
        },
    }


@router.get("/tenants")
def tenants(context: AuthContext = Depends(require_auth)):
    data = list_user_tenants(context.user_id)
    return {"success": True, "data": data}
