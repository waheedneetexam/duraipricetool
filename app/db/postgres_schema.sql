CREATE TABLE IF NOT EXISTS historical_transactions (
    id BIGINT PRIMARY KEY,
    transaction_date DATE,
    sku TEXT,
    product_family TEXT,
    customer_id TEXT,
    customer_name TEXT,
    customer_segment TEXT,
    region TEXT,
    list_price DOUBLE PRECISION,
    discount_percent DOUBLE PRECISION,
    net_price DOUBLE PRECISION,
    cost DOUBLE PRECISION,
    quantity INTEGER,
    revenue DOUBLE PRECISION,
    margin DOUBLE PRECISION,
    quote_id TEXT,
    sales_rep TEXT,
    currency TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quotes (
    quote_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    customer_id TEXT,
    customer_name TEXT,
    customer_segment TEXT,
    status TEXT,
    header_fields JSONB,
    total_list_price DOUBLE PRECISION,
    total_net_price DOUBLE PRECISION,
    total_cost DOUBLE PRECISION,
    total_margin DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quote_line_items (
    quote_line_id TEXT PRIMARY KEY,
    quote_id TEXT,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    sku TEXT,
    quantity INTEGER,
    list_price DOUBLE PRECISION,
    discount_percent DOUBLE PRECISION,
    net_price DOUBLE PRECISION,
    cost DOUBLE PRECISION,
    margin DOUBLE PRECISION,
    dynamic_fields JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflow_rules (
    rule_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    customer_id TEXT,
    customer_segment TEXT,
    state_from TEXT,
    state_to TEXT,
    metric_name TEXT,
    comparator TEXT,
    threshold DOUBLE PRECISION,
    required_approver_role TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS formula_definitions (
    formula_id TEXT PRIMARY KEY,
    target_field TEXT,
    expression TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_state (
    sync_name TEXT PRIMARY KEY,
    last_cursor_ts TIMESTAMP,
    last_cursor_id TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS line_item_column_configs (
    tenant_id TEXT NOT NULL,
    column_key TEXT NOT NULL,
    column_label TEXT NOT NULL,
    visible BOOLEAN DEFAULT TRUE,
    mandatory BOOLEAN DEFAULT FALSE,
    editable BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    is_calculated BOOLEAN DEFAULT FALSE,
    formula TEXT,
    field_type TEXT DEFAULT 'text',
    default_value TEXT,
    width INTEGER,
    options_json JSONB,
    validation_json JSONB,
    description TEXT,
    category TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, column_key)
);

CREATE TABLE IF NOT EXISTS field_logic_rules (
    logic_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    field_key TEXT NOT NULL,
    natural_language_logic TEXT,
    generated_code TEXT,
    explanation TEXT,
    dependencies_json JSONB,
    version INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS field_logic_validation_runs (
    validation_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    field_key TEXT NOT NULL,
    status TEXT NOT NULL,
    severity TEXT NOT NULL,
    errors_json JSONB,
    warnings_json JSONB,
    generated_code TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_pricing_configurations (
    config_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    template_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    summary TEXT,
    confidence DOUBLE PRECISION,
    processed_result_json JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    product_id TEXT PRIMARY KEY,
    sku TEXT,
    name TEXT,
    description TEXT,
    family TEXT,
    category TEXT,
    price NUMERIC,
    cost NUMERIC,
    unit_of_measure TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    customer_id TEXT PRIMARY KEY,
    account_number TEXT,
    name TEXT,
    segment TEXT,
    region TEXT,
    country TEXT,
    email TEXT,
    credit_limit NUMERIC,
    industry TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sellers (
    seller_id TEXT PRIMARY KEY,
    name TEXT,
    territory TEXT,
    manager TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_extensions (
    extension_id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES customers(customer_id),
    attribute_key TEXT,
    attribute_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seller_extensions (
    extension_id TEXT PRIMARY KEY,
    seller_id TEXT REFERENCES sellers(seller_id),
    attribute_key TEXT,
    attribute_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_extensions (
    extension_id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products(product_id),
    attribute_key TEXT,
    attribute_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_references (
    reference_id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products(product_id),
    reference_type TEXT,
    reference_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_hierarchies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    parent_id TEXT,
    level INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_orgs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    region TEXT NOT NULL,
    manager TEXT,
    manager_email TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS regions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    countries TEXT,
    currency TEXT,
    timezone TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS currencies (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    exchange_rate DOUBLE PRECISION NOT NULL,
    decimal_places INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_costs (
    id TEXT PRIMARY KEY,
    product_sku TEXT NOT NULL,
    region_id TEXT NOT NULL,
    cost DOUBLE PRECISION NOT NULL,
    effective_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discount_tiers (
    id TEXT PRIMARY KEY,
    tier_name TEXT NOT NULL,
    min_quantity INTEGER NOT NULL,
    max_quantity INTEGER,
    discount_percent DOUBLE PRECISION NOT NULL,
    product_category TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pricing_rules (
    id TEXT PRIMARY KEY,
    rule_name TEXT NOT NULL,
    description TEXT,
    customer_type TEXT,
    product_category TEXT,
    discount_percent DOUBLE PRECISION,
    price_multiplier DOUBLE PRECISION,
    priority INTEGER,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenants (
    tenant_id TEXT PRIMARY KEY,
    tenant_name TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    password_hash TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
    role_id TEXT PRIMARY KEY,
    role_name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
    permission_id TEXT PRIMARY KEY,
    permission_key TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id TEXT PRIMARY KEY,
    role_id TEXT REFERENCES roles(role_id),
    permission_id TEXT REFERENCES permissions(permission_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_tenant_roles (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES app_users(user_id),
    tenant_id TEXT REFERENCES tenants(tenant_id),
    role_id TEXT REFERENCES roles(role_id),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tenant_id, role_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES app_users(user_id),
    tenant_id TEXT REFERENCES tenants(tenant_id),
    token_hash TEXT UNIQUE NOT NULL,
    expires_at_epoch BIGINT NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS cost NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_of_measure TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE quote_line_items ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE workflow_rules ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE historical_transactions ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE product_extensions ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE customer_extensions ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE seller_extensions ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE product_references ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE product_hierarchies ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE sales_orgs ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE regions ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE currencies ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE product_costs ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE discount_tiers ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';

CREATE INDEX IF NOT EXISTS idx_hist_tx_updated_at ON historical_transactions (updated_at);
CREATE INDEX IF NOT EXISTS idx_hist_tx_date ON historical_transactions (transaction_date);
CREATE INDEX IF NOT EXISTS idx_hist_tx_quote_id ON historical_transactions (quote_id);
CREATE INDEX IF NOT EXISTS idx_hist_tx_customer_segment ON historical_transactions (customer_segment);
CREATE INDEX IF NOT EXISTS idx_quotes_updated_at ON quotes (updated_at);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_id ON quotes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_quote_lines_updated_at ON quote_line_items (updated_at);
CREATE INDEX IF NOT EXISTS idx_quote_lines_tenant_id ON quote_line_items (tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_rules_tenant_id ON workflow_rules (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hist_tx_tenant_id ON historical_transactions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products (tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sellers_tenant_id ON sellers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_ext_tenant_id ON product_extensions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_ext_tenant_id ON customer_extensions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_seller_ext_tenant_id ON seller_extensions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_refs_tenant_id ON product_references (tenant_id);
CREATE INDEX IF NOT EXISTS idx_line_item_cfg_tenant ON line_item_column_configs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_field_logic_tenant_field ON field_logic_rules (tenant_id, scope, field_key);
CREATE INDEX IF NOT EXISTS idx_field_logic_validation_tenant_field ON field_logic_validation_runs (tenant_id, scope, field_key);
CREATE INDEX IF NOT EXISTS idx_ai_pricing_tenant_status ON ai_pricing_configurations (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_product_costs_sku_region ON product_costs (product_sku, region_id);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users (email);
CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_user_tenant ON user_tenant_roles (user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens (token_hash);

CREATE TABLE IF NOT EXISTS audit_log (
    log_id TEXT PRIMARY KEY,
    actor_user_id TEXT,
    actor_tenant_id TEXT,
    target_type TEXT,
    target_id TEXT,
    action TEXT,
    detail JSONB,
    created_at_epoch BIGINT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log (actor_tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_time ON audit_log (created_at_epoch DESC);

