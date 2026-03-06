# Table Manager Screen Implementation Plan

## Scope
Implement only the `Admin -> Table Manager` screen in the existing React + FastAPI app, without changing other modules.

## Skill Use
Using `figma` skill for design-to-code workflow.  
Required design input to start implementation: exact Figma frame URL (or `fileKey + nodeId`) for `Enterprise Pricing System -> Admin -> Table Manager`.

## Assumptions
1. Table Manager is a UI for managing master tables (Products, Customers, Sellers) and their rows.
2. Existing backend `/master/*` CRUD APIs remain the source of truth.
3. Screen is added under existing Admin view and follows current app style tokens in `frontend/src/styles/app.css`.

## Deliverables
1. New screen component focused on Table Manager only.
2. Admin navigation update to expose Table Manager.
3. API client typing cleanup for table records used by this screen.
4. Loading, empty, save, error, and delete-confirm UX states.
5. Basic test coverage for screen behavior and API interaction boundaries.

## Implementation Steps

### Phase 1: Figma Extraction and Mapping
1. Fetch design context from Figma MCP:
   - `get_design_context` for target node.
   - `get_screenshot` for visual parity.
   - `get_metadata` only if node tree is too large.
2. Extract exact UI contract:
   - Header/title/subtitle.
   - Table tabs or selector behavior.
   - Grid columns per entity.
   - Search/filter/sort/pagination controls (if present).
   - Row actions and form/drawer/modal interactions.
3. Map design controls to existing data model:
   - Products -> `/master/products`
   - Customers -> `/master/customers`
   - Sellers -> `/master/sellers`

### Phase 2: Frontend Structure
1. Create `frontend/src/components/TableManagerScreen.tsx`.
2. Split reusable internal blocks if needed:
   - `TableManagerTabs`
   - `TableManagerGrid`
   - `TableManagerForm`
3. Add Admin tab switch entry in `frontend/src/components/AdminScreen.tsx` (or replace current master-data section if design requires one screen only).
4. Keep component state local with `useState/useEffect/useMemo`; avoid introducing new state libraries.

### Phase 3: Data + Interaction Layer
1. Use existing `apiFetch` with typed responses for list/create/update/delete per selected entity.
2. Normalize form handling:
   - Create mode vs edit mode.
   - Boolean, number, text field handling.
   - Reset/clear behavior.
3. Add robust UX states:
   - Initial loading.
   - Inline API error messages.
   - Disabled actions during save/delete.
   - Empty table state.
4. Preserve optimistic clarity (refresh after mutation for correctness-first behavior).

### Phase 4: Styling and Figma Parity
1. Reuse existing CSS variables (`--surface`, `--line`, `--muted`, etc.).
2. Add targeted classes in `frontend/src/styles/app.css` for:
   - Table Manager layout shell.
   - Toolbar controls.
   - Data grid density and row actions.
   - Form panel/modal.
3. Match spacing/typography/borders from Figma screenshot as close as possible without breaking existing app patterns.

### Phase 5: Validation and Regression Checks
1. Functional checks:
   - Switch entity.
   - Create/edit/delete rows.
   - Error handling on failed API calls.
2. Visual checks:
   - Compare implemented screen with Figma screenshot.
   - Desktop + tablet-width behavior.
3. Regression checks:
   - Admin Formula screen still works.
   - Existing Data Management features remain unaffected.

## File-Level Change Plan
1. `frontend/src/components/AdminScreen.tsx`
   - Add/select `tableManager` tab and mount new screen.
2. `frontend/src/components/TableManagerScreen.tsx` (new)
   - Core UI + entity-based CRUD behavior.
3. `frontend/src/api/types.ts`
   - Add/expand strongly typed table row models as needed.
4. `frontend/src/styles/app.css`
   - Add Table Manager-specific classes.
5. Optional tests:
   - `frontend/src/components/__tests__/TableManagerScreen.test.tsx`

## Acceptance Criteria
1. Table Manager screen is reachable from Admin and isolated to its own UI surface.
2. Products/Customers/Sellers can be listed, created, updated, and deleted from this screen.
3. All main states (loading, empty, error, saving) are handled visibly.
4. Final UI matches Figma layout/spacing/controls for the target node with no major visual drift.
5. No regressions in other Admin tabs.

## Risks and Mitigations
1. Risk: Figma node ambiguity (wrong variant/state selected).  
   Mitigation: lock implementation to a single provided node URL and screenshot before coding.
2. Risk: UX mismatch vs existing backend payload shapes.  
   Mitigation: strict field mapping per entity and type guards.
3. Risk: scope creep into unrelated Admin modules.  
   Mitigation: keep all changes confined to Table Manager tab and shared style additions only.

## Execution Order
1. Confirm Figma target node URL.
2. Implement `TableManagerScreen.tsx`.
3. Wire Admin tab.
4. Apply styling.
5. Validate behavior and parity.
6. Run tests/build and finalize.

