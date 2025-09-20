# google-play-scraper-ts

[![npm version](https://img.shields.io/npm/v/google-play-scraper-ts.svg?color=blue)](https://www.npmjs.com/package/google-play-scraper-ts)
[![npm downloads](https://img.shields.io/npm/dm/google-play-scraper-ts.svg)](https://www.npmjs.com/package/google-play-scraper-ts)

Fully typed Node.js client for Google Play Store metadata inspired by [`google-play-scraper`](https://github.com/facundoolano/google-play-scraper). The rewrite keeps the familiar API while adding:

- ✅ **TypeScript-first** types and emitted declaration files
- ✅ **Fixtures & offline tests** (no live traffic unless `LIVE=1`)
- ✅ **Retries + memoization** out of the box
- ✅ **Dual CJS/ESM builds** with verified parity

## Installation

```bash
npm install google-play-scraper-ts
```

> Requires Node.js 18 or newer.

## Quick start

CommonJS:

```js
const gplay = require('google-play-scraper-ts').default;

const app = await gplay.app({ appId: 'com.spotify.music' });
console.log(app.title, app.score);
```

ESM / TypeScript:

```ts
import gplay, { constants } from 'google-play-scraper-ts';

const topFreeMusic = await gplay.list({
  collection: constants.collection.TOP_FREE,
  category: constants.category.MUSIC_AND_AUDIO,
  num: 10,
});
```

## Common conventions

- `lang` controls the Play Store UI language (default `'en'`).
- `country` controls geotargeting and pricing (default `'us'`).
- Methods that accept `requestOptions` forward `requestOptions.headers` to the underlying HTTP client so you can inject cookies or additional headers (see per-method notes—`suggest` currently ignores the option for API parity).
- Every function returns a Promise; runtime errors (invalid inputs, store shape changes, HTTP failures) surface as rejected promises.

## API reference

All methods are asynchronous and resolve to typed results. The library mirrors the original [`google-play-scraper`](https://github.com/facundoolano/google-play-scraper) surface while enriching the responses with strict TypeScript types.

### Shared types

#### `AppDetails`

**Identification & copy**

| Field | Type | Description |
| --- | --- | --- |
| `appId` | `string` | Requested package identifier. |
| `url` | `string` | Canonical details URL including `hl`/`gl` query params. |
| `title` | `string` | App title localized to `lang`. |
| `summary` | `string` | Short marketing blurb. |
| `description` | `string` | Plain-text description (HTML stripped). |
| `descriptionHTML` | `string` | Raw HTML description from the store. |
| `genre` | `string \| undefined` | Primary genre label. |
| `genreId` | `string \| undefined` | Primary genre identifier. |
| `categories` | `Array<{ name: string; id: string }>` | All category tags discovered in the payload. |

**Ratings & installs**

| Field | Type | Description |
| --- | --- | --- |
| `installs` | `string \| undefined` | Play Store installs text (e.g. `'10,000,000+'`). |
| `minInstalls` | `number \| undefined` | Minimum installs inferred by the store. |
| `maxInstalls` | `number \| undefined` | Maximum installs inferred by the store. |
| `score` | `number \| undefined` | Average rating (0–5). |
| `scoreText` | `string \| undefined` | Rating text shown in the UI. |
| `ratings` | `number \| undefined` | Total number of ratings. |
| `reviews` | `number \| undefined` | Total number of textual reviews. |
| `histogram` | `Record<1 \| 2 \| 3 \| 4 \| 5, number>` | Star histogram counts (missing buckets default to `0`). |

**Pricing & monetisation**

| Field | Type | Description |
| --- | --- | --- |
| `free` | `boolean` | `true` when the app can be installed without payment. |
| `price` | `number` | Current price in the store currency (e.g. `0`, `3.99`). |
| `originalPrice` | `number \| undefined` | Pre-discount price in the store currency, when available. |
| `discountEndDate` | `number \| undefined` | Unix timestamp (ms) for the promotion end, if provided. |
| `currency` | `string \| undefined` | ISO-4217 currency code. |
| `priceText` | `string` | Human readable price (falls back to `'Free'`). |
| `offersIAP` | `boolean` | Whether the listing advertises in-app purchases. |
| `IAPRange` | `string \| undefined` | Raw in-app purchase price range from the store. |
| `isAvailableInPlayPass` | `boolean` | Indicates Google Play Pass availability. |

**Media & merchandising**

| Field | Type | Description |
| --- | --- | --- |
| `icon` | `string \| undefined` | Square icon URL. |
| `headerImage` | `string \| undefined` | Feature graphic URL. |
| `screenshots` | `string[]` | Screenshot URLs (order preserved). |
| `video` | `string \| undefined` | Promotional video URL. |
| `videoImage` | `string \| undefined` | Poster image for the promo video. |
| `previewVideo` | `string \| undefined` | Short autoplay preview clip URL. |
| `comments` | `string[]` | Up to five highlighted user quotes. |
| `recentChanges` | `string \| undefined` | “What’s new” text block. |

**Developer & policies**

| Field | Type | Description |
| --- | --- | --- |
| `developer` | `string \| undefined` | Developer display name. |
| `developerId` | `string \| undefined` | Developer identifier extracted from profile link. |
| `developerInternalID` | `string \| undefined` | Internal developer ID used by Play. |
| `developerEmail` | `string \| undefined` | Contact email. |
| `developerWebsite` | `string \| undefined` | Website URL. |
| `developerAddress` | `string \| undefined` | Mailing address. |
| `developerLegalName` | `string \| undefined` | Legal entity name. |
| `developerLegalEmail` | `string \| undefined` | Legal contact email. |
| `developerLegalAddress` | `string \| undefined` | Legal contact address (line breaks normalised). |
| `developerLegalPhoneNumber` | `string \| undefined` | Legal contact phone number. |
| `privacyPolicy` | `string \| undefined` | Privacy policy URL. |

**Platform & release information**

| Field | Type | Description |
| --- | --- | --- |
| `released` | `string \| undefined` | Store-published release date text. |
| `updated` | `number \| undefined` | Last update timestamp in ms since epoch. |
| `version` | `string` | Latest version string (falls back to `'VARY'`). |
| `androidVersion` | `string` | Minimum Android version, normalised (e.g. `'5.0'` or `'VARY'`). |
| `androidVersionText` | `string` | Raw minimum version text from the listing. |
| `androidMaxVersion` | `string \| undefined` | Maximum supported Android version if provided. |
| `contentRating` | `string \| undefined` | Content rating label (e.g. `'Teen'`). |
| `contentRatingDescription` | `string \| undefined` | Additional content rating guidance. |
| `adSupported` | `boolean` | `true` if the listing discloses ads. |
| `available` | `boolean` | Indicates overall availability in the requested country. |
| `preregister` | `boolean` | `true` when the app is only available for preregistration. |
| `earlyAccessEnabled` | `boolean` | `true` for early access / beta listings. |

#### `AppSummary`

Returned by list, search, developer and similar methods when `fullDetail` is `false`.

| Field | Type | Description |
| --- | --- | --- |
| `appId` | `string \| undefined` | Package identifier. |
| `title` | `string \| undefined` | App title. |
| `url` | `string \| undefined` | Absolute Play Store URL. |
| `icon` | `string \| undefined` | Icon URL. |
| `developer` | `string \| undefined` | Developer display name. |
| `developerId` | `string \| undefined` | Developer profile identifier (when exposed). |
| `summary` | `string \| undefined` | Short synopsis. |
| `price` | `number \| undefined` | Current price in the store currency (`0` for free apps). |
| `priceText` | `string \| undefined` | Price label (`'FREE'`, `'$0.99'`, …). |
| `currency` | `string \| undefined` | Currency code. |
| `free` | `boolean \| undefined` | `true` when no payment required. |
| `score` | `number \| undefined` | Average rating. |
| `scoreText` | `string \| undefined` | Rating text. |

#### `Review`

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string \| undefined` | Review identifier used by the Play Store. |
| `userName` | `string \| undefined` | Reviewer display name. |
| `userImage` | `string \| undefined` | Avatar image URL. |
| `date` | `string \| null` | ISO string of the review timestamp (null if unavailable). |
| `score` | `number \| undefined` | Star rating (1–5). |
| `scoreText` | `string \| null \| undefined` | Rating represented as text. |
| `url` | `string \| undefined` | Deep link back to the review on Play. |
| `title` | `null` | Placeholder (Play no longer serves review titles). |
| `text` | `string \| undefined` | Review body. |
| `replyDate` | `string \| null` | ISO timestamp of the developer reply. |
| `replyText` | `string \| null` | Developer reply content. |
| `version` | `string \| null` | App version cited in the review. |
| `thumbsUp` | `number \| undefined` | Helpfulness vote count. |
| `criterias` | `Array<{ criteria: unknown \| null; rating: unknown \| null }> \| undefined` | Per-criteria ratings when supplied by Play (e.g. for games). |

#### `PermissionItem`

| Field | Type | Description |
| --- | --- | --- |
| `permission` | `string` | Permission string (e.g. `'CAMERA'`). |
| `type` | `0 \| 1` | Section identifier (`0` = `constants.permission.COMMON`, `1` = `constants.permission.OTHER`). |

#### `DataSafetyItem`

| Field | Type | Description |
| --- | --- | --- |
| `data` | `string \| undefined` | Data point name (e.g. `'email'`). |
| `optional` | `boolean \| null \| undefined` | Whether the data is optional (null when Google has no flag). |
| `purpose` | `string \| null \| undefined` | Usage purpose label (e.g. `'ads'`). |
| `type` | `string \| undefined` | Category grouping (e.g. `'Personal info'`). |

### `app(options): Promise<AppDetails>`

Fetch detailed information about a single application.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `appId` | `string` | – | Required package identifier (`com.spotify.music`). |
| `lang` | `string` | `'en'` | Store UI language. |
| `country` | `string` | `'us'` | Store country / pricing market. |
| `requestOptions` | `{ headers?: Record<string, string> }` | – | Extra HTTP headers passed to Play (cookies, locale overrides, …). |

Resolves to an `AppDetails` object as documented above.

### `list(options): Promise<AppSummary[] \| AppDetails[]>`

Retrieve curated charts (Top Free, Top Paid, Grossing, …). Set `fullDetail` to fetch the richer `AppDetails` payload for each entry.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `collection` | `constants.collection` | `constants.collection.TOP_FREE` | Chart to fetch. |
| `category` | `constants.category` | `constants.category.APPLICATION` | App category filter. |
| `age` | `constants.age \| string \| undefined` | – | Optional age-range filter. |
| `lang` | `string` | `'en'` | Locale for metadata. |
| `country` | `string` | `'us'` | Region / storefront. |
| `num` | `number` | `500` | Maximum entries (Play caps at ~500). |
| `fullDetail` | `boolean` | `false` | When true, fetch each item with `app()`. |

Returns an array of `AppSummary` entries, or `AppDetails` entries when `fullDetail` is enabled.

### `search(options): Promise<AppSummary[] \| AppDetails[]>`

Search the Play Store catalogue.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `term` | `string` | – | Search query (required). |
| `lang` | `string` | `'en'` | Metadata language. |
| `country` | `string` | `'us'` | Storefront country. |
| `num` | `number` | `20` | Maximum results (hard limit 250). |
| `fullDetail` | `boolean` | `false` | When true, hydrate each match via `app()`. |
| `price` | `'all' \| 'free' \| 'paid'` | `'all'` | Price filter. |
| `requestOptions` | `{ headers?: Record<string, string> }` | – | Forwarded headers for the search request. |

Returns `AppSummary` results or `AppDetails` objects when `fullDetail` is set.

### `suggest(options): Promise<string[]>`

Fetch autocomplete suggestions from Play.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `term` | `string` | – | Partial query (required). |
| `lang` | `string` | `'en'` | Suggestion language. |
| `country` | `string` | `'us'` | Storefront country. |
| `requestOptions` | `{ headers?: Record<string, string> }` | – | Reserved for API compatibility (currently ignored). |

Resolves to an array of suggestion strings ordered by relevance.

### `developer(options): Promise<AppSummary[] \| AppDetails[]>`

List applications published by a developer profile.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `devId` | `string` | – | Developer identifier (numeric or slug). |
| `lang` | `string` | `'en'` | Metadata language. |
| `country` | `string` | `'us'` | Storefront country. |
| `num` | `number` | `60` | Maximum apps to collect. |
| `fullDetail` | `boolean` | `false` | Set to `true` for `AppDetails` results. |

Returns developer listings as `AppSummary` entries, or full details when `fullDetail` is enabled.

### `reviews(options): Promise<{ data: Review[]; nextPaginationToken: string \| null }>`

Pull paginated user reviews for a given app.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `appId` | `string` | – | Target package identifier. |
| `sort` | `constants.sort` | `constants.sort.NEWEST` | Sorting mode (`NEWEST`, `RATING`, `HELPFULNESS`). |
| `lang` | `string` | `'en'` | Review language. |
| `country` | `string` | `'us'` | Locale used for review localisation. |
| `num` | `number` | `150` | Maximum reviews to gather before stopping. |
| `paginate` | `boolean` | `false` | When `false`, auto-follow tokens until `num` reviews or exhaust data. |
| `nextPaginationToken` | `string \| null` | `null` | Pass a token from a previous response to resume manually. |

When `paginate` is `true`, the method fetches a single page and returns the next token (if any). The `data` array contains `Review` entries.

### `similar(options): Promise<AppSummary[] \| AppDetails[]>`

Retrieve apps from the “Similar” / “Related” clusters for a given listing.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `appId` | `string` | – | Reference package identifier. |
| `lang` | `string` | `'en'` | Metadata language. |
| `country` | `string` | `'us'` | Storefront country. |
| `fullDetail` | `boolean` | `false` | Hydrate each result via `app()` when `true`. |

Returns up to ~60 related apps as `AppSummary` or `AppDetails` entries.

### `permissions(options): Promise<string[] \| PermissionItem[]>`

Inspect runtime permissions declared in the Play listing.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `appId` | `string` | – | Target package identifier. |
| `short` | `boolean` | `false` | When `true`, return a flat list of permission strings. Otherwise return `PermissionItem` objects grouped by type. |
| `lang` | `string` | `'en'` | Language for permission descriptions (when available). |
| `country` | `string` | `'us'` | Storefront country. |

### `datasafety(options): Promise<{ sharedData: DataSafetyItem[]; collectedData: DataSafetyItem[]; securityPractices: Array<{ practice?: string; description?: string }>; privacyPolicyUrl?: string }>`

Fetch the Google Play “Data safety” disclosure for an app.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `appId` | `string` | – | Target package identifier. |
| `lang` | `string` | `'en'` | Disclosure language. |

The result contains separate `sharedData` and `collectedData` arrays of `DataSafetyItem`s, a list of high-level `securityPractices`, and an optional `privacyPolicyUrl`.

### `categories(): Promise<string[]>`

Scrape the public category directory and return category identifiers (e.g. `'APPLICATION'`, `'GAME_TRIVIA'`).

### `memoized(options?: { maxAge?: number; max?: number }): PlayStoreApi`

Wrap the API with an in-memory cache.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `maxAge` | `number` | `300_000` | Cache TTL in milliseconds. |
| `max` | `number` | `1_000` | Maximum cache size; oldest entries are evicted first. |

The returned object has the same surface as the default export (including a `memoized` method) but memoises every call.

### Constants helper

The default export re-exports structured enums under `constants` for convenience:

- `constants.collection` – `TOP_FREE`, `TOP_PAID`, `GROSSING`.
- `constants.category` – All Play categories (apps, games, family variants, etc.).
- `constants.sort` – Review sort orders (`NEWEST`, `RATING`, `HELPFULNESS`).
- `constants.age` – Age-range filters used by the family charts.
- `constants.permission` – Permission buckets (`COMMON`, `OTHER`).
- `constants.clusters` – Internal cluster identifiers used by list parsing utilities.

## Releases

- Preflight checks before releasing:
  - `npm run release:preflight` (lint, tests, type verification)
- Publish (requires npm login and 2FA):
  - Patch: `npm run release:patch`
  - Minor: `npm run release:minor`
  - Major: `npm run release:major`
- Notes
  - `prepack` builds automatically before pack/publish.
  - For scoped packages (e.g. `@your-scope/google-play-scraper-ts`), publish with `--access public` (already included in release scripts).
  - To validate after publish: install in a clean folder and require/import both CJS/ESM entries.

## Debugging & Fixtures

- Verbose debugging for `similar()` resolution:
  - Set `GP_DEBUG=1` to print minimal breadcrumbs when the service-request cluster id is missing (e.g., container keys available).
- UI tests (manual exploration):
  - Build the library: `npm run build`
  - Start the UI server: `LIVE=1 node ui-tests/server.js`
  - Open the playground and use the forms to call each method.
- Record live fixtures for `similar()` (optional):
  - `LIVE=1 npm run build && node scripts/record-similar-fixture.js --appId com.spotify.music --lang en --country us --out tests/fixtures/similar`
  - Re-run tests with fixture replay: `USE_FIXTURE=1 npm test`
- `constants.sort` – Review sort order values
- `constants.age`, `constants.permission`, plus other helpers

## Retries & throttling

- **Retries** – The internal HTTP client retries 5xx responses with exponential backoff (configurable via helper APIs).
- **Caching** – Use `memoized()` to deduplicate hot requests. For full control, combine with your own throttling or caching layer.

## TypeScript support

- Published package includes type declarations generated from the TypeScript sources.
- `npm run verify:types` compiles `tests/types/usage.ts` against the generated `.d.ts` to guarantee correctness.

## Running the docs & tests

```bash
npm run lint
LIVE=1 npm test    # only needed when you want to exercise live tests (default suite uses fixtures)
npm run test        # builds both ESM and CJS bundles before running mocha
npm run docs        # generates TypeDoc output in /docs
npm run verify:types
```

> By default the test suite blocks outbound HTTP requests. Set `LIVE=1` to allow network calls when you want to run ad-hoc live checks.

### Manual UI testing playground

For quick manual exploration, a minimal web UI lives under `ui-tests/` and loads the compiled ESM bundle directly in the browser.

```bash
# from the repo root
npm run build                 # make sure dist/esm is up to date
LIVE=1 node ui-tests/server.js

# open http://localhost:5173 in your browser and run the forms
```

> The playground uses the production ESM output (`dist/esm/index.js`). If you want live data, export `LIVE=1` before launching the server so the underlying API calls can reach Google Play.

## Contributing

Issues and pull requests are welcome! Please review `AGENTS.md` for repository conventions (linting, commit style, release workflow).
