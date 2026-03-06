# Validation Documentation

## Objective
Implement the new Admin capabilities using the provided specifications so that:
- Table Manager uses the target design language consistently.
- Line Item Configurator behavior matches `LineItemConfiguration.md`.
- AI Pricing Engine flow matches `AIPricingEngineConfiguration.md`.
- Field logic validation and error handling align with the guides.
- Database changes are applied first to support safe feature rollout.

## Implementation Order

### 1. Baseline and Gap Validation
- Review current Admin UI (`frontend/src/components/AdminScreen.tsx`) and existing line-item config flow.
- Map current API and schema coverage against:
  - `LineItemConfiguration.md`
  - `AIPricingEngineConfiguration.md`
  - `FIELD_LOGIC_GUIDE.md`
  - `PRICING_ENGINE_GUIDE.md`
  - `ERROR_RESOLUTION.md`
- Produce a gap checklist (implemented / missing / partial).

### 2. Database and Schema Changes (First)
- Add/extend tables for configurable field logic and AI engine persistence (Postgres + DuckDB parity).
- Ensure existing `line_item_column_configs` supports required attributes (validation, options, descriptions, ordering fidelity).
- Add structures for:
  - field-level logic definitions and versions
  - validation results/errors
  - AI-generated config artifacts and status
- Add indexes for tenant lookup, field lookup, and update-time queries.
- Keep migration scripts idempotent (`CREATE TABLE IF NOT EXISTS`, safe ALTER path).

### 3. Backend API Layer
- Extend admin routes with endpoints for:
  - full line-item field CRUD + reorder
  - field logic validate/generate/save lifecycle
  - AI pricing template validate/process/apply lifecycle
- Add strong request/response models in `app/models/schemas.py`.
- Add service layer functions with DB-engine-aware persistence (`postgres` / `duckdb` / `hybrid`).
- Enforce server-side validation for:
  - unique field names
  - valid identifiers
  - formula reference checks
  - required table/column dependency checks

### 4. Admin UI Implementation
- Refactor Admin into tabbed modules:
  - Data Management (existing)
  - Line Item Configurator
  - Field Logic Manager
  - AI Pricing Engine
- Reuse existing project design tokens/components so Table Manager design is consistent.
- Build:
  - add/edit/delete/reorder field UI
  - formula builder/editors with validation status
  - AI YAML template editor with processing/results panels
  - dependency/error panels with actionable suggestions

### 5. Validation and Error Handling
- Implement validation pipeline with typed severities (`error`, `warning`, `info`).
- Add clear user-facing error messages + fix suggestions per docs.
- Keep non-blocking warnings and block on hard validation errors.
- Preserve robust UI error boundaries and console filtering behavior already documented.

### 6. Integration with Runtime Pricing Table
- Ensure configured columns/logic are reflected immediately in quote line-item interface.
- Maintain backward compatibility for tenants with existing configs.
- Add safe fallback to defaults when config is missing or invalid.

### 7. Testing and Verification
- Backend:
  - unit tests for config validation and persistence paths
  - API tests for CRUD/validate/process endpoints
- Frontend:
  - component-level behavior checks for add/edit/reorder/validation flows
- Manual verification:
  - tenant isolation
  - formula execution order
  - AI config apply path
  - error recovery scenarios from docs

### 8. Rollout Strategy
- Deploy schema changes first.
- Enable new endpoints and UI behind safe defaults.
- Run seed/smoke validation on sample data.
- Monitor logs for validation failures and migration drift.

## Deliverables
- Updated DB schemas (`app/db/postgres_schema.sql`, `app/db/schema.sql`) and migration-safe service guards.
- Updated admin APIs and schemas.
- New/updated frontend Admin modules for configurator, logic manager, and AI engine.
- Validation + error resolution paths aligned to provided documentation.
- Test coverage for critical flows.

## Acceptance Criteria
- Admin users can configure, reorder, and validate line-item fields end-to-end.
- Field logic can be validated, corrected, and saved permanently with versionability.
- AI template can be processed and applied into executable configuration.
- Table Manager renders with the intended design and respects new config at runtime.
- No regression in existing data import/sync/formula flows.
