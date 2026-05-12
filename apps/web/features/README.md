# Feature Architecture

This app uses a feature-by-domain structure on top of the Next.js App Router.

## Boundaries

- `app/` owns routes, layouts, and API route entrypoints.
- `features/workspace/` owns the authenticated shell: navigation, top bar, and view switching.
- `features/<domain>/` owns each product domain, such as dashboard, schedule, organization, documents, security, and settings.
- `features/<domain>/server/` contains server-only domain data access and validation used by API routes.
- `components/` contains reusable UI that is not owned by one domain.
- `lib/` contains shared infrastructure and utilities, such as Prisma and general formatters.

## Import Direction

- Feature views may import shared UI from `components/` and utilities from `lib/`.
- API routes may call `features/<domain>/server/*`.
- Feature modules should avoid importing sibling feature internals unless there is a deliberate product dependency.
- Workspace shell may compose feature views, but domain features should not depend on the workspace shell except for shared navigation types.
