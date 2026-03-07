"""Platform-level service: tenant and user management for SuperAdmin and TenantAdmin operations."""
from typing import Any
from uuid import uuid4

def _pg() -> bool:
    return True


# ── Tenant management ────────────────────────────────────────────────────────

def list_tenants() -> list[dict[str, Any]]:
    rows = pg_client.execute("SELECT tenant_id, tenant_name, active FROM tenants ORDER BY tenant_name")
    return [dict(r) for r in rows]


def create_tenant(tenant_name: str) -> dict[str, Any]:
    tenant_id = str(uuid4())
    pg_client.execute(
        "INSERT INTO tenants (tenant_id, tenant_name, active) VALUES (%s, %s, TRUE)",
        (tenant_id, tenant_name),
    )
    return {"tenant_id": tenant_id, "tenant_name": tenant_name, "active": True}


def set_tenant_active(tenant_id: str, active: bool) -> dict[str, Any]:
    pg_client.execute("UPDATE tenants SET active = %s WHERE tenant_id = %s", (active, tenant_id))
    rows = pg_client.execute("SELECT tenant_id, tenant_name, active FROM tenants WHERE tenant_id = %s", (tenant_id,))
    if not rows:
        raise ValueError(f"Tenant {tenant_id!r} not found.")
    return dict(rows[0])


def delete_tenant(tenant_id: str) -> None:
    """Permanently delete a tenant and all its associated data. 'default' cannot be deleted."""
    if tenant_id == "default":
        raise ValueError("The 'default' tenant cannot be deleted.")

    tables = [
        "quotes", "quote_line_items", "workflow_rules", "historical_transactions",
        "line_item_column_configs", "field_logic_rules", "field_logic_validation_runs",
        "ai_pricing_configurations", "products", "customers", "sellers",
        "product_extensions", "customer_extensions", "seller_extensions",
        "product_references", "product_hierarchies", "sales_orgs", "regions",
        "currencies", "product_costs", "discount_tiers", "pricing_rules",
        "user_tenant_roles", "refresh_tokens", "tenants"
    ]

    for table in tables:
        pg_client.execute(f"DELETE FROM {table} WHERE tenant_id = %s", (tenant_id,))


def update_tenant_name(tenant_id: str, new_name: str) -> dict[str, Any]:
    """Update a tenant's name. Parameterized query handles escaping."""
    pg_client.execute("UPDATE tenants SET tenant_name = %s WHERE tenant_id = %s", (new_name, tenant_id))
    rows = pg_client.execute("SELECT tenant_id, tenant_name, active FROM tenants WHERE tenant_id = %s", (tenant_id,))
    if not rows:
        raise ValueError(f"Tenant {tenant_id!r} not found.")
    return dict(rows[0])


# ── User management (platform-wide) ─────────────────────────────────────────

def list_all_users() -> list[dict[str, Any]]:
    """List all users with their tenant assignments (readable names)."""
    rows = pg_client.execute(
        """
        SELECT u.user_id, u.email, u.full_name, u.active,
               STRING_AGG(t.tenant_id || ':' || t.tenant_name || ':' || r.role_name, ',') AS tenant_roles
        FROM app_users u
        LEFT JOIN user_tenant_roles utr ON utr.user_id = u.user_id
        LEFT JOIN tenants t ON t.tenant_id = utr.tenant_id
        LEFT JOIN roles r ON r.role_id = utr.role_id
        GROUP BY u.user_id, u.email, u.full_name, u.active
        ORDER BY u.email
        """
    )
    return [dict(r) for r in rows]


