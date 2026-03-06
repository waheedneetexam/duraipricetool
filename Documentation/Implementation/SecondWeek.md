# Second Week Plan - Admin Configuration Automation

## Goal
Automate Admin workflows needed to configure quote-processing foundations for a multi-region pharma client.

## Scope
- Automate master data setup actions in Admin.
- Automate line-item/header configuration checks.
- Automate field logic validation flow (without complex rule coding yet).

## Selenium Workstream
1. Admin navigation automation:
- Open app and go to `Admin`.
- Navigate tabs: `Master Data`, `Line Item Config`, `Field Logic`, `Data Management`.

2. Master data automation plan:
- Create/read/update/delete validations for core entities:
  - Products
  - Customers
  - Sellers
- Validate required attributes:
  - Product: cold-chain flag, controlled-substance flag.
  - Customer: region, country, channel, segment.

3. Line item config automation plan:
- Validate presence of mandatory columns for pharma quoting:
  - `plant_source`, `shelf_life_months`, `cold_chain_cost`, `regulatory_fee`.
- Validate visible/mandatory/editable settings and save behavior.

4. Field logic flow automation plan:
- Navigate to Field Logic Manager.
- Input sample logic text.
- Trigger validate action.
- Assert success/warning/error response containers.

## Business Rules Planning (to automate later)
- Enforce mandatory plant and region dimensions.
- Enforce controlled-substance eligibility checks by customer/country.
- Enforce shelf-life fields for temperature-sensitive products.

## Deliverables
- Admin page objects and locators.
- Admin smoke + CRUD/checkpoint test cases.
- Validation checklist for pharma-specific configuration fields.

## Exit Criteria
- Admin flows can be executed end-to-end by automation without manual intervention.
- Mandatory configuration fields are verified and recorded in test reports.
