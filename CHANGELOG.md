# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [0.5.0] - 2026-11-01
### Breaking
- `app()` `recentChanges` is plain text like `description` (tags stripped, `<br>` → line break); the markup moved to `recentChangesHTML`.
### Added
- `reviews()` `score` (1–5) and `device` (`constants.device.MOBILE`, `TABLET`, `WATCH`, `CHROMEBOOK`, `TV`) filters, applied by Play on every page.
- `availability({ appId, countries })` → `{ us: true, fr: false, … }`, from each country listing's `available` flag (Play answers 200 for most countries an app isn't in, so the status code can't tell).
- `app()` returns `recentChangesHTML` (markup as Play serves it).
- List results (`search`, `list`, `developer`, `similar`) carry `descriptionHTML`, the full description Play already puts in the card, so it no longer takes an `app()` call.
- Specific errors, all exported: `RateLimitError` (429 after retries) and `BlockedError` (redirect to Google's captcha page, now retried like a 429) extend `HttpError`; `ValidationError` replaces the plain `Error` thrown for bad options.
- `reviews()` asks for up to 4500 reviews per request (was 150): `num: 2000` is one request instead of 14.
### Fixed
- `search()` follows Play's continuation token again and accepts `num` up to 250. 0.4.1 capped it at 30, but some queries (single characters, digits, some app names such as `minecraft`) carry a token worth ~200 more apps; queries without one still stop at the first page. Continuation pages are filtered by `price` client-side and de-duplicated.

## [0.4.1] - 2026-11-01
### Breaking
- `search()` `num` is limited to 30 (was 250) and throws above it: Play serves at most 30 results per query, with no further pages.
### Added
- `app()` returns `releasedTimestamp` (ms since epoch); `released` stays Play's localized text.
### Fixed
- `app()` `developerId` and `developerInternalID` are URL-decoded (`'Spotify AB'`, was `'Spotify+AB'`), so they work as `developer({ devId })` and match `search()`.

## [0.4.0] - 2026-11-01
### Breaking
- Node.js 20.18.1 or newer is required (cheerio's bundled undici crashes on older versions).
- `searchGlobal()` was removed; `search()` uses `/store/search` only.
- `list()` options `collection`, `category` and `age` are typed as the `constants` values (`age` was wrongly typed with the key names).
- `datasafety()` items now normalise `optional` to `boolean | null` and `purpose` to `string | null`.
- `PermissionItem.type` is the permission group label string (it was never `0 | 1`).
### Fixed
- Public typings: `app()`, `search()`, `list()`, `developer()`, `similar()`, `reviews()`, `permissions()` and `datasafety()` now resolve to real types (`AppDetails`, `AppSummary`, `Review`, …) instead of `{ appId; url }`, `unknown[]` or `object`; `fullDetail`/`short` overloads pick the result type; `memoized` is no longer optional.
- ESM typings work with `moduleResolution: node16/nodenext` (relative imports in `.d.ts` now carry `.js`).
- Security: Play page content is no longer passed to `eval`.
- `similar()` reads the similar-apps cluster from the right data block and picks the similar cluster instead of "More by <developer>".
- Pagination (app lists and reviews) stops on an empty page that still carries a token, instead of looping forever.
- Requests time out after 30 s, so stalled sockets no longer block the 5-request concurrency limit.
- At most 5 requests are in flight process-wide (`fullDetail` and summary backfills used to open them all at once).
- `createPlayStoreApi()` no longer clears proxies set with `configureProxies()` unless `proxies` is passed.
- `suggest()` handles terms containing `"` or `\`, and forwards `requestOptions.headers`.
- Passing an option as `undefined` (e.g. `lang`, `num`) falls back to its default instead of sending `undefined`/`NaN`.
- `lang`/`country` are URL-encoded; `similar()` no longer double-encodes `appId`; `permissions()` returns `[]` on an unexpected payload.
- `reviews()` pagination tokens no longer skip reviews; `developer()` honours `fullDetail`; `developerLegalAddress` and data safety fields read Play's current layout; `categories()` returns the known list without a request; `search()` drops a redundant request.
### Changed
- 429 (rate limited) responses are retried like 5xx, honouring `Retry-After` (capped at 60 s); `HttpError.retryAfterMs` exposes the requested delay.
- `fullDetail` results leave out apps whose detail page returns 404 instead of rejecting the whole call.
- `memoized()` shares one request between concurrent identical calls, no longer caches failures, and keys by method name.
### Added
- `requestOptions.headers` on every method, forwarded to `fullDetail` and backfill `app()` calls too.
- `backfillSummaries: false` on list, search, developer and similar skips the per-entry summary backfill.
- Exported types `AppDetails`, `AppSummary`, `Review`, `PermissionItem`, `DataSafety`, `DataSafetyItem`, option types, and the `HttpError` and `NotFoundError` classes; 404 responses now reject with `NotFoundError` (a subclass of `HttpError`).
### Removed
- Unused internals: the never-populated cookie jar (`createClient`), the `onProxyResolved` hook, `extractFeatures`, `ParseError`.

## [0.3.1] - 2026-03-01
### Fixed
- Summary extraction aligned across list-style methods; missing subtitles are backfilled from `app()`.

## [0.3.0] - 2026-02-08
- Version bump only.

## [0.2.1] - 2026-02-08
### Changed
- Documented the `search()` result limit (Play serves at most 30 results).

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
