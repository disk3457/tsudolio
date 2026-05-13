# Presentation Feature Architecture

Feature folders under `src/presentation/features` contain view composition,
client-side state, and presentational helpers only. They sit in the
presentation layer and should not import Prisma, generated database types, or
infrastructure modules directly.

## Boundaries

- `workspace/` owns the authenticated shell: navigation, top bar, and view switching.
- `<domain>/` owns each product surface, such as dashboard, schedule, organization, documents, security, and settings.
- Domain views may import application contracts from `src/application/<domain>`.
- Shared UI lives in `src/presentation/components`.
- General formatting helpers live in `src/shared`.

## Import Direction

- Feature views may import shared UI from `src/presentation/components`.
- Feature views may import application DTOs and API response types from `src/application`.
- Feature modules should avoid importing sibling feature internals unless there is a deliberate product dependency.
- Workspace shell may compose feature views, but domain features should not depend on the workspace shell except for shared navigation types.
- Feature modules must not import `src/infrastructure` or `@generated/*`.
