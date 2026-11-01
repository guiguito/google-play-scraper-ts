import { BASE_URL } from '../constants';
import { request } from '../http/client';
import * as scriptData from '../utils/scriptData';
import helper from '../utils/mappingHelpers';
import { fetchFullDetails, hydrateMissingSummaries } from '../utils/hydrateMissingSummaries';
import { checkFinished } from '../utils/processPages';
import type { AppDetails, JsonValue } from '../types';
import { asNumber, asString, idFromUrl, toAbsoluteUrl, type AppListItem } from '../utils/appList';
import type { AppOptions } from './app';

function getPriceGoogleValue(value: string) {
  switch (value.toLowerCase()) {
    case 'free':
      return 1;
    case 'paid':
      return 2;
    case 'all':
    default:
      return 0;
  }
}

interface SearchState {
  term: string;
  lang: string;
  country: string;
  num: number;
  fullDetail?: boolean;
  price: number;
  requestOptions?: { headers?: Record<string, string> };
  backfillSummaries?: boolean;
}

// The first page holds ~20-50 apps. Some queries (single characters, digits, some app names such as
// 'minecraft') also carry a continuation token, followed here; Play ends those at ~250 (checked Nov 2026).
const MAX_SEARCH_RESULTS = 250;

function normalizeSearchOptions(opts: SearchOptions): SearchState {
  if (!opts || !opts.term) throw new Error('Search term missing');
  if (opts.num !== undefined && (opts.num < 0 || opts.num > MAX_SEARCH_RESULTS)) {
    throw new Error(`num must be between 0 and ${MAX_SEARCH_RESULTS}`);
  }
  return {
    term: encodeURIComponent(opts.term),
    lang: opts.lang || 'en',
    country: opts.country || 'us',
    num: opts.num ?? 20,
    fullDetail: opts.fullDetail,
    price: opts.price ? getPriceGoogleValue(opts.price) : 0,
    requestOptions: opts.requestOptions,
    backfillSummaries: opts.backfillSummaries,
  };
}

function dedupeByAppId(apps: AppListItem[]): AppListItem[] {
  const seen = new Set<string>();
  const result: AppListItem[] = [];
  for (const app of apps) {
    const key = app.appId ?? `${app.title ?? ''}|${app.url ?? ''}`;
    if (!key.trim()) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(app);
  }
  return result;
}

function mapStoreListApp(raw: JsonValue | undefined): AppListItem | undefined {
  const data = scriptData.getPathValue(raw ?? null, [0]);
  if (!Array.isArray(data)) return undefined;

  const urlPath = asString(scriptData.getPathValue(data, [10, 4, 2]));
  const priceMicros = scriptData.getPathValue(data, [8, 1, 0, 0]);
  const price = typeof priceMicros === 'number' ? priceMicros / 1_000_000 : undefined;
  const priceText =
    asString(scriptData.getPathValue(data, [25, 0, 0, 1, 0])) ?? (price === 0 ? 'FREE' : undefined);

  return {
    title: asString(scriptData.getPathValue(data, [3])),
    appId: asString(scriptData.getPathValue(data, [0, 0])),
    url: toAbsoluteUrl(urlPath),
    icon: asString(scriptData.getPathValue(data, [1, 3, 2])),
    developer: asString(scriptData.getPathValue(data, [14])),
    developerId: undefined,
    priceText,
    currency: asString(scriptData.getPathValue(data, [8, 1, 0, 1])),
    price,
    free: price === 0,
    summary: helper.summaryText(scriptData.getPathValue(data, [13])),
    scoreText: asString(scriptData.getPathValue(data, [4, 0])),
    score: asNumber(scriptData.getPathValue(data, [4, 1])),
  };
}

