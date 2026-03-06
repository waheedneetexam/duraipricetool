# Third Week Plan - Quote Processing and Workflow Automation

## Goal
Automate quote-processing journeys for different regional clients, including approvals and exception routing.

## Scope
- Create regional quote scenarios.
- Validate pricing workflow transitions.
- Validate policy and compliance guardrail behavior.

## Selenium Workstream
1. Quote creation flow automation:
- Navigate to Quote screen.
- Create quote header for each region (NA/EU/APAC/LATAM).
- Add line items with pharma attributes (plant, shelf-life, cold-chain).
- Save and reopen quote to verify persistence.

2. Workflow transition automation:
- Submit Draft to Pending Approval.
- Validate route by discount/margin thresholds.
- Validate role-based next-step indicators (Sales Manager, Regional Head, Finance, QA/Regulatory).

3. Regional scenario pack:
- NA commercial quote (standard approval).
- EU hospital quote (stricter margin and compliance checks).
- APAC distributor quote (FX sensitivity).
- LATAM tender quote (floor-price exception path).

4. Negative-path automation:
- Missing controlled-substance eligibility -> block submission.
- Shelf-life below threshold -> warning/error path.
- Margin below floor -> escalation required.

## Business Rules Planning (to automate later)
- Net price sequence: list -> discounts/tender -> surcharge -> net.
- Margin gates by region/channel.
- Compliance hard stops for restricted products/channels.
- Intercompany/plant transfer floor review triggers.

## Deliverables
- Quote page object coverage.
- Regional quote test suite.
- Workflow transition matrix with expected approvers.
- Defect log template mapped to business rules.

## Exit Criteria
- Regional quote flows run end-to-end with deterministic assertions.
- Blockers/warnings/escalations are correctly detected by automation.
