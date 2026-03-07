# Sync Database Tables into Data Management Admin

This script ensures every physical table in the `duraipricing` PostgreSQL database is visible in the **Data Management Admin** UI, and that each table receives a default classification.

## What it does

1. Reads `information_schema.tables` and builds a schema description for every table that is **not already registered** in `dynamic_table_definitions`.
2. Persists the schema as JSON so the admin UI can browse, edit, and CRUD the table.
3. Seeds `table_classifications` with the five controlled buckets (master, transactional, configuration, metadata, organization), defaulting unknown tables to `transactional_data`.

## When to run

Use the script whenever:

- You add/drop tables outside the UI (e.g., manual SQL migrations).
- You onboard a new tenant schema and want the admin catalog to reflect it immediately.
- You need to rebuild the catalog after resetting `dynamic_table_definitions`.

## How to run

```bash
cd /home/waheed/DuraiPricingTool
sudo -u postgres env DB_ENGINE=postgres DUCKDB_READ_ONLY=1 \
  ./.venv/bin/python3 scripts/sync_admin_tables.py
```

- `DB_ENGINE=postgres` forces the data management service to use PostgreSQL, preventing DuckDB initialization.
- `DUCKDB_READ_ONLY=1` skips the DuckDB connection entirely (the script does not touch DuckDB data).
- Running as the `postgres` user is required because the script queries the database over the UNIX socket.

## What to expect

- The script prints each table that it registers, followed by a summary of how many schemas and classifications were synced.
- Existing dynamic tables are left untouched (the script only registers tables that are missing from the admin catalog).
- Classification entries will be created or updated every time you run the script, so you can rerun it safely.
