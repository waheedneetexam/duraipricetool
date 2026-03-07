# Plan: Real-Time Line Item Formula Evaluation in Quotes

## 1. Data Model Alignment
1. Ensure each line-item field that is calculated has a `field_key` matching the formula rule `field_key`.
2. Store active formula rules per tenant and scope (`line_item`) in `field_logic_rules` with a single active rule per `field_key`.
3. Expose line-item configuration (including which fields are calculated) via `/admin/line-item-config` and persist in config tables.

## 2. API Contracts
1. Extend `GET /admin/field-logic/list` to support filtering by `scope` and return the latest active rule per `field_key`.
2. Add a runtime endpoint for quotes: `POST /quotes/evaluate-line-item` that accepts a line item object and returns calculated fields.
3. Optionally add a bulk endpoint `POST /quotes/evaluate-line-items` for multiple line items in one request.

## 3. Runtime Formula Engine
1. Build a deterministic evaluator that runs server-side (Python) for generated code with a safe expression evaluator.
2. Cache compiled formulas per tenant in memory keyed by `tenant_id + field_key + rule_version`.
3. Resolve dependencies: if a formula references other calculated fields, compute them in a dependency-ordered pass.

## 4. Quote Creation Flow (Real-Time)
1. Frontend captures user edits to line items in the quote builder.
2. On change, debounce and call `POST /quotes/evaluate-line-item(s)` with the full line item context.
3. Server evaluates formulas using the active rules for that tenant and scope and returns computed fields.
4. Frontend updates the row with the computed values and highlights calculated fields.

## 5. Validation and Error Handling
1. If formula evaluation fails, return a structured error and keep user-entered values unchanged.
2. Show a per-field error tooltip in the UI with the formula error message.
3. Log evaluation errors with rule id and tenant id for diagnostics.

## 6. Performance & Caching
1. Cache active rule lists per tenant for a short TTL (e.g., 30–60 seconds).
2. Cache compiled formula AST/bytecode in process memory.
3. Add a cache-bust path when admin saves a rule (invalidate tenant cache).

## 7. Consistency Guarantees
1. Use rule version at evaluation time and return `rule_version` with results for traceability.
2. On quote save, store the evaluated values and the rule versions used.

## 8. Rollout Steps
1. Implement evaluation endpoint(s) and integrate into quote builder with a feature flag.
2. Run with server-side evaluation only; optionally add client-side preview later.
3. Remove flag after validation in staging.
