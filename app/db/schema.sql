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
    sort_order INTEGER DEFAULT 0,
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
