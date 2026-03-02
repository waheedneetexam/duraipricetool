# DuraiPricingTool Technical Blueprint

## 1) Antigravity Architecture
- Frontend: `React + TypeScript + AG Grid + Apache ECharts`
- Backend: `FastAPI` modular services (`admin`, `analytics`, `quotes`, `workflow`, `chatbot`)
- Database: `DuckDB` for OLAP-style aggregations and fast local analytics
- Processing: server-side chunked CSV ingestion (`pandas chunksize`) to support large files
- Extensibility: formula engine + dynamic schema fields (`JSON` columns for quote header/line custom fields)

## 2) Module Design
- Admin & Data Integration:
  - Secure admin-ready APIs with seed/ingestion endpoints (can be fronted by SSO/auth proxy)
  - CSV ingest with flexible column mapping into historical transaction schema
  - Synthetic data generator (`>=10,000` rows)
- Analytics:
  - Waterfall (price bridge), scatter (price-volume), bar (segment mix), time series
  - Drill-down API tied to chart keys
  - OOTB NL->SQL chatbot endpoint with starter intent mappings
- Quoting:
  - Dynamic header and line custom fields stored as JSON
  - Formula parser for admin-defined formulas
  - Embedded analytics in quote response (mini waterfall + historical trend)
- Workflow:
  - Configurable state machine (`Draft -> Pending Approval -> Approved/Rejected`)
  - Customer-specific thresholds (`Customer A >20%`, `Customer B >10%`)

## 3) Data Schema (SQL)
```sql
-- historical_transactions
id BIGINT
transaction_date DATE
sku VARCHAR
product_family VARCHAR
customer_id VARCHAR
customer_name VARCHAR
customer_segment VARCHAR
region VARCHAR
list_price DOUBLE
discount_percent DOUBLE
net_price DOUBLE
cost DOUBLE
quantity INTEGER
revenue DOUBLE
margin DOUBLE
quote_id VARCHAR
sales_rep VARCHAR
currency VARCHAR

-- quotes
quote_id VARCHAR PRIMARY KEY
customer_id VARCHAR
customer_name VARCHAR
customer_segment VARCHAR
status VARCHAR
header_fields JSON
total_list_price DOUBLE
total_net_price DOUBLE
total_cost DOUBLE
total_margin DOUBLE
created_at TIMESTAMP
updated_at TIMESTAMP

-- quote_line_items
quote_line_id VARCHAR PRIMARY KEY
quote_id VARCHAR
sku VARCHAR
quantity INTEGER
list_price DOUBLE
discount_percent DOUBLE
net_price DOUBLE
cost DOUBLE
margin DOUBLE
dynamic_fields JSON
created_at TIMESTAMP
updated_at TIMESTAMP

-- workflow_rules
rule_id VARCHAR PRIMARY KEY
customer_id VARCHAR NULL
customer_segment VARCHAR NULL
state_from VARCHAR
state_to VARCHAR
metric_name VARCHAR
comparator VARCHAR
threshold DOUBLE
required_approver_role VARCHAR
active BOOLEAN
```

## 4) JSON Contracts
```json
{
  "header": {
    "quote_id": "Q-1001",
    "customer_id": "CustomerA",
    "customer_name": "Customer A Holdings",
    "customer_segment": "Enterprise",
    "header_fields": {"deal_type": "Renewal", "region_owner": "NA-East"}
  },
  "line_items": [
    {
      "quote_line_id": "QL-1",
      "sku": "SKU-1001",
      "quantity": 20,
      "list_price": 1000,
      "discount_percent": 0.18,
      "cost": 640,
      "dynamic_fields": {"competitor_price": 790}
    }
  ],
  "formulas": [
    {"target_field": "net_price", "expression": "list_price * (1 - discount_percent)"},
    {"target_field": "margin", "expression": "(net_price - cost) * quantity"}
  ]
}
```

## 5) API Specs
- `POST /admin/ingest/csv`
  - multipart:
    - `file`: CSV file
    - `mapping_json`: JSON mapping from source column -> target schema
  - behavior: chunked read (`5000` rows/chunk), transform, bulk insert
- `POST /admin/seed/sample-data?row_count=10000`
  - generates synthetic B2B price history
- `POST /quotes/calculate`
  - dynamic formula evaluation, stores quote header/lines, returns embedded analytics
- `POST /quotes/workflow/evaluate`
  - checks workflow rule thresholds and approval requirements
- `GET /analytics/{waterfall|scatter|bar|time-series}`
  - returns chart-ready datasets
- `GET /analytics/drilldown?chart_type=bar&key=Enterprise`
  - returns row-level records for chart selection
- `POST /chatbot/ask`
  - NL question to SQL + query result payload

## 6) Quote Screen UI Mockup Logic
- Top strip:
  - quote identity, customer, status pill, workflow actions (Submit, Approve, Reject)
- Left pane (60-70%):
  - dense editable line-item grid (AG Grid), dynamic columns from metadata
  - inline computed fields (`net_price`, `margin`, `effective_discount`)
- Right pane (30-40%):
  - header custom fields card (dynamic forms)
  - mini waterfall (bridge: list -> discount -> net -> margin)
  - 6-month historical trend sparkline for customer/SKU context
- Bottom tabbed region:
  - approval trail
  - drill-down historical transactions
  - chatbot panel for natural language pricing questions

## 7) Performance Notes
- Keep heavy analytics server-side with DuckDB SQL aggregations
- Use paged drill-down responses for large result sets
- Precompute common summary tables if data grows beyond single-node memory budget
- For multi-user production scale, swap/augment storage with `DuckDB + object storage parquet` or distributed OLAP backend
