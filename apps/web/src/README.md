# Web Layering

The web app keeps Next.js at the delivery edge and uses Clean Architecture-style
dependency direction inside `src`.

## Layers

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
- `shared/`: small framework-neutral helpers shared across layers when they do
  not belong to a single domain.

## Next.js Boundary

- `app/` remains at the package root because the App Router expects it there.
- `app/page.tsx`, `app/layout.tsx`, and `app/api/**/route.ts` are delivery
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
