# Architecture

## Product Shape

Tsudolio is designed as a multi-tenant business application. The first implementation is a Web/PWA front end with local mock data. The next implementation layer will add API, database persistence, object storage, authentication, and audit logs.

## Tenancy

Every persistent business record must be scoped by `tenant_id`. Cross-tenant administration should use separate platform-level roles and explicit break-glass audit events.

Recommended tenant model:

- `tenants`: organization boundary
- `organizations`: departments, wards, branches, sections
- `users`: human accounts
- `memberships`: user-to-organization relationship
- `roles`: named permission bundles
- `permissions`: fine-grained actions
- `audit_events`: immutable security and business events

## Deployment Modes

- Local development: Docker Compose with PostgreSQL, MinIO, and Mailpit
- Small organization: single VM or container host
- Enterprise/SaaS: Kubernetes or managed container platform
- Closed network: mirrored container registry and offline dependency process

## Future API Boundary

The API should expose OpenAPI definitions and use explicit request-scoped tenant context. The front end should never decide tenant isolation by itself.
