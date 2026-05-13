# Architecture

## Product Shape

Tsudolio is designed as a multi-tenant business application. The current web
app is a Next.js/PWA frontend backed by PostgreSQL through Prisma. The next
implementation layers will add object storage, authentication, permission
enforcement, and audit coverage for mutations.

## Web Application Layers

`apps/web` is the Next.js project root inside the npm workspace monorepo. The
source code lives under `apps/web/src` so framework delivery code and product
code are in one source tree, while config files, generated artifacts, Prisma,
and public assets stay at the package root.

- `src/app`: Next.js App Router delivery boundary. Pages, layouts, and route
  handlers live here. This is a framework convention, not a business layer.
  Files in this directory should stay thin.
- `src/presentation`: React views, hooks, workspace composition, shared UI, and
  global styles. Presentation consumes application DTOs and API responses.
- `src/application`: use-case contracts, input validation, DTOs, and
  application errors. It is framework-free and independent from React, Next.js,
  Prisma, and generated database types.
- `src/domain`: pure business rules and policies. It is the innermost layer and
  has no dependency on application, infrastructure, presentation, or framework
  code.
- `src/infrastructure`: adapters for external systems, currently Prisma and
  database connection setup. Infrastructure implements application contracts.
- `src/shared`: small framework-neutral utilities such as formatters.

The package root remains for tool-owned and runtime boundary files:

- `prisma`: schema, migrations, and seed data.
- `generated`: generated Prisma client output.
- `public`: static assets served by Next.js.
- `next.config.ts`, `eslint.config.mjs`, `tsconfig.json`, and package metadata.

API route handlers are composition roots. They parse HTTP input, create a use
case from an application contract plus an infrastructure repository, and return
HTTP output. UI components call API routes or consume application DTOs; they do
not import Prisma or generated database types.

API route handlers also resolve request identity at the delivery boundary.
`src/application/security` owns permission codes and authorization policy,
while `src/infrastructure/prisma/current-user-repository.ts` adapts seeded
tenant, membership, role, and permission records into a current-user context.
This keeps the future OIDC/SSO adapter replaceable without changing product
use cases.

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