function mapStoreSingleApp(node: JsonValue | undefined): AppListItem | undefined {
  if (!Array.isArray(node)) return undefined;

  const urlPath = asString(scriptData.getPathValue(node, [41, 0, 2]));
  const priceMicros = scriptData.getPathValue(node, [57, 0, 0, 0, 1, 0, 0]);
  const price = typeof priceMicros === 'number' ? priceMicros / 1_000_000 : undefined;
  const priceText =
    asString(scriptData.getPathValue(node, [57, 0, 0, 1, 0])) ?? (price === 0 ? 'FREE' : undefined);

  const icon =
    asString(scriptData.getPathValue(node, [95, 0, 3, 2])) ??
    asString(scriptData.getPathValue(node, [96, 0, 3, 2]));

  const url = toAbsoluteUrl(urlPath);

  return {
    title: asString(scriptData.getPathValue(node, [0, 0])),
    appId: idFromUrl(urlPath),
    url,
    icon,
    developer: asString(scriptData.getPathValue(node, [68, 0])),
    developerId: idFromUrl(scriptData.getPathValue(node, [68, 1, 4, 2])),
    priceText,
    currency: asString(scriptData.getPathValue(node, [57, 0, 0, 0, 1, 0, 1])),
    price,
    free: price === 0,
    summary: helper.summaryText(scriptData.getPathValue(node, [73])),
    scoreText: asString(scriptData.getPathValue(node, [51, 0, 0])),
    score: asNumber(scriptData.getPathValue(node, [51, 0, 1])),
  };
}

function extractStoreResults(parsed: JsonValue): { apps: AppListItem[]; token?: string } {
  const clusters = scriptData.getPathValue(parsed, ['ds:4', 0, 1]);
  const singles: AppListItem[] = [];
  const listApps: AppListItem[] = [];
  let token: string | undefined;

  if (Array.isArray(clusters)) {
    for (const cluster of clusters) {
      if (singles.length === 0) {
        const singleNode = scriptData.getPathValue(cluster, [23, 16, 2]);
        const single = mapStoreSingleApp(singleNode);
        if (single) singles.push(single);
      }

      const list = scriptData.getPathValue(cluster, [22, 0]);
      if (Array.isArray(list)) {
        token ??= asString(scriptData.getPathValue(cluster, [22, 1, 3, 1]));
        for (const entry of list) {
          const mapped = mapStoreListApp(entry);
          if (mapped) listApps.push(mapped);
        }
      }
    }
  }

  return { apps: dedupeByAppId([...singles, ...listApps]), token };
}

async function initialStoreRequest(opts: SearchState) {
  const url = `${BASE_URL}/store/search?q=${opts.term}&hl=${encodeURIComponent(opts.lang)}&gl=${encodeURIComponent(opts.country)}&price=${opts.price}&c=apps`;
  const html = await request({ url, method: 'GET', headers: opts.requestOptions?.headers, country: opts.country });
  const { apps, token } = extractStoreResults(scriptData.parse(html));
  if (apps.length >= opts.num || !token) return apps.slice(0, opts.num);
  const need = opts.num - apps.length;
  const more = await checkFinished<AppListItem>(
    { num: need, numberOfApps: need, lang: opts.lang, country: opts.country, requestOptions: opts.requestOptions },
    [],
    token
  );
  // Play applies the price filter to the first page; don't trust it to carry over to continuation pages.
  const priced = more.filter((a) => opts.price === 0 || a.free === (opts.price === 1));
  return dedupeByAppId([...apps, ...priced]).slice(0, opts.num);
}

export interface SearchOptions {
  term: string;
  lang?: string;
  country?: string;
  /**
   * Maximum results, 0–250 (default 20). Most queries stop at Play's first page (~20–30 apps); some
   * (single characters, digits, some app names) continue up to ~250. Never longer than `num`.
   */
  num?: number;
  fullDetail?: boolean;
  price?: 'all' | 'free' | 'paid';
  /** Extra HTTP headers for every request this call makes (including app() fan-outs). */
  requestOptions?: { headers?: Record<string, string> };
  /** Set to false to skip the extra app() request per entry that lacks a summary. Default true. */
  backfillSummaries?: boolean;
}

export async function search(
  appFetcher: (args: AppOptions) => Promise<AppDetails>,
  opts: SearchOptions
): Promise<AppListItem[] | AppDetails[]> {
  const state = normalizeSearchOptions(opts);
  const results = await initialStoreRequest(state);
  if (state.fullDetail) return fetchFullDetails(results, state, appFetcher);
  return hydrateMissingSummaries(results, state, appFetcher);
}

export default search;
