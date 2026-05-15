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

- Application API routes require a signed `tsudolio_session` HTTP-only cookie.
  The cookie is HMAC-signed with `AUTH_SESSION_SECRET` and stores the tenant
  code, user email, authentication provider, issue time, and expiration time.
- Password login is available through `POST /api/auth/login`. Password hashes
  are stored in `user_credentials` with scrypt, failed-attempt counters, and a
  short account lock after repeated failures.
- OIDC login is available through `GET /api/auth/login`. The callback exchanges
  the authorization code for an ID token, verifies the ID token signature
  against JWKS, validates issuer/audience/nonce/expiration, resolves the local
  user by email and tenant, then issues the same signed session cookie.
- `POST /api/auth/logout` clears the signed session cookie.
- Mutating schedule, organization, and document APIs require explicit
  permissions before calling application use cases.
- Creating or updating a system administrator requires `tenant.manage` in
  addition to organization user-management permission.
- Successful schedule, organization, and document mutations write
  tenant-scoped audit events with actor, target, severity, metadata, and
  request IP where available.
- `is_system_admin` is treated as a full-permission break-glass flag, but a
  valid authenticated request identity and tenant context are still required.
- `GET /api/auth/session` returns the current tenant, user, assigned
  permissions, and effective permission booleans for the UI.
- `GET /api/auth/providers` exposes local-login availability and OIDC provider
  configuration status.

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
