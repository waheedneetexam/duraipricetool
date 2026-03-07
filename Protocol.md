# DuraiPricingTool Protocol (AI Agent Handover)

Last updated: 2026-03-07

This protocol is the single source of truth for onboarding a new AI agent to this project. Keep it updated after meaningful changes (features, infra, schema, auth, URLs, ports, etc.).

---

## 1) Project Overview

DuraiPricingTool is a pricing/quoting web app with:
- Frontend: Vite + React (served via Nginx to public domain).
- Backend: FastAPI (Uvicorn) on port `9000`.
- Database: **PostgreSQL only** (DuckDB disabled).

Key features:
- Quote creation with line items
- Formula Builder (AI-assisted)
- SQL draft preview (OpenAI/Vanna)
- Master data management (products/customers/sellers)
- Region discount applied to line items based on customer

---

## 2) Environments / Services

### Backend
- Systemd service: `duraiprice-backend`
- Uvicorn: `0.0.0.0:9000`
- Health: `http://127.0.0.1:9000/health`

### Frontend
- Dev server: Vite on `0.0.0.0:5173`
- Production: Nginx (SPA)

### Database
- PostgreSQL: `postgresql://postgres:postgres@127.0.0.1:5432/duraipricing`
- DuckDB: **disabled** (`DB_ENGINE=postgres`, `DUCKDB_READ_ONLY=1`)

---

## 3) Active Config

File: `/.env.backend`
```
DB_ENGINE=postgres
DUCKDB_READ_ONLY=1
PG_DSN=postgresql://postgres:postgres@127.0.0.1:5432/duraipricing
```

---

## 4) URLs / Domains

Main app:
- `https://duraiprice.swapunits.online/`

readme.html (documentation index):
- `https://duraiprice.swapunits.online/readme.html`

database.html (data classification doc):
- `https://duraiprice.swapunits.online/database.html`

Note: readme.html is placed in:
- `frontend/public/readme.html` (dev)
- `frontend/dist/readme.html` (prod static)

If routing issues occur, add explicit Nginx location for `/readme.html`.

---

## 5) Recent Critical Changes

### A) Customer Region Discount (backend-driven)
- On quote save, backend updates `quote_line_items.customer_region_discount`
- Query uses `customers.region_id` if available, else `customers.region`
- Handles missing columns with fallback logic
- Also added region discount to API response

Key file: `app/services/quote_service.py`

### B) Auto-save on Customer Selection
- Frontend auto-saves when customer changes (debounced)
- Triggers backend region discount update

Key file: `frontend/src/components/PricingTableWithTabs.tsx`

### C) Customer & Product Modal Selection
- Customer Name input opens modal to pick customer (10/page)
  - `frontend/src/components/CustomerSelectModal.tsx`
- Product cell opens modal to pick product (10/page)
  - `frontend/src/components/ProductSelectModal.tsx`

### D) SQL Draft Preview Improvements
- SQL Draft modal default provider = Vanna
- Added pseudo-code output from SQL

Key files:
- `frontend/src/components/SqlDraftModal.tsx`
- `app/services/admin_config_service.py`

### E) DuckDB Disabled
- `DB_ENGINE=postgres`
- DuckDB health removed from `/health`
- Sync only in `hybrid`

Key file:
- `app/services/health_service.py`

### F) Table Classification Catalog
- Introduced `table_classifications` to persist the category per table (tenant scoped).
- Admin UI uses `/admin/data/table-classifications` (GET + PUT) to display/update the dropdown.

Key files/endpoints:
- `app/services/data_management_admin_service.py`
- `GET /admin/data/table-classifications`
- `PUT /admin/data/table-classifications/{table_name}`

---

## 6) Data Classification Documentation

Main doc: `database.html`
Static classification map: `app/data/data_classification.py`

Categories:
- Master data: products, customers, sellers, regions, currencies, product_costs, etc.
- Transactional data: quotes, quote_line_items, historical_transactions
- Configuration data: line_item_column_configs, field_logic_rules, pricing_rules, etc.
- Metadata: sync_state, audit_log
- Organization data: tenants, users, roles, permissions, etc.

