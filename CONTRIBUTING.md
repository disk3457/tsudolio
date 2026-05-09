# Contributing

Thank you for helping build Tsudolio.

## Development

1. Install Node.js 22 or newer.
2. Run `npm install`.
3. Start the web app with `npm run dev`.
4. Run `npm run typecheck` and `npm run build` before opening a pull request.

## Branches

All development work should happen on a topic branch, then be pushed and opened as a pull request. Do not commit directly to `main`.

Use short, descriptive branch names:

```text
feature/workflow-approvals
fix/mobile-schedule-layout
docs/security-baseline
```

Recommended flow:

```bash
git switch -c feature/example-change
npm run lint
npm run typecheck
npm run build
git add .
git commit -m "Add example change"
git push -u origin feature/example-change
gh pr create
```

## Commit Style

Prefer small commits with imperative messages:

```text
Add workflow approval status model
Fix mobile navigation spacing
Document tenant isolation assumptions
```

## Security

Do not commit secrets, credentials, production data, personal information, or real patient/resident data. Use `.env.example` for placeholders.
