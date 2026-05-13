# Web Layering

The web app keeps Next.js at the delivery edge and uses Clean Architecture-style
dependency direction inside `src`.

## Layers

- `app/`: Next.js App Router boundary. Pages, layouts, and route handlers live
  here because they are framework delivery adapters. They should stay thin and
  delegate to the layers below.
- `application/`: use-case contracts, input validation, DTOs, and application
  errors. This layer is framework-free and must not import React, Next.js,
  Prisma, generated database types, presentation code, or infrastructure code.
- `domain/`: pure business rules and policies. Domain code is the innermost
  layer and must not import application, presentation, infrastructure, React,
  Next.js, Prisma, or generated database types.
- `infrastructure/`: adapters for external systems such as Prisma and database
  connection setup. Infrastructure can depend inward on application contracts.
- `presentation/`: React UI, client hooks, HTTP response helpers, and
  user-facing composition. Presentation can use application contracts, but not
  infrastructure details.
- `presentation/styles/`: global CSS imported only from `app/globals.css`.
- `shared/`: small framework-neutral helpers shared across layers when they do
  not belong to a single domain.

## Next.js Boundary

- `src/app/` is used instead of a package-root `app/` folder so application
  source stays together under `src`.
- `src/app/page.tsx`, `src/app/layout.tsx`, and `src/app/api/**/route.ts` are delivery
  adapters. They should stay thin.
- API routes can act as the composition root: wire application use cases to an
  infrastructure repository, parse HTTP input, and return HTTP output.

## Import Rule

Dependencies point inward:

`app/` -> `presentation` / `application` / `infrastructure`
`presentation` -> `application` / `shared`
`infrastructure` -> `application` / `domain` / generated Prisma client
`application` -> `domain` / `shared`
`domain` -> no inner application dependencies

ESLint enforces the most important rules so accidental shortcuts fail during
`npm run lint`.
