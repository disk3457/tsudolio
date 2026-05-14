# Security Baseline

## Standards to Track

- OWASP ASVS and OWASP Top 10 for application security
- NISC unified standards for Japanese public-sector security expectations
- Ministry of Health, Labour and Welfare medical information system security guidance for healthcare deployments
- Personal Information Protection Commission guidance for personal data handling in Japan
- Web accessibility requirements aligned with JIS X 8341-3 and WCAG

## Controls for MVP

- SSO-ready authentication architecture
- MFA support for privileged users
- Role-based permissions with organization scope
- Audit logging for sign-in, permission changes, approvals, document access, and administrative actions
- Encrypted transport in production
- Secrets loaded from environment or secret manager only
- Dependency scanning in CI
- Backup and restore procedures before production use

## Current Implementation

- API routes resolve the current tenant from `x-tsudolio-tenant-code` or
  `TSUDOLIO_TENANT_CODE`, falling back to the seeded demo tenant.
- Until full OIDC/SSO is implemented, API routes resolve the current user from
  `x-tsudolio-user-email` or `TSUDOLIO_ACTOR_EMAIL`, falling back to the seeded
  demo administrator.
- Mutating schedule, organization, and document APIs require explicit
  permissions before calling application use cases.
- Creating or updating a system administrator requires `tenant.manage` in
  addition to organization user-management permission.
- Successful schedule, organization, and document mutations write
  tenant-scoped audit events with actor, target, severity, metadata, and
  request IP where available.
- `is_system_admin` is treated as a full-permission break-glass flag for the
  demo foundation. Production authentication must still provide a request
  identity and tenant context.
- `GET /api/auth/session` returns the current tenant, user, assigned
  permissions, and effective permission booleans for the UI.
- `GET /api/auth/providers` exposes the configured auth mode. `GET
  /api/auth/login` starts an OIDC authorization-code flow with PKCE when
  `OIDC_ISSUER_URL` and `OIDC_CLIENT_ID` are configured, and `GET
  /api/auth/callback` validates the returned state before the future token
  exchange/session-cookie step.

Permission codes currently used by the API boundary:

- `schedule.manage`: create, update, and delete schedules and facility
  reservations
- `organization.manage`: create, update, and delete organization units and
  users
- `document.manage`: create, update, and delete document registry records
- `tenant.manage`, `document.read`, `workflow.approve`: seeded for the next
  administration, document access, and workflow steps

## Explicit Non-Goals for the First Public MVP

- Electronic medical records
- Diagnosis, treatment, medication, or patient clinical data workflows
- Resident registry integrations
- Payment or payroll processing

These domains require separate legal, operational, and security review.
