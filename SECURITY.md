# Security Policy

## Supported Versions

The project is pre-1.0. Security fixes will be applied to the main branch until a release policy is defined.

## Reporting a Vulnerability

Please do not open public issues for vulnerabilities. Use the repository's private vulnerability reporting feature when available, or contact the maintainers through the published security contact.

Include:

- Affected version or commit
- Impact and affected component
- Reproduction steps
- Suggested mitigation, if known

## Baseline Principles

- No secrets in Git
- MFA and SSO support for production deployments
- Least-privilege roles
- Tenant isolation on every data access path
- Tamper-evident audit logging
- Encrypted transport
- Backups with restore drills
- Dependency scanning and security review before releases

