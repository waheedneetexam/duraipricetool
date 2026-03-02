# DuraiPricingTool

Modular enterprise pricing foundation (CPQ/PRO) with DuckDB analytics, chunked CSV ingestion, dynamic quote formulas, and configurable workflows.

## Project Structure
```text
DuraiPricingTool/
  app/
    api/
    core/
    db/
    engines/
    models/
    services/
    main.py
  docs/TECHNICAL_BLUEPRINT.md
  frontend/
  requirements.txt
```

## Setup
```bash
cd /home/waheed/DuraiPricingTool
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run
```bash
source .venv/bin/activate
uvicorn app.main:app --reload --port 8080
```

## Frontend Setup (React + AG Grid + ECharts)
```bash
cd /home/waheed/DuraiPricingTool/frontend
npm install
```

## Run Frontend
```bash
cd /home/waheed/DuraiPricingTool/frontend
npm run dev
```

Frontend URL: `http://<server-ip>:5173`

If backend is on another host/port, set:
```bash
export VITE_API_BASE_URL="http://<backend-ip>:9000"
npm run dev
```

## Quick Start
1. Seed synthetic data (10k rows):
```bash
curl -X POST "http://127.0.0.1:8080/admin/seed/sample-data?row_count=10000"
```

2. Seed default workflow rules:
```bash
curl -X POST "http://127.0.0.1:8080/admin/seed/workflow-rules"
```

3. Call analytics:
```bash
curl "http://127.0.0.1:8080/analytics/waterfall"
```

4. Calculate a quote:
```bash
curl -X POST "http://127.0.0.1:8080/quotes/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "header":{
      "quote_id":"Q-12345",
      "customer_id":"CustomerA",
      "customer_name":"Customer A Holdings",
      "customer_segment":"Enterprise",
      "header_fields":{"deal_type":"New"}
    },
    "line_items":[
      {"quote_line_id":"QL-1","sku":"SKU-1001","quantity":20,"list_price":1000,"discount_percent":0.15,"cost":600,"dynamic_fields":{"note":"priority"}},
      {"quote_line_id":"QL-2","sku":"SKU-2001","quantity":5,"list_price":4000,"discount_percent":0.10,"cost":2800,"dynamic_fields":{"bundle":"yes"}}
    ],
    "formulas":[
      {"target_field":"net_price","expression":"list_price * (1 - discount_percent)"},
      {"target_field":"margin","expression":"(net_price - cost) * quantity"}
    ]
  }'
```

5. Ask chatbot:
```bash
curl -X POST "http://127.0.0.1:8080/chatbot/ask" \
  -H "Content-Type: application/json" \
  -d '{"question":"What was the margin leak in Q3?"}'
```

## Notes
- CSV upload is chunked (`5000` rows/chunk) to support large files.
- Dynamic quote fields are represented through `header_fields` and `dynamic_fields` JSON payloads.

## Hybrid PostgreSQL + DuckDB Mode
Transactional APIs can run on PostgreSQL while analytics remain on DuckDB.

Environment variables:
```bash
export DB_ENGINE=hybrid
export PG_DSN="postgresql://postgres:postgres@127.0.0.1:5432/duraipricing"
```

Start backend:
```bash
cd /home/waheed/DuraiPricingTool
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 9000
```

Run sync once (Postgres -> DuckDB):
```bash
python -m app.workers.pg_to_duck_sync --once
```

Run sync worker continuously:
```bash
python -m app.workers.pg_to_duck_sync --interval 30
```

Admin API trigger for one sync:
```bash
curl -X POST "http://127.0.0.1:9000/admin/sync/run-once"
```
