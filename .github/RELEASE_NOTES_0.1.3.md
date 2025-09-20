## google-play-scraper-ts 0.1.3

This release hardens `similar()` and `list()` against current Google Play responses, fixes an edge case where `list()` could return an empty array, and adds optional live-fixture tooling.

Highlights
- similar()
  - Prefer the first cluster (parity with the reference library) and keep cookies across requests for consistent paging.
  - Fallback to inline `ds:3` on the details page when no cluster URL is provided.
  - Brand-focused re‑ranking and trimming to keep “Similar” lists short and relevant.
  - Tests added for cluster id changes, nested clusters, and label changes.

- list()
  - Dynamic `f.req` builder for the `vyAe2` RPC.
  - Robust batchexecute parser (XSSI-safe, line-insensitive).
  - Auto-fallback to the legacy payload on 400/415 or unexpected shapes (fixes the empty-list issue some users saw).
  - Expanded tests for body content across collections/categories and fallback path.

- Fixtures (optional)
  - `scripts/record-similar-fixture.js` records details/cluster HTML (requires `LIVE=1`), allowing you to replay and validate against live snapshots.
  - Optional fixture-based test: enable with `USE_FIXTURE=1` once you’ve captured fixtures.

Developer experience
- Release scripts (`release:patch|minor|major`) and `prepack` ensure builds and checks are consistent.
- README updates for Releases and Debugging (GP_DEBUG, UI playground, fixtures).

Install
```
npm i google-play-scraper-ts
```

Compatibility
- Node.js >= 18
- Dual CJS/ESM builds; types included

Thanks to everyone who tested the UI playground and reported cases that helped us align results with the reference implementation.

