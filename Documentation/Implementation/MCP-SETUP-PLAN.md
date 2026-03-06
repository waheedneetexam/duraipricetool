---
title: MCP Layer Setup — Phase 1 AI Context
category: Implementation
description: Configuration of Model Context Protocol servers for PostgreSQL schema access and filesystem read access to enable AI-driven pricing logic.
created: 2026-03-06
---

# MCP Layer Setup — Phase 1: Establish AI Context

## Objective

Configure Model Context Protocol (MCP) servers to give the AI coding assistant read-only access to the DuraiPriceTool's PostgreSQL database schema and project source files. This is the foundation for later phases that will transition the price rule engine to an AI-driven pricing logic generator.

## Tech Stack Summary

| Layer | Technology | Details |
|-------|-----------|---------|
| Backend | FastAPI 0.116.1 | 8 routers: admin, analytics, auth, audit, chatbot, master_data, platform, quotes |
| Primary DB | PostgreSQL (psycopg3) | `postgresql://postgres:postgres@127.0.0.1:5432/duraipricing` |
| Analytics DB | DuckDB 1.3.2 | Local file: `data/durai_pricing.duckdb` (read-only) |
| DB Mode | Hybrid | PostgreSQL = system of record, DuckDB = analytical calculations |
| Models | Pydantic 2.11 | 20+ request/response schemas in `app/models/schemas.py` |
| Frontend | React + TypeScript | Vite-based SPA in `frontend/` |
| Runtime | Node v20.19.6 / npm 10.8.2 | Used for MCP server execution via npx |

## MCP Configuration

Config file: `.gemini/settings.json` (project root)

### 1. PostgreSQL MCP Server

- **Package**: `@modelcontextprotocol/server-postgres`  
- **Connection**: `postgresql://postgres:postgres@127.0.0.1:5432/duraipricing`
- **Capabilities**: Read-only schema introspection and SELECT queries
- **Constraint**: No data mutation — only metadata and analytical queries

### 2. Filesystem MCP Server

- **Package**: `@modelcontextprotocol/server-filesystem`
- **Paths Exposed**:
  - `/home/waheed/Work/Anti-Gravity/DuraiPriceTool/app` — FastAPI backend
  - `/home/waheed/Work/Anti-Gravity/DuraiPriceTool/frontend` — React frontend
- **Capabilities**: Full read access to source code, models, and components

## Database Schema Summary (28 Tables)

### Pricing & Quoting (Core Business)
| Table | Primary Key | Purpose |
|-------|------------|---------|
| `quotes` | `quote_id` | Quote headers with customer info, totals, status |
| `quote_line_items` | `quote_line_id` | Individual line items per quote with dynamic fields (JSONB) |
| `historical_transactions` | `id` | Transaction history for analytics |
| `formula_definitions` | `formula_id` | Calculated field expressions |
| `workflow_rules` | `rule_id` | Approval workflow with state transitions |
| `pricing_rules` | `id` | Discount/multiplier rules by customer type and product category |
| `discount_tiers` | `id` | Quantity-based discount brackets |

### Master Data
| Table | Primary Key | Purpose |
|-------|------------|---------|
| `products` | `product_id` | Product catalog with SKU, price, cost |
| `customers` | `customer_id` | Customer master with segment, region, credit limit |
| `sellers` | `seller_id` | Sales rep master data |
| `product_extensions` | `extension_id` | Custom product attributes (key-value) |
| `customer_extensions` | `extension_id` | Custom customer attributes (key-value) |
| `seller_extensions` | `extension_id` | Custom seller attributes (key-value) |
| `product_references` | `reference_id` | Cross-references for products |
| `product_hierarchies` | `id` | Hierarchical product categories |
| `product_costs` | `id` | Region-specific product costs with effective dates |

### Organization & Geography
| Table | Primary Key | Purpose |
|-------|------------|---------|
| `sales_orgs` | `id` | Sales organization units |
| `regions` | `id` | Geographic regions with currency/timezone |
| `currencies` | `code` | Currency definitions with exchange rates |

### AI & Configuration
| Table | Primary Key | Purpose |
|-------|------------|---------|
| `line_item_column_configs` | `(tenant_id, column_key)` | Dynamic column configuration per tenant |
| `field_logic_rules` | `logic_id` | AI-generated field logic (natural language → code) |
| `field_logic_validation_runs` | `validation_id` | Validation results for field logic |
| `ai_pricing_configurations` | `config_id` | AI pricing template processing results |

### Auth & Multi-Tenancy
| Table | Primary Key | Purpose |
|-------|------------|---------|
| `tenants` | `tenant_id` | Tenant registry |
| `app_users` | `user_id` | User accounts |
| `roles` | `role_id` | Role definitions |
| `permissions` | `permission_id` | Granular permission keys |
| `role_permissions` | `id` | Role ↔ Permission mapping |
| `user_tenant_roles` | `id` | User ↔ Tenant ↔ Role assignments |
| `refresh_tokens` | `token_id` | JWT refresh token storage |

### System
| Table | Primary Key | Purpose |
|-------|------------|---------|
| `sync_state` | `sync_name` | DuckDB sync cursor tracking |
| `audit_log` | `log_id` | Action audit trail with JSONB detail |

## Data Flow

```
CSV Upload → FastAPI → PostgreSQL (system of record)
                 ↓
          sync_state cursor
                 ↓
            DuckDB (analytics engine, read-only)
                 ↓
          Embedded analytics in quote response
```

## Verification Status

- [x] `.gemini/settings.json` created
- [ ] Restart Gemini CLI session to initialize MCP servers
- [ ] Run `list_resources` on `postgres` server
- [ ] Run schema query via `postgres` MCP
- [ ] Run `list_resources` on `filesystem` server
