import { BASE_URL } from '../constants';
import { request } from '../http/client';
import * as scriptData from '../utils/scriptData';
import helper from '../utils/mappingHelpers';
import { hydrateMissingSummaries } from '../utils/hydrateMissingSummaries';
import type { AppDetails, JsonValue } from '../types';
import { asNumber, asString, toAbsoluteUrl, type AppListItem } from '../utils/appList';
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
}

function normalizeSearchOptions(opts: SearchOptions): SearchState {
  if (!opts || !opts.term) throw new Error('Search term missing');
  if (opts.num && opts.num > 250) throw new Error("The number of results can't exceed 250");
  return {
    term: encodeURIComponent(opts.term),
    lang: opts.lang || 'en',
    country: opts.country || 'us',
    num: opts.num || 20,
    fullDetail: opts.fullDetail,
    price: opts.price ? getPriceGoogleValue(opts.price) : 0,
    requestOptions: opts.requestOptions,
  };
}

function extractAppIdFromUrl(urlPath: string | undefined): string | undefined {
  if (!urlPath) return undefined;
  try {
    const parsed = new URL(urlPath, BASE_URL);
    return parsed.searchParams.get('id') ?? undefined;
  } catch {
    const match = urlPath.match(/[?&]id=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }
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
    appId: extractAppIdFromUrl(urlPath),
    url,
    icon,
    developer: asString(scriptData.getPathValue(node, [68, 0])),
    developerId: extractAppIdFromUrl(asString(scriptData.getPathValue(node, [68, 1, 4, 2])) ?? undefined),
    priceText,
    currency: asString(scriptData.getPathValue(node, [57, 0, 0, 0, 1, 0, 1])),
    price,
    free: price === 0,
    summary: helper.summaryText(scriptData.getPathValue(node, [73])),
    scoreText: asString(scriptData.getPathValue(node, [51, 0, 0])),
    score: asNumber(scriptData.getPathValue(node, [51, 0, 1])),
  };
}

function extractStoreResults(parsed: JsonValue): AppListItem[] {
  const clusters = scriptData.getPathValue(parsed, ['ds:4', 0, 1]);
  const singles: AppListItem[] = [];
  const listApps: AppListItem[] = [];

  if (Array.isArray(clusters)) {
    for (const cluster of clusters) {
      if (singles.length === 0) {
        const singleNode = scriptData.getPathValue(cluster, [23, 16, 2]);
        const single = mapStoreSingleApp(singleNode);
        if (single) singles.push(single);
      }

      const list = scriptData.getPathValue(cluster, [22, 0]);
      if (Array.isArray(list)) {
        for (const entry of list) {
          const mapped = mapStoreListApp(entry);
          if (mapped) listApps.push(mapped);
        }
      }
    }
  }

  return dedupeByAppId([...singles, ...listApps]);
}

async function initialStoreRequest(opts: SearchState) {
  const url = `${BASE_URL}/store/search?q=${opts.term}&hl=${encodeURIComponent(opts.lang)}&gl=${encodeURIComponent(opts.country)}&price=${opts.price}&c=apps`;
  const html = await request({ url, method: 'GET', headers: opts.requestOptions?.headers, country: opts.country });
  // ponytail: Play serves every result (30) on this page with no continuation token, so there is nothing to page.
  return extractStoreResults(scriptData.parse(html)).slice(0, opts.num);
}

async function fetchFullDetailResults<R>(
  appFetcher: (args: AppOptions) => Promise<R>,
  apps: AppListItem[],
  state: SearchState
): Promise<R[]> {
  return Promise.all(
    apps
      .filter((item): item is AppListItem & { appId: string } => typeof item.appId === 'string' && item.appId.length > 0)
      .map((item) => appFetcher({ appId: item.appId, lang: state.lang, country: state.country }))
  );
}

export interface SearchOptions {
  term: string;
  lang?: string;
  country?: string;
  num?: number;
  fullDetail?: boolean;
  price?: 'all' | 'free' | 'paid';
  requestOptions?: { headers?: Record<string, string> };
}

export async function search(
  appFetcher: (args: AppOptions) => Promise<AppDetails>,
  opts: SearchOptions
): Promise<AppListItem[] | AppDetails[]> {
  const state = normalizeSearchOptions(opts);
  const results = await initialStoreRequest(state);
  if (state.fullDetail) return fetchFullDetailResults(appFetcher, results, state);
  return hydrateMissingSummaries(results, { lang: state.lang, country: state.country }, appFetcher);
}

export default search;