If adding tables, update:
- `app/db/postgres_schema.sql`
- `app/db/schema.sql` (if ever re-enabled)
- `app/data/data_classification.py`
- `database.html`
- `table_classifications` should be kept up to date whenever categories change.

---

## 7) Schema Expectations

Postgres `quote_line_items`:
- has `customer_region_discount` NUMERIC

Postgres `regions`:
- has `discount_percent` NUMERIC

If schema missing, backend now attempts `ALTER TABLE` on startup of features.

---

## 8) How to Run / Restart

Backend:
```
sudo systemctl restart duraiprice-backend
```

Check health:
```
curl -sS http://127.0.0.1:9000/health
```

Frontend dev:
```
cd /home/waheed/DuraiPricingTool/frontend
npm run dev
```

---

## 9) Known Gotchas

- 502 errors often from backend failing due to schema mismatch.
- Customers table uses `region` (not `region_id`) in current schema.
- DuckDB should remain disabled. Do not re-enable unless asked.
- Frontend expects some fields in dynamic_fields; do not remove.

---

## 10) Handover Rules for Next Agent

When asked to handover:
1. Read this file first.
2. Check backend health.
3. Verify that `/readme.html` (index) and `/database.html` (classification) are accessible.
4. Every project document must be recorded in `readme.html` with the proper title; run `scripts/generate_doc_index.py` whenever a new doc is added so the index stays current without manual edits.
5. Whenever you discover a new protocol, rule, or instruction, update `Protocol.md` right away.
6. Any schema/table/database change must be reflected in `database.html` (re-run `scripts/generate_doc_index.py` after updating this file so the classification stays synced).
7. Review the latest git changes if needed.
8. Keep this Protocol.md updated after each significant change.

---

## 11) Files of Interest

 - Backend:
   - `app/services/quote_service.py`
   - `app/services/admin_config_service.py`
   - `app/services/health_service.py`
   - `app/db/postgres_schema.sql`
   - `app/db/schema.sql`

- Frontend:
   - `frontend/src/components/PricingTableWithTabs.tsx`
   - `frontend/src/components/CustomerSelectModal.tsx`
   - `frontend/src/components/ProductSelectModal.tsx`
   - `frontend/src/components/SqlDraftModal.tsx`

- Docs:
   - `readme.html` (index)
   - `database.html` (classification)
   - `app/data/data_classification.py`
   - `Protocol.md`

## 12) Documentation Discipline

Treat documentation updates as part of every change:
- Whenever you create or update a document, run `scripts/generate_doc_index.py` so `readme.html` reflects the new title and category, then copy that file into `frontend/public/readme.html` and `frontend/dist/readme.html` so the published SPA and static build stay in sync.
- Add any new or changed document to `readme.html` without waiting for manual intervention; the index is the single source of truth.
- When a database schema or table changes, update `database.html` (and the copies under `frontend/public` and `frontend/dist`) so the classification guidance stays accurate.
- Whenever you discover a new operational rule, workflow change, or instruction (like this document), update `Protocol.md` right away. The next agent expects Protocol to capture the latest norms before they start work.

## 13) Admin Table Sync

- When you need **every PostgreSQL table** inside the Data Management Admin catalog (including new or manually created tables), run `scripts/sync_admin_tables.py`.
- The script is safe to rerun; it only registers tables that are currently missing and re-applies classifications for every table in `table_classifications`.
- Always run it as the `postgres` user so it can access the UNIX socket and read the database schema:

```bash
cd /home/waheed/DuraiPricingTool
sudo -u postgres env DB_ENGINE=postgres DUCKDB_READ_ONLY=1 \
  ./.venv/bin/python3 scripts/sync_admin_tables.py
```

- The same command can be used during automation or cron jobs; just make sure the environment variables stay the same (they guarantee DuckDB stays dormant and PostgreSQL is the engine in use).
- The process is described in `Documentation/Guides/sync-admin-tables.md` (and its public/dist copies) so any future agent can follow the step-by-step instructions without guessing the flags.
