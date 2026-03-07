---
title: DuckDB to MySQL Migration Plan (Postgres for Audit/Change Logs)
category: Specifications
description: Analysis and migration plan to move transactional data from DuckDB to MySQL while keeping audit/change logs in Postgres, including tradeoffs.
created: 2026-03-07
---

# DuckDB to MySQL Migration Plan (Postgres for Audit/Change Logs)

## Summary
You want to migrate the current transactional data store from DuckDB to MySQL, while keeping audit trail and change log data in PostgreSQL. This document analyzes the current architecture, proposes a target design, outlines migration steps, and lists advantages and disadvantages of MySQL compared to DuckDB for your use case.

## Current State (Observed)
- The backend supports **DuckDB**, **Postgres**, and **hybrid** modes via `DB_ENGINE`.
- DuckDB is used for fast local analytics and single-file storage.
- Postgres is already used for multi-tenant records, admin configs, and audit-related data.
- The system uses the **same API service** to access both databases depending on mode.

## Target State (Requested)
- **Transactional data** (quotes, quote line items, pricing tables, master data, etc.) in **MySQL**.
- **Audit trail and change logs** in **Postgres** (retain existing audit schema and permissions).
- The application should transparently route operations to the correct database.

## Proposed Data Ownership Split
**MySQL (Transactional / Operational)**
- `quotes`
- `quote_line_items`
- master data tables (`products`, `customers`, `sellers`, etc.)
- pricing configuration tables (`pricing_rules`, `discount_tiers`, etc.)
- workflow tables, line-item config, field logic rules (optional: consider if these are operational vs audit)

**Postgres (Audit / Compliance / Change Log)**
- `audit_logs` (existing)
- `change_logs` (if present or to be added)
- optional: `sync_state` if used for compliance tracking

## Architecture Changes Needed
1. **Add MySQL Client**
   - Introduce a `mysql_client.py` similar to `duckdb_client.py` and `postgres_client.py`.
   - Use a DSN or connection params in config (`MYSQL_DSN`).

2. **Routing Layer**
   - Create a database router that directs reads/writes based on table type:
     - transaction tables → MySQL
     - audit/change logs → Postgres

3. **Schema Migration**
   - Generate a MySQL schema equivalent to current DuckDB tables.
   - Use data types compatible with MySQL (e.g., `DOUBLE` vs `DOUBLE PRECISION`, `JSON`, `TEXT`).

4. **Data Migration**
   - Extract DuckDB data to CSV or via SQL export.
   - Import into MySQL using bulk loaders.
   - Validate record counts and sampling.

5. **Config Updates**
   - Add `MYSQL_DSN` to environment.
   - Replace `DB_ENGINE` logic with a routing-based mode (e.g., `DB_ENGINE=split`).

6. **Operations**
   - Add backup/restore for MySQL.
   - Monitoring: transaction throughput and error logging.

## Migration Steps (High-Level)
1. **Prepare MySQL**
   - Stand up MySQL instance.
   - Apply schema.
2. **Export from DuckDB**
   - Export each operational table to CSV.
3. **Import to MySQL**
   - Load CSV data into MySQL.
4. **Dual-Write Phase (Optional)**
   - Temporarily write to both DuckDB + MySQL for validation.
5. **Cutover**
   - Switch app reads/writes to MySQL for transactional tables.
6. **Post-Migration Validation**
   - Compare row counts, spot-check data integrity.

## Advantages of MySQL over DuckDB
- **Multi-user concurrency**: MySQL is built for multiple concurrent writers and readers.
- **Operational durability**: Strong transactional guarantees (ACID) with logs and replication.
- **Scalability**: Works with replicas, clustering, and managed DB services.
- **Ecosystem**: Broad tooling for backups, monitoring, auditing, and ETL.
- **Separation of concerns**: Cleanly isolates transactional workloads from audit/compliance in Postgres.

## Disadvantages of MySQL over DuckDB
- **Higher operational overhead**: Requires a running server, backups, monitoring, and tuning.
- **Performance tradeoff for analytics**: DuckDB is often faster for local analytical queries on large datasets.
- **Deployment complexity**: MySQL adds infra and DevOps overhead.
- **Cost**: Managed MySQL services add operational cost vs a local DuckDB file.

## Risks
- Schema mismatches between DuckDB and MySQL types (especially JSON, timestamps).
- Application-level assumptions about DuckDB-specific SQL.
- Migration downtime without dual-write or read replicas.

## Recommendation
Proceed with MySQL for transactional workloads and Postgres for audit/change logs if:
- You expect sustained concurrent usage and operational scale.
- You require stronger production-grade durability and replication.

If the system is still early-stage or primarily analytical, DuckDB can remain useful for local analytics but should not be the main transactional database in production.

