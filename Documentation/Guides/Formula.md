# Implementation: Formula & Strategy Builder (Admin)

## Objective
Implement two Admin modules:
1. `Formula`
2. `Strategy`

Use **Google Blockly** as the visual block engine for all block editing and execution graph composition.

## Technology Decision
1. Block engine: `google-blockly`.
2. Serialization: Blockly JSON (`Blockly.serialization.workspaces.save/load`).
3. Custom blocks: defined for pricing domain (attributes, parameters, lookups, math, logic, output).
4. Validation: Blockly connection checks + custom domain validators.
5. Execution output: transform Blockly workspace to evaluable JSON/expression tree for test run and backend execution.

## Admin Navigation
1. Add `Formula & Strategy Builder` under Admin.
2. In builder screen provide module switch:
- `Formula`
- `Strategy`

## Module 1: Formula (Admin)

### Features
1. Formula Type management:
- `Add Type`
- `Import`
- `Duplicate`
- `Edit Types`

2. Active Type workflow:
- Active Type selector
- `Add Type` action
- Formula Type preview

3. Blockly canvas with category toolbox:
- Product Attributes
- Parameters
- Data Lookups
- Constants
- Math
- Logic
- Functions

4. Core sections:
- Formula
- Result
- Formula Detail
- Add variables toggle

5. Block operations:
- Add block from toolbox
- Connect compatible blocks
- Delete block
- Nested expressions
- Inline dropdowns/inputs in blocks

6. Data lookup blocks:
- `Take [aggregate] [field] from [lookup]`
- Lookup/table selector
- Return type metadata

7. Type safety:
- Enforce input/output types
- Reject invalid connections
- Show field-level and workspace-level errors

8. Formula status lifecycle:
- Draft
- Saved
- Valid
- Invalid

9. Activation flow:
- `Submit`
- `Activate` (only when valid)

10. Test run:
- Execute against sample payload
- Show computed result + validation/runtime errors

### Implementation Steps
1. Install Blockly in frontend.
2. Create `BlocklyFormulaCanvas` wrapper component.
3. Define custom Formula blocks and generators.
4. Map toolbox categories to custom blocks.
5. Implement workspace save/load (local + API).
6. Add formula validation pipeline:
- Blockly structural checks
- Domain checks (required result block, type checks, lookup config checks)
7. Implement test-run adapter to convert workspace -> executable payload.
8. Add status transitions (draft/saved/valid/invalid/active).

## Module 2: Strategy (Admin)

### Features
1. Strategy actions:
- New Strategy
- Save Strategy
- Test Run
- Import
- Export
- Duplicate
- Delete
- Activate

2. Template-based creation:
- Blank
- Cost Plus
- Competitive Match
- Approval Gate

3. Deployment controls:
- Scope (Local/Global)
- Target (tenant/region/BU)
- Priority
- Status (Draft/QA/Production)

4. Strategy logic authoring in Blockly:
- Reuse formula block base
- Add strategy-specific blocks (set line item, set quote header, approval flag, lookup compare)

5. Validation rules:
- No incompatible block connections
- No missing required outputs
- No invalid deployment promotion (e.g., production with validation errors)

6. Test run preview:
- Execute on sample line items
- Show target price/margin/approval outputs

### Implementation Steps
1. Build `BlocklyStrategyCanvas` using same Blockly core wrapper.
2. Add strategy-specific custom blocks and generators.
3. Implement strategy document schema:
- metadata
- deployment config
- workspace JSON
- test snapshot
4. Add import/export for strategy JSON.
5. Add duplicate/delete strategy flows.
6. Add activation gate with validation checks.

## Data Model (Minimum)

### FormulaDocument
1. `id`
2. `name`
3. `description`
4. `typeId`
5. `status` (`draft|saved|valid|invalid|active`)
6. `workspaceJson` (Blockly JSON)
7. `resultType`
8. `updatedAt`
9. `updatedBy`

### StrategyDocument
1. `id`
2. `name`
3. `description`
4. `templateKey`
5. `deployment`:
- `scope`
- `target`
- `priority`
- `status`
6. `workspaceJson` (Blockly JSON)
7. `validation`
8. `updatedAt`
9. `updatedBy`

## API Requirements
1. Formula APIs:
- create/update/get/list
- import/export
- validate
- submit/activate

2. Strategy APIs:
- create/update/get/list
- import/export
- duplicate/delete
- validate
- test-run
- activate

## Acceptance Criteria
1. User can build formula and strategy logic fully via Blockly blocks.
2. Invalid block connections are prevented.
3. Formula/Strategy can be saved and reloaded without layout loss.
4. Import/export reproduces equivalent workspace.
5. Test run returns deterministic outputs for provided sample inputs.
6. Activate is blocked when validation fails.
7. Admin can manage types, strategies, and deployment settings end-to-end.

## Notes
1. Keep existing Admin visual style, but replace custom ad-hoc block UI with Blockly workspace.
2. Persist Blockly JSON as source of truth; optional derived AST can be generated for engine execution.
3. Start with local persistence fallback; wire backend persistence behind API client once endpoints are ready.
