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

> Requires Node.js 20.18.1 or newer.

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
- Every method (except `categories`) accepts `requestOptions: { headers }`; the headers are sent with every request the call makes, including the `app()` requests behind `fullDetail` and the summary backfill.
- Every function returns a Promise; runtime errors (invalid inputs, store shape changes, HTTP failures) surface as rejected promises. HTTP failures reject with `HttpError` (exported, with `status` and `body`); 404s, e.g. an unknown app, reject with its subclass `NotFoundError`.
- Methods with `fullDetail` are overloaded: `fullDetail: true` resolves to `AppDetails[]`, otherwise to `AppSummary[]`. With `fullDetail`, apps whose detail page returns 404 (removed, or not offered in that country) are left out; any other error rejects the call.

### Proxy routing

- The HTTP client can route calls through HTTP(S) proxies keyed by country (ISO alpha-2, case-insensitive). If no per-country match is found, the optional `default` proxy is used instead of a direct connection.
- Configure proxies via `configureProxies(settings)` or `createPlayStoreApi({ proxies })`. Proxy settings are process-wide: `createPlayStoreApi({ proxies })` replaces them for every client, `proxies: null` clears them, and omitting `proxies` leaves them untouched. All methods automatically opt into proxy usage—the `country` argument (or `gl` query param) determines the lookup.
- HTTPS proxies are supported; pass `protocol: 'https'` or use an `https://` URL. To work with debugging gateways that present expired/self-signed certificates, set `rejectUnauthorized: false` (defaults to `true`).

```ts
import { createPlayStoreApi } from 'google-play-scraper-ts';

const gplay = createPlayStoreApi({
  proxies: {
    default: { host: 'proxy.example', port: 8080 },
    perCountry: {
      us: { host: 'us-proxy.internal', port: 8080, auth: { username: 'user', password: 'secret' } },
      fr: { url: 'http://fr-proxy.internal:8080' },
      br: { url: 'https://br-proxy.internal:10443', rejectUnauthorized: false },
    },
  },
});

const result = await gplay.app({ appId: 'com.spotify.music', country: 'us' });
```

> Already instantiated clients can be updated in-place with `configureProxies(newSettings)`; pass `null` or omit entries to clear previously configured proxies.

## API reference

