# Architecture

## Product Shape

Tsudolio is designed as a multi-tenant business application. The current web
app is a Next.js/PWA frontend backed by PostgreSQL through Prisma. The next
implementation layers will add object storage, authentication, permission
enforcement, and audit coverage for mutations.

## Web Application Layers

The Next.js `app/` directory is intentionally kept as the delivery boundary:
routes, layouts, and route handlers. Product code lives under `apps/web/src`
and follows Clean Architecture-style dependency direction.

- `src/application`: use-case contracts, input validation, DTOs, and
  application errors. It is framework-free and independent from React, Next.js,
  Prisma, and generated database types.
- `src/domain`: pure business rules and policies. It is the innermost layer and
  has no dependency on application, infrastructure, presentation, or framework
  code.
- `src/infrastructure`: adapters for external systems, currently Prisma and
  database connection setup. Infrastructure implements application contracts.
- `src/presentation`: React views, hooks, workspace composition, shared UI, and
  HTTP response helpers.
- `src/shared`: small framework-neutral utilities such as formatters.

API route handlers are composition roots. They parse HTTP input, create a use
case from an application contract plus an infrastructure repository, and return
HTTP output. UI components call API routes or consume application DTOs; they do
not import Prisma or generated database types.

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
