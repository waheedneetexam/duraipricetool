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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, column_key)
);

CREATE TABLE IF NOT EXISTS products (
    product_id TEXT PRIMARY KEY,
    sku TEXT,
    name TEXT,
    description TEXT,
    family TEXT,
    category TEXT,
    price NUMERIC,
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

CREATE INDEX IF NOT EXISTS idx_hist_tx_updated_at ON historical_transactions (updated_at);
CREATE INDEX IF NOT EXISTS idx_hist_tx_date ON historical_transactions (transaction_date);
CREATE INDEX IF NOT EXISTS idx_hist_tx_quote_id ON historical_transactions (quote_id);
CREATE INDEX IF NOT EXISTS idx_hist_tx_customer_segment ON historical_transactions (customer_segment);
CREATE INDEX IF NOT EXISTS idx_quotes_updated_at ON quotes (updated_at);
CREATE INDEX IF NOT EXISTS idx_quote_lines_updated_at ON quote_line_items (updated_at);
CREATE INDEX IF NOT EXISTS idx_line_item_cfg_tenant ON line_item_column_configs (tenant_id);