All methods are asynchronous and resolve to typed results. The library mirrors the original [`google-play-scraper`](https://github.com/facundoolano/google-play-scraper) surface while enriching the responses with strict TypeScript types.

### Shared types

All result types are exported: `import type { AppDetails, AppSummary, Review, PermissionItem, DataSafety, DataSafetyItem } from 'google-play-scraper-ts';`

#### `AppDetails`

**Identification & copy**

| Field | Type | Description |
| --- | --- | --- |
| `appId` | `string` | Requested package identifier. |
| `url` | `string` | Canonical details URL including `hl`/`gl` query params. |
| `title` | `string \| undefined` | App title localized to `lang`. |
| `summary` | `string \| undefined` | Short marketing blurb. |
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
| `developerId` | `string \| undefined` | Developer identifier from the profile link; pass it to `developer({ devId })`. |
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
| `released` | `string \| undefined` | Release date as Play's text, localized by `lang` (`'May 27, 2014'`, `'27 mai 2014'`). |
| `releasedTimestamp` | `number \| undefined` | Release date in ms since epoch (use this to parse or compare). |
| `updated` | `number \| undefined` | Last update timestamp in ms since epoch. |
| `version` | `string` | Latest version string (falls back to `'VARY'`). |
| `androidVersion` | `string` | Minimum Android version, normalised (e.g. `'5.0'` or `'VARY'`). |
| `androidVersionText` | `string` | Raw minimum version text from the listing. |
| `androidMaxVersion` | `string` | Maximum supported Android version, normalised (`'VARY'` when absent). |
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
| `developerId` | `string \| undefined` | Only on `search()`'s top result: Play's list cards don't carry it. Use `fullDetail: true` to get it on every entry. |
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
| `scoreText` | `string \| null` | Rating represented as text. |
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
| `type` | `string \| undefined` | Permission group label from Play (e.g. `'Location'`). |

#### `DataSafetyItem`

| Field | Type | Description |
| --- | --- | --- |
| `data` | `string \| undefined` | Data point name (e.g. `'email'`). |
| `optional` | `boolean \| null` | Whether the data is optional (null when Google has no flag). |
| `purpose` | `string \| null` | Usage purpose label (e.g. `'ads'`). |
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
| `age` | `constants.age` value (e.g. `constants.age.FIVE_UNDER`) | – | Optional age-range filter. |
| `lang` | `string` | `'en'` | Locale for metadata. |
| `country` | `string` | `'us'` | Region / storefront. |
| `num` | `number` | `500` | Maximum entries (Play caps at ~500). |
| `fullDetail` | `boolean` | `false` | When true, fetch each item with `app()`. |
| `backfillSummaries` | `boolean` | `true` | Set to `false` to skip the extra `app()` request per entry that lacks a summary. |
| `requestOptions` | `{ headers?: Record<string, string> }` | – | Extra HTTP headers for every request the call makes. |

Returns an array of `AppSummary` entries, or `AppDetails` entries when `fullDetail` is enabled.

### `search(options): Promise<AppSummary[] \| AppDetails[]>`

Search the Play Store catalogue.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `term` | `string` | – | Search query (required). |
| `lang` | `string` | `'en'` | Metadata language. |
| `country` | `string` | `'us'` | Storefront country. |
| `num` | `number` | `20` | At most 30 results (values above 30 throw): Play serves at most 30 results per query, with no further pages. |
| `fullDetail` | `boolean` | `false` | When true, hydrate each match via `app()`. |
| `price` | `'all' \| 'free' \| 'paid'` | `'all'` | Price filter. |
| `requestOptions` | `{ headers?: Record<string, string> }` | – | Extra HTTP headers for every request the call makes. |
| `backfillSummaries` | `boolean` | `true` | Set to `false` to skip the extra `app()` request per entry that lacks a summary. |

Results mirror the modern `/store/search` layout (including single-result pages). When `fullDetail` is enabled each result is re-fetched via `app()`.

**Need more than 30 results?** Play has no second page for a query. To collect more distinct apps, run related queries and de-duplicate by `appId`: the same term with `price: 'free'` and `price: 'paid'` (largely different sets), other `country` values, or terms from `suggest()`. Each query costs one request and has its own ranking.

```ts
const term = 'photo editor';
const byId = new Map();
for (const t of [term, ...(await gplay.suggest({ term }))]) {
  for (const app of await gplay.search({ term: t, num: 30 })) byId.set(app.appId, app);
}
```

### `suggest(options): Promise<string[]>`

Fetch autocomplete suggestions from Play.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `term` | `string` | – | Partial query (required). |
| `lang` | `string` | `'en'` | Suggestion language. |
| `country` | `string` | `'us'` | Storefront country. |
| `requestOptions` | `{ headers?: Record<string, string> }` | – | Extra HTTP headers for the suggest request. |

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
| `backfillSummaries` | `boolean` | `true` | Set to `false` to skip the extra `app()` request per entry that lacks a summary. |
| `requestOptions` | `{ headers?: Record<string, string> }` | – | Extra HTTP headers for every request the call makes. |

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
| `requestOptions` | `{ headers?: Record<string, string> }` | – | Extra HTTP headers for every request the call makes. |

When `paginate` is `true`, the method fetches a single page and returns the next token (if any). The `data` array contains `Review` entries.

### `similar(options): Promise<AppSummary[] \| AppDetails[]>`

Retrieve apps from the “Similar” / “Related” clusters for a given listing.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `appId` | `string` | – | Reference package identifier. |
| `lang` | `string` | `'en'` | Metadata language. |
| `country` | `string` | `'us'` | Storefront country. |
| `fullDetail` | `boolean` | `false` | Hydrate each result via `app()` when `true`. |
| `backfillSummaries` | `boolean` | `true` | Set to `false` to skip the extra `app()` request per entry that lacks a summary. |
| `requestOptions` | `{ headers?: Record<string, string> }` | – | Extra HTTP headers for every request the call makes. |

Returns up to ~60 related apps as `AppSummary` or `AppDetails` entries.

### `permissions(options): Promise<string[] \| PermissionItem[]>`

Inspect runtime permissions declared in the Play listing.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `appId` | `string` | – | Target package identifier. |
| `short` | `boolean` | `false` | When `true`, return a flat list of permission strings. Otherwise return `PermissionItem` objects grouped by type. |
| `lang` | `string` | `'en'` | Language for permission descriptions (when available). |
| `country` | `string` | `'us'` | Storefront country. |
| `requestOptions` | `{ headers?: Record<string, string> }` | – | Extra HTTP headers for every request the call makes. |

### `datasafety(options): Promise<{ sharedData: DataSafetyItem[]; collectedData: DataSafetyItem[]; securityPractices: Array<{ practice?: string; description?: string }>; privacyPolicyUrl?: string }>`

Fetch the Google Play “Data safety” disclosure for an app.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `appId` | `string` | – | Target package identifier. |
| `lang` | `string` | `'en'` | Disclosure language. |
| `country` | `string` | – | Only used to pick a per-country proxy. |
| `requestOptions` | `{ headers?: Record<string, string> }` | – | Extra HTTP headers for every request the call makes. |

The result contains separate `sharedData` and `collectedData` arrays of `DataSafetyItem`s, a list of high-level `securityPractices`, and an optional `privacyPolicyUrl`.

### `categories(): Promise<string[]>`

Return every category identifier (e.g. `'APPLICATION'`, `'GAME_TRIVIA'`), the same values as `constants.category`. Play no longer publishes a full category directory, so no request is made.

### `memoized(options?: { maxAge?: number; max?: number }): PlayStoreApi`

Wrap the API with an in-memory cache.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `maxAge` | `number` | `300_000` | Cache TTL in milliseconds. |
| `max` | `number` | `1_000` | Maximum cache size; oldest entries are evicted first. |

The returned object has the same surface as the default export (including a `memoized` method) but memoises every call. Concurrent identical calls share one request, and failed calls are not cached.

### Constants helper

The enums are available as the named export `constants` (and spread at the top level of the default export, e.g. `gplay.category`):

- `constants.collection` – `TOP_FREE`, `TOP_PAID`, `GROSSING`.
- `constants.category` – All Play categories (apps, games, family variants, etc.).
- `constants.sort` – Review sort orders (`NEWEST`, `RATING`, `HELPFULNESS`).
- `constants.age` – Age-range filters used by the family charts.
- `constants.permission` – Permission buckets (`COMMON`, `OTHER`).

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

## Retries & throttling

- **Retries** – The internal HTTP client retries network errors, 5xx and 429 (rate limited) responses twice with exponential backoff (300 ms, 600 ms), waiting longer when Play sends a `Retry-After` header (capped at 60 s).
- **Timeouts** – Requests time out after 30 s of socket inactivity, then count as a retriable network error.
- **Concurrency** – At most 5 requests are open at once across the process; extra requests (e.g. `fullDetail` fan-outs) wait for a free slot.
- **Summary backfill** – When a list/search/developer/similar result lacks a summary, one `app()` call is made per such entry to fill it in; failures are ignored. Pass `backfillSummaries: false` to skip these requests.
- **Caching** – Use `memoized()` to deduplicate hot requests. For full control, combine with your own throttling or caching layer.

## TypeScript support

- Published package includes type declarations generated from the TypeScript sources.
- `npm run verify:types` compiles `tests/types/usage.mts` in strict mode, with `nodenext` resolution, against the generated `.d.ts`.

## Running the docs & tests

```bash
npm run lint
npm test            # builds ESM + CJS, then runs the offline suite
npm run test:live   # live smoke tests against the real Play Store (also run weekly in CI)
npm run test:coverage
npm run docs        # generates TypeDoc output in /docs
npm run verify:types
```

> The default suite blocks outbound HTTP requests; `npm run test:live` sets `LIVE=1` to allow them.

### Manual UI testing playground

For quick manual exploration, a browser-based playground ships in the `ui-tests/` directory. It loads the compiled ESM bundle from `dist/esm`, so make sure the build artefacts are fresh before launching it.

```bash
# from the repo root
npm run build                 # ensure dist/esm is up to date
LIVE=1 node ui-tests/server.js

# open http://localhost:5173 in your browser and run the forms
```

> The playground uses the production ESM output (`dist/esm/index.js`). If you want live data, export `LIVE=1` before launching the server so outbound requests are allowed.
> The proxy panel supports default/per-country overrides, auth credentials, and TLS validation overrides, and each run surfaces the exact Play Store URL for easy inspection.


## Contributing

Issues and pull requests are welcome! Please review `AGENTS.md` for repository conventions (linting, commit style, release workflow).
