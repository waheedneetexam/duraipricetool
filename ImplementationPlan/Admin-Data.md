# Admin → Data: CSV Upload & Column Mapping

## Overview
Enhance the **Admin → Data** tab to support CSV-based bulk data import with intelligent column mapping tied to the currently selected table.

## Requirements (from Google Doc)
1. **Elevate DataManagement Admin** — bring it to the top of the Data tab.
2. **CSV Upload panel** — place it next to the DataManagement Admin panel.
3. **Context-aware Column Mapping** — when a table (e.g., Products) is selected, the CSV Upload panel automatically loads the relevant column mapping JSON so the user can upload a CSV and sync data directly into that table.

## Proposed Changes

### Backend

#### [NEW] `GET /admin/tables/{table_name}/columns`
- Returns the column definitions for the selected table.
- Used by the frontend to display a mapping preview and validate the uploaded CSV.

#### [NEW] `POST /admin/tables/{table_name}/upload-csv`
- Accepts a multipart CSV file upload.
- Validates CSV headers against the column mapping.
- Inserts/upserts the rows into the selected table, scoped to the current `tenant_id`.

### Frontend

#### [MODIFY] `DataManagementAdmin.tsx`
- Reorder the layout so `DataManagement` appears at the **top**.
- Add a new `CsvUpload` component next to it.
- When the user selects a table in `DataManagement`, pass the selected table name as a prop to `CsvUpload`.

#### [NEW] `CsvUpload.tsx`
- Fetches `GET /admin/tables/{table_name}/columns` on table selection.
- Displays column mapping as a preview before upload.
- File picker for `.csv` files.
- Upload button triggers `POST /admin/tables/{table_name}/upload-csv`.
- Shows success/error feedback after upload.

## Verification Plan
1. Navigate to **Admin → Data**.
2. Select "Products" from the table list.
3. Verify the CSV Upload panel shows the column mapping for the Products table.
4. Upload a sample CSV and verify rows appear in the Products table.
5. Check Audit Log for the upload action.