def create_platform_user(
    email: str,
    full_name: str,
    password: str,
    tenant_id: str,
    role_name: str,
) -> dict[str, Any]:
    """Create a user and immediately assign them to a tenant with a role."""
    # Check uniqueness
    existing = pg_client.execute("SELECT user_id FROM app_users WHERE LOWER(email) = LOWER(%s) LIMIT 1", (email,))
    if existing:
        raise ValueError(f"User with email {email!r} already exists.")

    user_id = str(uuid4())
    pw_hash = _hash_password(password)

    pg_client.execute(
        "INSERT INTO app_users (user_id, email, full_name, password_hash, active) VALUES (%s, %s, %s, %s, TRUE)",
        (user_id, email, full_name, pw_hash),
    )
    role_rows = pg_client.execute("SELECT role_id FROM roles WHERE role_name = %s LIMIT 1", (role_name,))

    if not role_rows:
        raise ValueError(f"Role {role_name!r} does not exist.")
    role_id = role_rows[0]["role_id"] if _pg() else role_rows[0][0]

    _assign_role_to_user(user_id, tenant_id, role_id)
    return {"user_id": user_id, "email": email, "full_name": full_name, "active": True, "tenant_id": tenant_id, "role": role_name}


def assign_user_to_tenant(user_id: str, tenant_id: str, role_name: str) -> dict[str, Any]:
    """Assign an existing user to a tenant with the given role."""
    role_rows = pg_client.execute("SELECT role_id FROM roles WHERE role_name = %s LIMIT 1", (role_name,))
    if not role_rows:
        raise ValueError(f"Role {role_name!r} does not exist.")
    role_id = role_rows[0]["role_id"]
    _assign_role_to_user(user_id, tenant_id, role_id)
    return {"user_id": user_id, "tenant_id": tenant_id, "role": role_name}


def _assign_role_to_user(user_id: str, tenant_id: str, role_id: str) -> None:
    utr_id = str(uuid4())
    pg_client.execute(
        """
        INSERT INTO user_tenant_roles (id, user_id, tenant_id, role_id, active)
        VALUES (%s, %s, %s, %s, TRUE)
        ON CONFLICT DO NOTHING
        """,
        (utr_id, user_id, tenant_id, role_id),
    )


# ── TenantAdmin: manage users within own tenant ──────────────────────────────

# Business roles TenantAdmin is allowed to assign (never SuperAdmin)
_TENANT_ASSIGNABLE_ROLES = {"TenantAdmin", "PricingManager", "SalesRep", "Approver", "Analyst", "Viewer"}


def list_tenant_users(tenant_id: str) -> list[dict[str, Any]]:
    rows = pg_client.execute(
        """
        SELECT u.user_id, u.email, u.full_name, u.active,
               STRING_AGG(r.role_name, ',') AS roles
        FROM app_users u
        JOIN user_tenant_roles utr ON utr.user_id = u.user_id AND utr.tenant_id = %s
        JOIN roles r ON r.role_id = utr.role_id
        GROUP BY u.user_id, u.email, u.full_name, u.active
        ORDER BY u.email
        """,
        (tenant_id,),
    )
    return [dict(r) for r in rows]


def create_tenant_user(tenant_id: str, email: str, full_name: str, password: str, role_name: str) -> dict[str, Any]:
    if role_name not in _TENANT_ASSIGNABLE_ROLES:
        raise ValueError(f"TenantAdmin cannot assign role {role_name!r}. Allowed: {sorted(_TENANT_ASSIGNABLE_ROLES)}")
    return create_platform_user(email, full_name, password, tenant_id, role_name)


def assign_tenant_user_role(tenant_id: str, user_id: str, role_name: str) -> dict[str, Any]:
    """TenantAdmin assigns a business role. Blocks SuperAdmin."""
    if role_name not in _TENANT_ASSIGNABLE_ROLES:
        raise ValueError(f"TenantAdmin cannot assign role {role_name!r}.")
    return assign_user_to_tenant(user_id, tenant_id, role_name)


def remove_tenant_user_role(tenant_id: str, user_id: str, role_name: str) -> None:
    """Remove a specific role from a user within the tenant."""
    pg_client.execute(
        """
        DELETE FROM user_tenant_roles
        WHERE user_id = %s AND tenant_id = %s
          AND role_id = (SELECT role_id FROM roles WHERE role_name = %s LIMIT 1)
        """,
        (user_id, tenant_id, role_name),
    )


def list_available_roles(for_superadmin: bool = False) -> list[str]:
    """Return role names assignable by the caller."""
    if for_superadmin:
        rows = pg_client.execute("SELECT role_name FROM roles ORDER BY role_name")
        return [r["role_name"] for r in rows]
    return sorted(_TENANT_ASSIGNABLE_ROLES)
