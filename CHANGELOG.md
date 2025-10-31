# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [0.2.0] - 2025-10-31
### Changed
- Default `search()` now consumes the modern `/store/search` layout, including the single-result page variant, while keeping the existing pagination flow. (Breaking change only if you relied on `/work/search` geo-neutral responses.)
- Added a dedicated `searchGlobal()` export that preserves the legacy `/work/search` behaviour for opt-in consumers.
- UI playground gains a “Result source” selector, contextual banner, and direct link to the Play Store URL for quick validation (modern vs. global modes).
- Strengthened proxy tooling: the HTTP client now surfaces proxy attempts in the logs and honours TLS opt-outs, while the UI playground’s proxy panel supports per-country entries, credentials, and insecure-cert toggles.
### Fixed
- Updated search module tests with `ds:4` fixtures to cover the new HTML payload shape and single-result fallback.

## 0.1.1

- fix(similar): robust cluster discovery + cookie-sticky client; inline ds:3 fallback with brand-focused trimming; add tests for id changes/labels/nested clusters
- fix(list): dynamic f.req body with legacy fallback; robust batchexecute parser; add tests for fallback and body coverage across categories
- chore(tests): optional live fixture recorder and fixture-based similar() test scaffold


## [0.1.0] - 2025-09-02
- Initial TypeScript rewrite scaffold.
- Core HTTP client with retries and optional cookie jar.
- Parsing utilities (scriptData, mappingHelpers, processPages).
- Feature parity modules: app, list, search, suggest, developer, reviews, similar, permissions, datasafety, categories.
- Memoized wrapper API.
- Tests for utils and modules with nock.
- README and examples.
