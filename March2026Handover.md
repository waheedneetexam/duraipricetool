# March 2026 Handover — DuraiPricingTool

****Summary**
- **Data Management Admin** now follows the referenced “stepper” design: a breadcrumbed hero, a three-card workflow (Classification, Import & Validate, Validation/Mapping), and a modal-driven table view (“View Data”). Upload state, chip badges, and action buttons align with `Documentation/design*.md`.
- **Import & Validate** card now hosts the `CsvUpload` component, shows the uploaded filename, and offers inline rule/mapping controls; validation/mapping sections are collapsible and include the “Validate and Prepare Import” + “Clear Form” buttons.
- **Table grid behavior** is modal-only (opened via “View Data”) while the main canvas stays focused on the described workflow.

- **Backend housekeeping**: classification table sync script (`scripts/sync_admin_tables.py`), tenant-aware query guard, `customers.region_id` fix, and documentation updates (`database.html`, `Protocol.md`, doc index). All new docs are copied into `frontend/public` and `frontend/dist`.

- **Docs & protocol discipline**: Added the sync instructions to `Documentation/Guides/sync-admin-tables.md`, enforced readme/database doc updates after every change, and refreshed the generated `readme.html`.

**Next steps for the next agent**
1. Review this handover file alongside `Protocol.md` before starting work.
2. When adding UI/UX changes, re-run `npm run build` so `frontend/dist` matches the source.
3. For any new docs or schema changes, run `scripts/generate_doc_index.py` and copy the updated `readme.html`, `database.html`, and `Protocol.md` into `frontend/public`/`frontend/dist`.
4. If tables are added externally, re-run `sudo -u postgres env DB_ENGINE=postgres DUCKDB_READ_ONLY=1 ./.venv/bin/python3 scripts/sync_admin_tables.py` to keep the admin catalog complete.

