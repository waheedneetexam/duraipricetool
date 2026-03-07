import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any
from uuid import uuid4

from app.core.config import (
    ACCESS_TOKEN_TTL_MINUTES,
    AUTH_BOOTSTRAP_EMAIL,
    AUTH_BOOTSTRAP_PASSWORD,
    AUTH_BOOTSTRAP_TENANT,
    AUTH_SECRET,
    DB_ENGINE,
    REFRESH_TOKEN_TTL_DAYS,
)
from app.db.postgres_client import pg_client




def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(raw: str) -> bytes:
    padding = "=" * ((4 - len(raw) % 4) % 4)
    return base64.urlsafe_b64decode((raw + padding).encode("ascii"))


def _hash_password(password: str, salt: str | None = None) -> str:
    salt_bytes = (salt or secrets.token_hex(16)).encode("utf-8")
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_bytes, 210_000)
    return f"pbkdf2_sha256${salt_bytes.decode('utf-8')}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, salt, digest_hex = stored_hash.split("$", 2)
        if algorithm != "pbkdf2_sha256":
            return False
        expected = _hash_password(password, salt)
        return hmac.compare_digest(expected, stored_hash)
    except Exception:
        return False


def _sign(data: str) -> str:
    sig = hmac.new(AUTH_SECRET.encode("utf-8"), data.encode("utf-8"), hashlib.sha256).digest()
    return _b64url_encode(sig)


def _encode_token(payload: dict[str, Any]) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}"
    return f"{signing_input}.{_sign(signing_input)}"


def decode_token(token: str) -> dict[str, Any] | None:
    try:
        header_b64, payload_b64, signature = token.split(".", 2)
        signing_input = f"{header_b64}.{payload_b64}"
        if not hmac.compare_digest(_sign(signing_input), signature):
            return None
        payload = json.loads(_b64url_decode(payload_b64))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


def _resolve_permissions(role_names: list[str]) -> list[str]:
    role_set = set(role_names)
    if "SuperAdmin" in role_set:
        return ["*"]

    perms: set[str] = set()
    rows = pg_client.execute(
        """
        SELECT DISTINCT p.permission_key
        FROM role_permissions rp
        JOIN roles r ON r.role_id = rp.role_id
        JOIN permissions p ON p.permission_id = rp.permission_id
        WHERE r.role_name = ANY(%s)
        """,
        (role_names,),
    )
    perms = {str(r["permission_key"]) for r in rows}
    return sorted(perms)


def create_access_token(user_id: str, tenant_id: str, role_names: list[str]) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "roles": role_names,
        "permissions": _resolve_permissions(role_names),
        "iat": now,
        "exp": now + ACCESS_TOKEN_TTL_MINUTES * 60,
    }
    return _encode_token(payload)


def _store_refresh_token(user_id: str, tenant_id: str) -> tuple[str, int]:
    token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    expires_at = int(time.time()) + REFRESH_TOKEN_TTL_DAYS * 86400
    token_id = str(uuid4())

    pg_client.execute(
        """
        INSERT INTO refresh_tokens (token_id, user_id, tenant_id, token_hash, expires_at_epoch, revoked)
        VALUES (%s, %s, %s, %s, %s, FALSE)
        """,
        (token_id, user_id, tenant_id, token_hash, expires_at),
    )
    return token, expires_at


def _consume_refresh_token(refresh_token: str) -> dict[str, Any] | None:
    token_hash = hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()
    now = int(time.time())

    rows = pg_client.execute(
        """
        SELECT token_id, user_id, tenant_id, expires_at_epoch, revoked
        FROM refresh_tokens
        WHERE token_hash = %s
        LIMIT 1
        """,
        (token_hash,),
    )
    if not rows:
        return None
    row = rows[0]
    if row["revoked"] or int(row["expires_at_epoch"]) < now:
        return None
    pg_client.execute("UPDATE refresh_tokens SET revoked = TRUE WHERE token_id = %s", (row["token_id"],))
    return row


def _get_user_by_email(email: str) -> dict[str, Any] | None:
    rows = pg_client.execute(
        "SELECT user_id, email, full_name, password_hash, active FROM app_users WHERE LOWER(email) = LOWER(%s) LIMIT 1",
        (email,),
    )
    return rows[0] if rows else None


def _get_roles_for_user_tenant(user_id: str, tenant_id: str) -> list[str]:
    rows = pg_client.execute(
        """
        SELECT r.role_name
        FROM user_tenant_roles utr
        JOIN roles r ON r.role_id = utr.role_id
        WHERE utr.user_id = %s AND utr.tenant_id = %s
        """,
        (user_id, tenant_id),
    )
    return [str(r["role_name"]) for r in rows]


def list_user_tenants(user_id: str) -> list[dict[str, str]]:
    rows = pg_client.execute(
        """
        SELECT DISTINCT t.tenant_id, t.tenant_name
        FROM user_tenant_roles utr
        JOIN tenants t ON t.tenant_id = utr.tenant_id
        WHERE utr.user_id = %s
        ORDER BY t.tenant_name
        """,
        (user_id,),
    )
    return [{"tenant_id": r["tenant_id"], "tenant_name": r["tenant_name"]} for r in rows]


def authenticate(email: str, password: str, tenant_id: str) -> dict[str, Any] | None:
    user = _get_user_by_email(email)
    if not user or not bool(user.get("active")):
        return None
    if not verify_password(password, str(user["password_hash"])):
        return None

    roles = _get_roles_for_user_tenant(user["user_id"], tenant_id)
    if not roles:
        return None

    access = create_access_token(user["user_id"], tenant_id, roles)
    refresh, refresh_exp = _store_refresh_token(user["user_id"], tenant_id)
    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_TTL_MINUTES * 60,
        "refresh_expires_in": max(0, refresh_exp - int(time.time())),
        "tenant_id": tenant_id,
        "roles": roles,
        "user": {
            "user_id": user["user_id"],
            "email": user["email"],
            "full_name": user["full_name"],
        },
    }


