---
title: MySQL Migration Environment and Branch Strategy
category: Guides
description: Recommendation for development and production environments plus branching strategy for MySQL migration.
created: 2026-03-07
---

# MySQL Migration Environment and Branch Strategy

## Recommendation (Short Answer)
Use **two environments** (Development and Production) and **two branches**. Keep the current version as the baseline for both environments, perform the MySQL migration in Development first, and promote to Production only after verification. This is the safer and more controllable approach than developing directly on the current environment.

## Why Two Environments Are Better
- **Risk isolation**: Database migrations are high‑risk. Development catches schema/data issues before they impact production users.
- **Repeatability**: A dedicated Development environment lets you rerun migrations and test rollback paths.
- **Verification**: You can run side‑by‑side validation (API behavior, reports, pricing outputs) before promotion.
- **Auditability**: Clear checkpoints (baseline → dev migration → prod promotion) make changes easier to review and approve.

## Proposed Structure

### Environments
- **Development**: Run MySQL migration here first. Use realistic data copies or masked snapshots.
- **Production**: Stays on the baseline version until Development is fully validated.

### Branches
- **`main` (Production)**: Matches Production environment and only receives validated changes.
- **`develop` (Migration)**: All MySQL migration work happens here until approved for production.

If you already use different naming, keep the same concept: one branch strictly for production stability, another for migration work.

## Baseline and Migration Flow
1. **Clone current version** into two branches: `main` and `develop`.
2. **Deploy `main`** to Production as the baseline.
3. **Deploy `develop`** to Development and run MySQL migration steps.
4. **Validate** in Development:
   - Schema integrity
   - Data accuracy (row counts, totals, critical reports)
   - API behavior and pricing calculations
   - Performance checks on key queries
5. **Promote**: Merge `develop` into `main`, then deploy to Production.

## Why Not Develop “As Is” (Single Environment)
- Any migration mistake immediately impacts users and data.
- Rollback is harder if schema changes have already been applied.
- It’s difficult to test safely under real traffic or real data without impacting production.

## Minimum Validation Checklist
- Migration runs cleanly on a fresh Development snapshot.
- Row counts and totals match baseline for key tables.
- Core API endpoints return expected results.
- Pricing calculations match baseline outputs.
- Performance regression checks on top 10 queries.

## Decision
Proceed with **two environments** and **two branches**. This adds a small amount of coordination overhead but drastically reduces risk during MySQL migration.
