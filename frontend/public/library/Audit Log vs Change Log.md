# Audit Log vs Change Log

## Overview
Audit logs and change logs both document what happened, but they serve different stakeholders. The audit trail is a compliance-focused chronicle of who touched the platform and why. The change log is a user-oriented record of what changed in the domain objects that matter to each tenant.

## Why we need audit logs
- **Proof of control:** External auditors, regulators, and internal security teams demand an immutable record of privileged actions that shows *who* took *what* action and *when*.
- **Tenant isolation:** Each tenant only ever sees `actor_tenant_id` values that belong to them because API filters enforce the tenant context via `tenant.audit.read`. That keeps one pharma client from reading another region’s sensitive improvements or investigations.
- **Security callbacks:** When an alert fires (e.g., a suspicious SKU update or access attempt), the audit log provides the forensic context required to trace the incident back to a user identity, role, and tenant.
- **Rollbacks and accountability:** When a configuration change causes issues, the audit log reveals the responsible person and their permissions, which helps govern escalation and remedial controls.

## Why we need change logs
- **Operational visibility:** Business users want to understand how their customer master data, quotes, or workflows evolved. A change log surfaces the actual field-level data before/after values so regional teams can explain pricing shifts.
- **Tenant trust:** By keeping a human-readable change log scoped to the tenant’s own data tables, you can reassure each regional client that only their records were updated and the history matches their expectations.
- **Workflow context:** Change logs are easily tied to specific domain objects (quotes, workflows, master data rows). That makes them searchable for daily reviews, even when full audit detail is overkill.
- **Supporting change approvals:** When a change requires approval, the change log lets reviewers see which SKU or workflow step was touched without digging through the more technical audit trail.

## Key differences
| Dimension | Audit Log | Change Log |
|---|---|---|
| Focus | Security, compliance, permissions | Business context, domain data changes |
| Granularity | Row action metadata with actor IDs | Field-level before/after data with tenant scope |
| Audience | Security, compliance, platform ops, SuperAdmin | Operational teams, Tenants, change approvers |
| Retention | Retained to satisfy regulations (often longer) | Retained to support user reviews (can be shorter) |
| Tenant filtering | Always scoped to `actor_tenant_id` (tenant cannot see another tenant unless they have `platform.audit.read`) | Scoped to the tenant’s own records/objects in the UI |

## Tenant-specific implementation notes
- Tenant admins access only their audit logs because `/audit/admin` passes `context.tenant_id` to `list_audit_logs`, resulting in `actor_tenant_id = ?` filtering.
- Superadmins can query `/audit/platform` across tenants when they hold `platform.audit.read`, which is intentional for governance teams. Tenants never hit that route.
- The change log UI and APIs also limit data to the tenant context (e.g., quoting history lives in tenant-tagged tables), so each region gets a clean view of their modifications.

## Summary
Keep these two trails separate but aligned. Use the audit log for governance, security, and multi-tenant isolation proofs. Use the change log to tell each tenant what changed in their objects, to support approvals, and to back up data questions. Together they deliver the accountability and transparency your pharma clients expect.