def refresh_access_token(refresh_token: str) -> dict[str, Any] | None:
    payload = _consume_refresh_token(refresh_token)
    if not payload:
        return None

    user_id = str(payload["user_id"])
    tenant_id = str(payload["tenant_id"])
    roles = _get_roles_for_user_tenant(user_id, tenant_id)
    if not roles:
        return None

    access = create_access_token(user_id, tenant_id, roles)
    new_refresh, refresh_exp = _store_refresh_token(user_id, tenant_id)
    return {
        "access_token": access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_TTL_MINUTES * 60,
        "refresh_expires_in": max(0, refresh_exp - int(time.time())),
        "tenant_id": tenant_id,
        "roles": roles,
    }


def revoke_refresh_token(refresh_token: str) -> bool:
    token_hash = hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()
    pg_client.execute("UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = %s", (token_hash,))
    return True


def ensure_auth_seed_data() -> None:
    """Create default tenant, roles, permissions, and bootstrap super admin if empty."""

    permissions = [
        "admin.manage",
        "quotes.read",
        "quotes.write",
        "quotes.approve",
        "master_data.read",
        "master_data.manage",
        "analytics.read",
        "chatbot.ask",
        "tenant.users.manage",
        "tenant.roles.assign",
        "tenant.workflow.manage",
        "tenant.audit.read",
        "platform.tenants.manage",
        "platform.users.manage",
        "platform.audit.read",
        "platform.security.manage",
        "platform.sync",
    ]

    role_to_permissions = {
        "SuperAdmin": ["*"],
        "TenantAdmin": [
            "admin.manage",
            "quotes.read",
            "quotes.write",
            "quotes.approve",
            "master_data.read",
            "master_data.manage",
            "analytics.read",
            "chatbot.ask",
            "tenant.users.manage",
            "tenant.roles.assign",
            "tenant.workflow.manage",
            "tenant.audit.read",
        ],
        "PricingManager": ["quotes.read", "quotes.write", "quotes.approve", "analytics.read", "master_data.read", "chatbot.ask"],
        "SalesRep": ["quotes.read", "quotes.write", "analytics.read", "master_data.read", "chatbot.ask"],
        "Approver": ["quotes.read", "quotes.approve", "analytics.read", "master_data.read"],
        "Analyst": ["analytics.read", "quotes.read", "master_data.read"],
        "Viewer": ["quotes.read", "master_data.read", "analytics.read"],
    }

    if _tx_on_postgres():
        pg_client.execute(
            """
            INSERT INTO tenants (tenant_id, tenant_name, active)
            VALUES (%s, %s, TRUE)
            ON CONFLICT (tenant_id) DO NOTHING
            """,
            (AUTH_BOOTSTRAP_TENANT, AUTH_BOOTSTRAP_TENANT),
        )

        for key in permissions:
            pg_client.execute(
                """
                INSERT INTO permissions (permission_id, permission_key, description)
                VALUES (%s, %s, %s)
                ON CONFLICT (permission_key) DO NOTHING
                """,
                (str(uuid4()), key, key),
            )

        for role_name in role_to_permissions:
            pg_client.execute(
                """
                INSERT INTO roles (role_id, role_name, description)
                VALUES (%s, %s, %s)
                ON CONFLICT (role_name) DO NOTHING
                """,
                (str(uuid4()), role_name, role_name),
            )

        rows = pg_client.execute("SELECT COUNT(*) AS c FROM app_users")
        user_count = int(rows[0]["c"]) if rows else 0
        if user_count == 0:
            user_id = str(uuid4())
            pg_client.execute(
                """
                INSERT INTO app_users (user_id, email, full_name, password_hash, active)
                VALUES (%s, %s, %s, %s, TRUE)
                """,
                (user_id, AUTH_BOOTSTRAP_EMAIL, "Bootstrap SuperAdmin", _hash_password(AUTH_BOOTSTRAP_PASSWORD)),
            )
            role_id_rows = pg_client.execute("SELECT role_id FROM roles WHERE role_name = %s LIMIT 1", ("SuperAdmin",))
            if role_id_rows:
                pg_client.execute(
                    """
                    INSERT INTO user_tenant_roles (id, user_id, tenant_id, role_id, active)
                    VALUES (%s, %s, %s, %s, TRUE)
                    ON CONFLICT DO NOTHING
                    """,
                    (str(uuid4()), user_id, AUTH_BOOTSTRAP_TENANT, role_id_rows[0]["role_id"]),
                )

        for role_name, keys in role_to_permissions.items():
            role_rows = pg_client.execute("SELECT role_id FROM roles WHERE role_name = %s LIMIT 1", (role_name,))
            if not role_rows:
                continue
            role_id = role_rows[0]["role_id"]
            if "*" in keys:
                continue
            for key in keys:
                perm_rows = pg_client.execute("SELECT permission_id FROM permissions WHERE permission_key = %s LIMIT 1", (key,))
                if not perm_rows:
                    continue
                perm_id = perm_rows[0]["permission_id"]
                pg_client.execute(
                    """
                    INSERT INTO role_permissions (id, role_id, permission_id)
                    VALUES (%s, %s, %s)
                    ON CONFLICT DO NOTHING
                    """,
                    (str(uuid4()), role_id, perm_id),
                )

        return

        return
