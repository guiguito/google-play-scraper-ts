## google-play-scraper-ts 0.1.1

This release hardens `similar()` and `list()` to align with current Google Play responses, adds a dynamic payload builder with safe fallback, and improves test coverage + optional live fixtures.

Highlights
- similar()
  - Robust cluster discovery + cookie-sticky client (matches reference behavior).
  - Inline `ds:3` fallback when cluster URL is missing on details page.
  - Brand-focused re-ranking + trimming to keep lists tight and relevant.
  - Tests added for: id changes, nested clusters, and label changes.

- list()
  - Dynamic `f.req` body builder for `vyAe2`.
  - Auto-fallback to legacy payload on 400/415.
  - Robust batchexecute parser (XSSI-safe, line-insensitive).
  - Expanded tests for body content across categories and fallback path.

- Fixtures (optional)
  - `scripts/record-similar-fixture.js` to record details/cluster HTML (requires LIVE=1).
  - Optional fixture-based test replay (set `USE_FIXTURE=1`).

Install
```
npm i google-play-scraper-ts
```

Compatibility
- Node.js >= 18.
- Dual CJS/ESM builds; types included.

Thanks to everyone testing the UI playground and providing reproducible cases. 🙌

