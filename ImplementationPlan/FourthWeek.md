# Fourth Week Plan - Pilot Hardening, Reporting, and Operationalization

## Goal
Harden Selenium coverage for pilot readiness and produce operational reporting for rollout decisions.

## Scope
- Stabilize flaky tests.
- Add analytics and regression checkpoints.
- Prepare execution packs for business and IT sign-off.

## Selenium Workstream
1. Suite hardening:
- Add explicit wait strategy refinement.
- Add retry strategy for transient UI/network delays.
- Tag tests by priority (`smoke`, `admin`, `quote`, `workflow`, `compliance`).

2. Regression pack:
- Daily smoke on production URL.
- Full nightly quote-processing suite across regions.
- Weekly end-to-end compliance suite.

3. Analytics checkpoints automation:
- Navigate to analytics screens.
- Validate visibility of key charts and filters.
- Validate drilldown access for quote-related slices.

4. Reporting and evidence:
- Export junit/html reports.
- Capture screenshots for each failed assertion.
- Publish weekly summary:
  - pass/fail trend
  - defects by rule category
  - high-risk flows

## Business Rules Governance Plan
- Maintain rule catalog mapped to automated test IDs.
- Maintain approval threshold change log by region.
- Introduce release gate: no production release when critical quote-compliance tests fail.

## Deliverables
- Pilot-ready Selenium suite and execution guide.
- Weekly dashboard/report template for stakeholders.
- Go-live checklist covering Admin setup, quote processing, and compliance controls.

## Exit Criteria
- Stable pilot suite with low flakiness.
- Clear defect/risk visibility for leadership decision.
- Approved readiness to move from pilot to wider rollout.
