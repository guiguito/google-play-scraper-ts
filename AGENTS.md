# Repository Guidelines

## Project Structure & Module Organization
- `src/`: TypeScript source (entry: `src/index.ts`).
- `src/http/`, `src/utils/`, `src/modules/` (as added during implementation).
- `tests/`: Unit/integration tests (`*.spec.ts`).
- `examples/`: Minimal usage samples.
- `reference/`: Upstream references only (gitignored). Do not import from here.

## Build, Test, and Development Commands
- `npm i`: Install dependencies (Node 18+).
- `npm run build`: Build ESM to `dist/esm` and CJS to `dist/cjs`.
- `npm test`: Build CJS then run mocha tests in `tests/`.
- `npm run lint` / `npm run lint:fix`: Lint (ESLint flat config).
- `npm run format`: Format with Prettier.
- `npm run docs`: Generate API docs (TypeDoc) to `docs/`.

Example local workflow:
```
pnpm i
pnpm run build && pnpm test
```

## Coding Style & Naming Conventions
- Indentation: 2 spaces; UTF-8; LF.
- TypeScript: `strict` types, no `any` unless justified.
- Filenames: kebab-case modules (`app-parser.ts`), PascalCase for types/classes, camelCase for functions/variables.
- Public API: re-export from `src/index.ts`; avoid deep import paths.
- Linting/formatting: ESLint flat config + Prettier; keep `npm run lint` clean.

## Testing Guidelines
- Tests live in `tests/` with `*.spec.ts` names.
- Target high coverage for parsers, mappings, and pagination.
- Prefer fixtures; gate live tests with `LIVE=1 npm test`.
- Keep tests deterministic; avoid fragile HTML snapshots.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`). Small and scoped.
- PRs: Provide summary, rationale, linked issues, and test results. Update README/docs on API changes.
- CI: Build, lint, and tests must pass locally before opening PR.

## Security & Configuration Tips
- Respect remote services: throttle requests and avoid aggressive parallelism.
- Never commit secrets. Use `.env.local`; `.env*` are gitignored.
- Avoid tracking headers; match reference behavior for anonymous requests.
