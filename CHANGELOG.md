# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]
- Improve typing coverage across modules.
- Expand fixtures and edge case tests.

## [0.1.0] - 2025-09-02
- Initial TypeScript rewrite scaffold.
- Core HTTP client with retries and optional cookie jar.
- Parsing utilities (scriptData, mappingHelpers, processPages).
- Feature parity modules: app, list, search, suggest, developer, reviews, similar, permissions, datasafety, categories.
- Memoized wrapper API.
- Tests for utils and modules with nock.
- README and examples.
## 0.1.1

- fix(similar): robust cluster discovery + cookie-sticky client; inline ds:3 fallback with brand-focused trimming; add tests for id changes/labels/nested clusters
- fix(list): dynamic f.req body with legacy fallback; robust batchexecute parser; add tests for fallback and body coverage across categories
- chore(tests): optional live fixture recorder and fixture-based similar() test scaffold

