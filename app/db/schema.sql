CREATE TABLE IF NOT EXISTS historical_transactions (
    id BIGINT,
    transaction_date DATE,
    sku VARCHAR,
    product_family VARCHAR,
    customer_id VARCHAR,
    customer_name VARCHAR,
    customer_segment VARCHAR,
    region VARCHAR,
    list_price DOUBLE,
    discount_percent DOUBLE,
    net_price DOUBLE,
    cost DOUBLE,
    quantity INTEGER,
    revenue DOUBLE,
    margin DOUBLE,
    quote_id VARCHAR,
    sales_rep VARCHAR,
    currency VARCHAR
);

CREATE TABLE IF NOT EXISTS quotes (
    quote_id VARCHAR PRIMARY KEY,
    customer_id VARCHAR,
    customer_name VARCHAR,
    customer_segment VARCHAR,
    status VARCHAR,
    header_fields JSON,
    total_list_price DOUBLE,
    total_net_price DOUBLE,
    total_cost DOUBLE,
    total_margin DOUBLE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quote_line_items (
    quote_line_id VARCHAR PRIMARY KEY,
    quote_id VARCHAR,
    sku VARCHAR,
    quantity INTEGER,
    list_price DOUBLE,
    discount_percent DOUBLE,
    net_price DOUBLE,
    cost DOUBLE,
    margin DOUBLE,
    dynamic_fields JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflow_rules (
    rule_id VARCHAR PRIMARY KEY,
    customer_id VARCHAR,
    customer_segment VARCHAR,
    state_from VARCHAR,
    state_to VARCHAR,
    metric_name VARCHAR,
    comparator VARCHAR,
    threshold DOUBLE,
    required_approver_role VARCHAR,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS formula_definitions (
    formula_id VARCHAR PRIMARY KEY,
    target_field VARCHAR,
    expression VARCHAR,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS line_item_column_configs (
    tenant_id VARCHAR,
    column_key VARCHAR,
    column_label VARCHAR,
    visible BOOLEAN DEFAULT TRUE,
    mandatory BOOLEAN DEFAULT FALSE,
    editable BOOLEAN DEFAULT TRUE,
    is_calculated BOOLEAN DEFAULT FALSE,
    formula VARCHAR,
    field_type VARCHAR DEFAULT 'text',
    default_value VARCHAR,
    width INTEGER,
    options_json JSON,
    validation_json JSON,
    description VARCHAR,
    category VARCHAR,
    sort_order INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS field_logic_rules (
    logic_id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR,
    scope VARCHAR,
    field_key VARCHAR,
    natural_language_logic VARCHAR,
    generated_code VARCHAR,
    explanation VARCHAR,
    dependencies_json JSON,
    version INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS field_logic_validation_runs (
    validation_id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR,
    scope VARCHAR,
    field_key VARCHAR,
    status VARCHAR,
    severity VARCHAR,
    errors_json JSON,
    warnings_json JSON,
    generated_code VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_pricing_configurations (
    config_id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR,
    template_text VARCHAR,
    status VARCHAR DEFAULT 'draft',
    summary VARCHAR,
    confidence DOUBLE,
    processed_result_json JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    product_id VARCHAR PRIMARY KEY,
    sku VARCHAR,
    name VARCHAR,
    description VARCHAR,
    family VARCHAR,
    category VARCHAR,
    price DECIMAL,
    cost DECIMAL,
    unit_of_measure VARCHAR,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    customer_id VARCHAR PRIMARY KEY,
    account_number VARCHAR,
    name VARCHAR,
    segment VARCHAR,
    region VARCHAR,
    country VARCHAR,
    email VARCHAR,
    credit_limit DECIMAL,
    industry VARCHAR,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sellers (
    seller_id VARCHAR PRIMARY KEY,
    name VARCHAR,
    territory VARCHAR,
    manager VARCHAR,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_extensions (
    extension_id VARCHAR PRIMARY KEY,
    customer_id VARCHAR REFERENCES customers(customer_id),
    attribute_key VARCHAR,
    attribute_value VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seller_extensions (
    extension_id VARCHAR PRIMARY KEY,
    seller_id VARCHAR REFERENCES sellers(seller_id),
    attribute_key VARCHAR,
    attribute_value VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_extensions (
    extension_id VARCHAR PRIMARY KEY,
    product_id VARCHAR REFERENCES products(product_id),
    attribute_key VARCHAR,
    attribute_value VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_references (
    reference_id VARCHAR PRIMARY KEY,
    product_id VARCHAR REFERENCES products(product_id),
    reference_type VARCHAR,
    reference_value VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_hierarchies (
    id VARCHAR PRIMARY KEY,
    name VARCHAR,
    description VARCHAR,
    parent_id VARCHAR,
    level INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_orgs (
    id VARCHAR PRIMARY KEY,
    name VARCHAR,
    region VARCHAR,
    manager VARCHAR,
    manager_email VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS regions (
    id VARCHAR PRIMARY KEY,
    name VARCHAR,
    countries VARCHAR,
    currency VARCHAR,
    timezone VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS currencies (
    code VARCHAR PRIMARY KEY,
    name VARCHAR,
    symbol VARCHAR,
    exchange_rate DOUBLE,
    decimal_places INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_costs (
    id VARCHAR PRIMARY KEY,
    product_sku VARCHAR,
    region_id VARCHAR,
    cost DOUBLE,
    effective_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discount_tiers (
    id VARCHAR PRIMARY KEY,
    tier_name VARCHAR,
    min_quantity INTEGER,
    max_quantity INTEGER,
    discount_percent DOUBLE,
    product_category VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pricing_rules (
    id VARCHAR PRIMARY KEY,
    rule_name VARCHAR,
    description VARCHAR,
    customer_type VARCHAR,
    product_category VARCHAR,
    discount_percent DOUBLE,
    price_multiplier DOUBLE,
    priority INTEGER,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
