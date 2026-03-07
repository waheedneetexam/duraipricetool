"""Static data classification map (documentation only; not used at runtime)."""

DATA_CLASSIFICATION = {
    "master_data": [
        "products",
        "customers",
        "sellers",
        "regions",
        "currencies",
        "product_costs",
        "product_hierarchies",
        "product_references",
        "product_extensions",
        "customer_extensions",
        "seller_extensions",
        "sales_orgs",
    ],
    "transactional_data": [
        "quotes",
        "quote_line_items",
        "historical_transactions",
    ],
    "configuration_data": [
        "line_item_column_configs",
        "field_logic_rules",
        "field_logic_validation_runs",
        "workflow_rules",
        "pricing_rules",
        "discount_tiers",
        "formula_definitions",
        "ai_pricing_configurations",
        "ai_provider_keys",
    ],
    "metadata": [
        "sync_state",
        "audit_log",
    ],
    "organization_data": [
        "tenants",
        "app_users",
        "roles",
        "permissions",
        "role_permissions",
        "user_tenant_roles",
        "refresh_tokens",
    ],
}
