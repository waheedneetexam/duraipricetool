# First Week Plan - Selenium Automation Foundation

## Goal
Set up a stable Selenium automation baseline for the DuraiPricingTool web app and prepare regional pharma test data for quote processing scenarios.

## Scope
- Create automation project structure for UI regression and workflow validation.
- Validate access and navigation across key screens.
- Build reusable login and navigation utilities.
- Prepare data assumptions for multi-region plants and clients.

## Selenium Workstream
1. Initialize framework:
- Python + Selenium + pytest + page object model.
- Config for environments (`prod`, `staging`) and credentials.
- Browser setup for Chrome headless/headed.

2. Build base components:
- `BasePage` (waits, click, type, retry wrappers).
- `LoginPage` (if auth exists) and session bootstrap.
- `HomePage` navigation helpers.
- Screenshot and HTML dump on failures.

3. Validate critical navigation paths:
- Open `https://duraiprice.swapunits.online`.
- Navigate to `Admin`.
- Navigate to quote-related screens (`Quote`, `Line Item`, `Analytics` where available).
- Confirm each screen has expected anchor element.

4. Add smoke tests:
- App availability test.
- Admin screen load test.
- Master Data screen load test.
- Quotes screen load test.

## Business Rules Planning (to automate later)
- Region mandatory in quote header.
- Plant source required for pharma line items.
- Country/channel must be valid for controlled products.
- Currency/FX date field must exist for regional processing.

## Deliverables
- Selenium framework skeleton.
- Smoke navigation test suite.
- Selector inventory for Admin and Quote screens.
- Test data matrix draft for regions: NA, EU, APAC, LATAM.

## Exit Criteria
- Tests run reliably in CI/local with >=95% pass rate for smoke set.
- All key pages open and selectors are stable for future workflow automation.
