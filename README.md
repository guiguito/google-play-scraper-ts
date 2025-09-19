# google-play-scraper-ts

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

## API reference

All methods are asynchronous. `lang` defaults to `'en'`, `country` defaults to `'us'` unless otherwise noted.

### `app(options)`

Fetches rich information about a single application.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `appId` | `string` | – | Application package name (`com.spotify.music`). |
| `lang` | `string` | `'en'` | Play Store UI language (`en`, `es`, …). |
| `country` | `string` | `'us'` | Play Store country (`us`, `br`, …). |
| `requestOptions` | `{ headers?: Record<string,string> }` | – | Extra HTTP headers (e.g. cookies). |

Returns an object with fields such as `title`, `description`, `summary`, `installs`, `score`, `price`, `free`, `categories`, `screenshots`, `developer`, `privacyPolicy`, `comments`, and many more (mirrors the data provided by the Play Store). Example:

```jsonc
{
  "appId": "com.spotify.music",
  "title": "Spotify: Music and Podcasts",
  "summary": "Play music and podcasts",
  "score": 4.4,
  "ratings": 32145678,
  "price": 0,
  "free": true,
  "categories": [{ "name": "Music & Audio", "id": "MUSIC_AND_AUDIO" }],
  "developer": "Spotify AB",
  "privacyPolicy": "https://www.spotify.com/privacy"
}
```

### `list(options)`

Retrieve a curated collection (top charts). Supports summary or full-detail mode.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `collection` | `constants.collection` | `TOP_FREE` | Chart to fetch (`TOP_FREE`, `TOP_PAID`, `GROSSING`). |
| `category` | `constants.category` | `APPLICATION` | App category. |
| `age` | `constants.age \\| string` | – | Age filter (`AGE_RANGE1`, …). |
| `lang`, `country` | `string` | `'en'`, `'us'` | Locale. |
| `num` | `number` | `500` | Max apps to fetch. |
| `fullDetail` | `boolean` | `false` | When `true`, returns full `app()` payloads for each item. |

Returns an array of app summaries (title, appId, price, score, …) or full app objects when `fullDetail` is `true`.

### `search(options)`

Performs a Play Store search.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `term` | `string` | – | Search query. |
| `num` | `number` | `20` | Max results (max 250). |
| `fullDetail` | `boolean` | `false` | Fetch full app details. |
| `price` | `'all' \\| 'free' \\| 'paid'` | `'all'` | Price filter. |
| `requestOptions`, `lang`, `country` | – | Like `app()`. |

Returns an array of app summaries or full details.

### `suggest(options)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `term` | `string` | – | Partial search term. |
| `lang`, `country`, `requestOptions` | – | Locale and headers. |

Returns an array of suggestion strings (`['twitter', 'twitter lite', …]`).

### `developer(options)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `devId` | `string` | – | Developer ID (`Spotify+AB`). |
| `num` | `number` | `60` | Max apps. |
| `fullDetail`, `lang`, `country` | – | Like `list()`. |

Returns apps published by the developer (full details when `fullDetail` is `true`).

### `reviews(options)`

Fetches user reviews for an app. Returns an object `{ data, nextPaginationToken }`.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `appId` | `string` | – | Application package name. |
| `sort` | `constants.sort` | `sort.NEWEST` | Sort order (`NEWEST`, `RATING`, `HELPFULNESS`). |
| `num` | `number` | `150` | Max reviews to gather. |
| `paginate` | `boolean` | `false` | When `false`, automatically follow the next token until `num` is reached. |
| `nextPaginationToken` | `string` | `null` | Continue from a previous call. |
| `lang`, `country` | `string` | `'en'`, `'us'` | Locale for review text. |

A review item contains `id`, `userName`, `text`, `score`, `scoreText`, `thumbsUp`, `replyText`, `replyDate`, `version`, `criterias`, etc.

### `similar(options)`

Returns apps from the “Similar” cluster.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `appId` | `string` | – | Reference app. |
| `fullDetail` | `boolean` | `false` | When `true`, fetches full app data for each similar item. |
| `lang`, `country` | `string` | `'en'`, `'us'` | Locale. |

### `permissions(options)`

| Option | Type | Default |
| --- | --- | --- |
| `appId` | `string` | – |
| `short` | `boolean` | `false` (set to `true` for the simplified list). |
| `lang`, `country` | `string` | `'en'`, `'us'` |

Returns either a flat array of permission names (`short: true`) or detailed objects containing `permission` and `type`.

### `datasafety(options)`

| Option | Type | Default |
| --- | --- | --- |
| `appId` | `string` | – |
| `lang` | `string` | `'en'` |

Returns an object:

```jsonc
{
  "sharedData": [ { "data": "email", "optional": false, "purpose": "ads", "type": "Personal info" } ],
  "collectedData": [ ... ],
  "securityPractices": [ { "practice": "Encrypt data", "description": "Data is encrypted" } ],
  "privacyPolicyUrl": "https://example.com/privacy"
}
```

### `categories()`

No arguments. Returns an array of category identifiers (`['APPLICATION', 'GAME', …]`).

### `memoized(options)`

Creates a lightweight in-memory cache for high-traffic lookups.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `maxAge` | `number` | `300_000` ms | TTL for cached entries. |
| `max` | `number` | `1000` | Maximum cached keys (oldest is evicted). |

Usage mirrors the main API:

```ts
const memo = gplay.memoized({ maxAge: 60_000, max: 200 });
await memo.app({ appId: 'com.spotify.music' });
await memo.search({ term: 'music', num: 10 });
```

### Constants

The default export exposes Play Store enumerations under `constants` for convenience:

- `constants.collection` – `TOP_FREE`, `TOP_PAID`, `GROSSING`
- `constants.category` – All Play Store categories (`APPLICATION`, `GAME_MUSIC`, …)
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
