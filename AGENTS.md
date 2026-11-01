# Repository Guidelines

## Project Structure & Module Organization
- `src/`: TypeScript source (entry: `src/index.ts`).
- `src/modules/`: one file per public method; `src/utils/`: parsing and paging helpers; `src/http/`: HTTP client and proxy config.
- `tests/`: Mocha tests (`*.spec.js`) run against the built `dist/cjs`; `tests/types/usage.mts`: strict type checks on the built typings; `tests/live.spec.js`: live smoke tests.
- `examples/`: Minimal usage samples (type-checked and linted).
- `reference/`: Upstream references only (gitignored). Do not import from here.

## Build, Test, and Development Commands
- `npm i`: Install dependencies (Node 20.18.1+).
- `npm run build`: Build ESM to `dist/esm` and CJS to `dist/cjs`.
- `npm test`: Build ESM + CJS, then run the offline mocha suite (network is blocked).
- `npm run test:coverage`: Same suite with nyc thresholds (what CI runs).
- `npm run test:live`: Live smoke tests against the real Play Store (also run weekly in CI).
- `npm run verify:types`: Strict `nodenext` compile of `tests/types/usage.mts` and `examples/` against the built typings.
- `npm run lint` / `npm run lint:fix`: Lint (ESLint flat config).
- `npm run format`: Format with Prettier.
- `npm run docs`: Generate API docs (TypeDoc) to `docs/`.

Example local workflow:
```
npm ci
npm run lint && npm test && npm run verify:types
```

## Coding Style & Naming Conventions
- Indentation: 2 spaces; UTF-8; LF.
- TypeScript: `strict` types, no `any` unless justified.
- Filenames: camelCase modules (`scriptData.ts`, `appList.ts`), PascalCase for types/classes, camelCase for functions/variables.
- Public API: re-export from `src/index.ts` (including result/option types); avoid deep import paths.
- Build Play `f.req` payloads with `JSON.stringify` + `encodeURIComponent`, never by splicing values into pre-encoded strings.
- Never `eval` or otherwise execute content scraped from Play.
- Linting/formatting: ESLint flat config + Prettier; keep `npm run lint` clean.

## Testing Guidelines
- Tests live in `tests/` with `*.spec.js` names and `require('../dist/cjs/...')`.
- Target high coverage for parsers, mappings, and pagination.
- Prefer fixtures that mirror Play's real payload shape; live checks go in `tests/live.spec.js` (skipped unless `LIVE=1`).
- Assert actual values, not just `Array.isArray(...)`.
- Keep tests deterministic; avoid fragile HTML snapshots.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`). Small and scoped.
- PRs: Provide summary, rationale, linked issues, and test results. Update README/docs on API changes.
- CI: Build, lint, and tests must pass locally before opening PR.

## Security & Configuration Tips
- Respect remote services: requests go through the client's 5-request concurrency cap, 30 s timeout and 5xx/429 retries; don't bypass it.
- Never commit secrets. Use `.env.local`; `.env*` are gitignored.
- Avoid tracking headers; match reference behavior for anonymous requests.
