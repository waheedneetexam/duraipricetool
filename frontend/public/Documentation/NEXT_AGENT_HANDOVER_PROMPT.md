# Next Agent Handover Prompt: Formula Builder Save/Load Issue

## Context
Project: `DuraiPriceTool`  
Area: Formula Builder Admin (`frontend/src/components/FormulaBuilderAdmin.tsx`) + Field Logic APIs (`app/services/admin_config_service.py`, `app/api/routes_admin.py`)

## Core Problem To Solve
Even after recent mapping and selection fixes, the user still reports that save/load behavior is not reliably fixed in Formula Builder Admin.

Observed symptom:
- Clicking an existing rule from the sidebar may not consistently show correct `logic_text` and `generated_code`.
- After save, reload/selection behavior may still feel inconsistent from the user perspective.

## What Was Already Changed
1. API list response normalization in backend:
- Added both snake_case + camelCase fields (`id`/`logicId`, `field_key`/`fieldKey`, `natural_language_logic`/`logicText`, `generated_code`/`generatedCode`, `dependencies_json`/`dependencies`).
- Improved ID extraction from row aliases.

2. Frontend mapping + selection logic:
- `loadRules()` now reads both snake_case and camelCase.
- Filters invalid mapped items missing `id` or `field_key`.
- Uses stable `setActiveRuleId(prev => ...)` fallback logic:
  - prefer `selectFieldKey`
  - else keep previous if present
  - else first item
  - else `null`

## Why This May Still Be Failing
Potential remaining root causes to verify:
1. Duplicate `field_key` versions causing ambiguous post-save selection (selecting by `field_key` only may pick wrong record).
2. Data contract inconsistency in other endpoints or middleware transforming keys.
3. UI state race between draft rule creation/edit and server refresh.
4. Auth/tenant context returning different rule sets than expected.
5. `active`/version semantics in DB causing list ordering or chosen row mismatch.

## Required Next-Agent Actions
1. Reproduce with real backend data and exact user flow:
- open Formula Builder
- click existing rule A/B
- verify workspace values
- edit + save
- verify selected rule after reload and values

2. Add temporary debug logs:
- API `/admin/field-logic/list` payload on server
- `mapped` + chosen `activeRuleId` + `activeRule` on frontend

3. Validate DB rows directly:
- check `field_logic_rules` for same `field_key` multiple versions
- verify only one `active=TRUE` per `(tenant_id, scope, field_key)`

4. If ambiguity confirmed:
- switch post-save selection from `field_key` to saved `logicId` (strong ID-based reconciliation).

5. Add regression guard:
- minimal test or deterministic check covering:
  - list mapping contract
  - active rule reconciliation after save + reload

## Acceptance Criteria
1. Clicking any sidebar rule always loads correct `logic_text` and `generated_code`.
2. Saving a rule keeps user focused on the exact saved rule record.
3. Refreshing list does not clear or mismatch the active workspace unexpectedly.
4. Behavior is stable across at least 3 consecutive save/select cycles.

