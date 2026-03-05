from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status

from app.core.config import AUTH_REQUIRED
from app.services.auth_service import decode_token


@dataclass
class AuthContext:
    user_id: str
    tenant_id: str
    roles: list[str]
    permissions: list[str]


_PUBLIC_AUTH_PATHS = {"/auth/login", "/auth/refresh", "/auth/logout"}


def _is_public_path(path: str) -> bool:
    if path in {"/", "/health", "/openapi.json"}:
        return True
    if path.startswith("/docs") or path.startswith("/redoc"):
        return True
    # Only specific auth endpoints are truly public — /auth/me and /auth/tenants require a valid token
    return path in _PUBLIC_AUTH_PATHS


def _required_permission(path: str, method: str) -> str | None:
    if path.startswith("/admin"):
        return "admin.manage"
    if path.startswith("/master"):
        return "master_data.read" if method.upper() == "GET" else "master_data.manage"
    if path.startswith("/quotes"):
        if path.endswith("/workflow/evaluate"):
            return "quotes.approve"
        return "quotes.read" if method.upper() == "GET" else "quotes.write"
    if path.startswith("/analytics"):
        return "analytics.read"
    if path.startswith("/chatbot"):
        return "chatbot.ask"
    return None


def get_auth_context(request: Request) -> AuthContext:
    if hasattr(request.state, "auth_context"):
        return request.state.auth_context

    path = request.url.path
    if _is_public_path(path):
        ctx = AuthContext(user_id="public", tenant_id=request.headers.get("X-Tenant-ID", "default"), roles=[], permissions=[])
        request.state.auth_context = ctx
        return ctx

    tenant_override = request.headers.get("X-Tenant-ID", "default")

    if not AUTH_REQUIRED:
        ctx = AuthContext(user_id="system", tenant_id=tenant_override, roles=["SuperAdmin"], permissions=["*"])
        request.state.auth_context = ctx
        return ctx

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = auth_header.split(" ", 1)[1].strip()
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    token_tenant = str(payload.get("tenant_id") or "")
    active_tenant = tenant_override if tenant_override != "default" else token_tenant
    if token_tenant and active_tenant and token_tenant != active_tenant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant mismatch")

    ctx = AuthContext(
        user_id=str(payload.get("sub") or ""),
        tenant_id=active_tenant or token_tenant or "default",
        roles=[str(r) for r in payload.get("roles", [])],
        permissions=[str(p) for p in payload.get("permissions", [])],
    )

    needed = _required_permission(path, request.method)
    if needed and "*" not in ctx.permissions and needed not in ctx.permissions:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Missing permission: {needed}")

    request.state.auth_context = ctx
    return ctx


def require_auth(context: AuthContext = Depends(get_auth_context)) -> AuthContext:
    return context
