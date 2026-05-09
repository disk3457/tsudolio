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

## Explicit Non-Goals for the First Public MVP

- Electronic medical records
- Diagnosis, treatment, medication, or patient clinical data workflows
- Resident registry integrations
- Payment or payroll processing

These domains require separate legal, operational, and security review.

