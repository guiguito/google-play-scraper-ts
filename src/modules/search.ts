import { BASE_URL } from '../constants';
import { request } from '../http/client';
import * as scriptData from '../utils/scriptData';
import { checkFinished } from '../utils/processPages';
import type { JsonValue } from '../types';
import type { AppListItem } from '../utils/appList';
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

const STORE_RPC_ID = 'lGYRle';
const STORE_RPC_DEFAULT_PAGE_SIZE = 20;
const STORE_RPC_MAX_PAGE_SIZE = 60;
const STORE_RPC_REQID = '1065213';
const STORE_RPC_FALLBACK_SID = '-697906427155521722';
const STORE_RPC_FALLBACK_BL = 'boq_playuiserver_20190903.08_p0';

const GLOBAL_INITIAL_MAPPINGS = {
  apps: ['ds:1', 0, 1, 0, 0, 0] as const,
  sections: ['ds:1', 0, 1, 0, 0] as const,
};

const GLOBAL_SECTIONS_MAPPING = {
  token: [1] as const,
};

function asString(value: JsonValue | undefined) {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: JsonValue | undefined) {
  return typeof value === 'number' ? value : undefined;
}

const GLOBAL_APP_MAPPINGS = {
  title: { path: [2], fun: asString },
  appId: { path: [12, 0], fun: asString },
  url: {
    path: [9, 4, 2],
    fun: (path) => (typeof path === 'string' ? new URL(path, BASE_URL).toString() : undefined),
  },
  icon: { path: [1, 1, 0, 3, 2], fun: asString },
  developer: { path: [4, 0, 0, 0], fun: asString },
  developerId: {
    path: [4, 0, 0, 1, 4, 2],
    fun: (link) => (typeof link === 'string' ? link.split('?id=')[1] : undefined),
  },
  currency: { path: [7, 0, 3, 2, 1, 0, 1], fun: asString },
  price: {
    path: [7, 0, 3, 2, 1, 0, 0],
    fun: (price) => (typeof price === 'number' ? price / 1_000_000 : 0),
  },
  free: {
    path: [7, 0, 3, 2, 1, 0, 0],
    fun: (price) => price === 0,
  },
  summary: { path: [4, 1, 1, 1, 1], fun: asString },
  scoreText: { path: [6, 0, 2, 1, 0], fun: asString },
  score: { path: [6, 0, 2, 1, 1], fun: asNumber },
} satisfies scriptData.GenericMappings;

const mapGlobalSearchApp = scriptData.extractor<AppListItem>(GLOBAL_APP_MAPPINGS);

async function initialGlobalRequest(opts: SearchState) {
  const url = `${BASE_URL}/work/search?q=${opts.term}&hl=${opts.lang}&gl=${opts.country}&price=${opts.price}`;
  const html = await request({ url, method: 'GET', headers: opts.requestOptions?.headers, country: opts.country });
  return processGlobalFirstPage(html, opts, [], GLOBAL_INITIAL_MAPPINGS);
}

function isGlobalTokenSection(section: JsonValue | undefined) {
  const token = scriptData.getPathValue(section ?? null, GLOBAL_SECTIONS_MAPPING.token);
  return typeof token === 'string';
}

async function processGlobalFirstPage(
  html: string | JsonValue,
  opts: SearchState,
  savedApps: AppListItem[],
  mappings: typeof GLOBAL_INITIAL_MAPPINGS
): Promise<AppListItem[]> {
  const parsed = typeof html === 'string' ? scriptData.parse(html) : html;
  const sections = scriptData.getPathValue(parsed, mappings.sections);
  if (!Array.isArray(sections)) return [];
  const tokenSection = sections.find((section) => isGlobalTokenSection(section));
  const appsSection = scriptData.getPathValue(parsed, mappings.apps);
  const processedApps = Array.isArray(appsSection) ? appsSection.map((app) => mapGlobalSearchApp(app)) : [];
  const tokenValue = tokenSection ? scriptData.getPathValue(tokenSection, GLOBAL_SECTIONS_MAPPING.token) : undefined;
  const token = typeof tokenValue === 'string' ? tokenValue : undefined;
  const results = [...savedApps, ...processedApps];
  return checkFinished(
    {
      num: opts.num,
      numberOfApps: opts.num,
      fullDetail: opts.fullDetail,
      lang: opts.lang,
      country: opts.country,
      requestOptions: opts.requestOptions,
    },
    results,
    token
  );
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

function sanitizeSummary(summary: string | undefined): string | undefined {
  if (!summary) return undefined;
  const normalized = summary.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
  const firstLine = normalized.split(/\n+/)[0];
  return firstLine.trim();
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

function toAbsoluteUrl(path: string | undefined): string | undefined {
  if (!path) return undefined;
  try {
    return new URL(path, BASE_URL).toString();
  } catch {
    return undefined;
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

function clampStoreRequestSize(num: number) {
  if (!Number.isFinite(num) || num < 1) return STORE_RPC_DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(num), STORE_RPC_MAX_PAGE_SIZE);
}

function parseWizGlobalData(html: string) {
  const match = html.match(/WIZ_global_data\s*=\s*(\{[\s\S]*?\});/);
  if (!match) return { sid: STORE_RPC_FALLBACK_SID, bl: STORE_RPC_FALLBACK_BL };
  try {
    const parsed = JSON.parse(match[1]) as Record<string, unknown>;
    const sid = String(parsed.FdrFJe ?? STORE_RPC_FALLBACK_SID);
    const bl = typeof parsed.cfb2h === 'string' ? parsed.cfb2h : STORE_RPC_FALLBACK_BL;
    return { sid, bl };
  } catch {
    return { sid: STORE_RPC_FALLBACK_SID, bl: STORE_RPC_FALLBACK_BL };
  }
}

function cloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getStoreRequestDescriptor(parsed: JsonValue) {
  const rpcId = scriptData.getPathValue(parsed, ['serviceRequestData', 'ds:4', 'id']);
  if (rpcId !== STORE_RPC_ID) return undefined;
  const requestDescriptor = scriptData.getPathValue(parsed, ['serviceRequestData', 'ds:4', 'request']);
  return Array.isArray(requestDescriptor) ? cloneJson(requestDescriptor) : undefined;
}

function setStoreRequestSize(requestDescriptor: JsonValue, size: number) {
  if (!Array.isArray(requestDescriptor)) return false;
  const rootRequest = requestDescriptor[0];
  if (!Array.isArray(rootRequest)) return false;
  const config = rootRequest[1];
  if (!Array.isArray(config)) return false;
  const pageSpec = config[0];
  if (!Array.isArray(pageSpec)) return false;
  const pageSizeTuple = pageSpec[1];
  if (!Array.isArray(pageSizeTuple)) return false;
  pageSizeTuple[1] = size;
  return true;
}

function buildStoreRpcBody(requestDescriptor: JsonValue) {
  const payload = JSON.stringify([[[STORE_RPC_ID, JSON.stringify(requestDescriptor), null, 'generic']]]);
  return `f.req=${encodeURIComponent(payload)}`;
}

function buildStoreRpcUrl(opts: SearchState, html: string) {
  const { sid, bl } = parseWizGlobalData(html);
  return `${BASE_URL}/_/PlayStoreUi/data/batchexecute?rpcids=${STORE_RPC_ID}&f.sid=${encodeURIComponent(sid)}&bl=${encodeURIComponent(bl)}&hl=${opts.lang}&gl=${opts.country}&authuser&soc-app=121&soc-platform=1&soc-device=1&_reqid=${STORE_RPC_REQID}`;
}

function parseStoreRpcResponse(body: string): JsonValue | null {
  const input = JSON.parse(body.substring(5)) as JsonValue;
  const row = Array.isArray(input) && Array.isArray(input[0]) ? input[0] : undefined;
  const rawData = Array.isArray(row) ? row[2] : undefined;
  if (typeof rawData !== 'string') return null;
  return JSON.parse(rawData) as JsonValue;
}

function extractStoreResultsFromDs4(data: JsonValue) {
  return extractStoreResults({ 'ds:4': data } as unknown as JsonValue);
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
    summary: sanitizeSummary(asString(scriptData.getPathValue(data, [13, 1]))),
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
    summary: sanitizeSummary(
      asString(scriptData.getPathValue(node, [73, 0, 1])) ??
        asString(scriptData.getPathValue(node, [72, 0, 1]))
    ),
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
      if (!token) {
        const candidateToken = scriptData.getPathValue(cluster, [22, 1, 3, 1]);
        if (typeof candidateToken === 'string' && candidateToken.trim()) {
          token = candidateToken;
        }
      }

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

  return { apps: dedupeByAppId([...singles, ...listApps]), token };
}

async function initialStoreRequest(opts: SearchState) {
  const url = `${BASE_URL}/store/search?q=${opts.term}&hl=${opts.lang}&gl=${opts.country}&price=${opts.price}&c=apps`;
  const html = await request({ url, method: 'GET', headers: opts.requestOptions?.headers, country: opts.country });
  return processStoreFirstPage(html, opts);
}

async function processStoreFirstPage(html: string | JsonValue, opts: SearchState): Promise<AppListItem[]> {
  const parsed = typeof html === 'string' ? scriptData.parse(html) : html;
  const { apps: firstPageApps } = extractStoreResults(parsed);
  if (firstPageApps.length >= opts.num) return firstPageApps.slice(0, opts.num);
  if (typeof html !== 'string') return firstPageApps.slice(0, opts.num);

  const requestDescriptor = getStoreRequestDescriptor(parsed);
  if (!requestDescriptor) return firstPageApps.slice(0, opts.num);
  const pageSize = clampStoreRequestSize(opts.num);
  if (!setStoreRequestSize(requestDescriptor, pageSize)) return firstPageApps.slice(0, opts.num);

  const url = buildStoreRpcUrl(opts, html);
  const body = buildStoreRpcBody(requestDescriptor);
  const headers = Object.assign(
    { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    opts.requestOptions?.headers ?? {}
  );

  try {
    const rpcHtml = await request({ url, method: 'POST', headers, body, country: opts.country });
    const rpcData = parseStoreRpcResponse(rpcHtml);
    if (rpcData === null) return firstPageApps.slice(0, opts.num);
    const { apps: rpcApps } = extractStoreResultsFromDs4(rpcData);
    const merged = dedupeByAppId([...firstPageApps, ...rpcApps]);
    return merged.slice(0, opts.num);
  } catch {
    return firstPageApps.slice(0, opts.num);
  }
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

export async function searchGlobal(
  appFetcher: (args: AppOptions) => Promise<unknown>,
  opts: SearchOptions
) {
  const state = normalizeSearchOptions(opts);
  const results = await initialGlobalRequest(state);
  if (state.fullDetail) return fetchFullDetailResults(appFetcher, results, state);
  return results;
}

export async function search(
  appFetcher: (args: AppOptions) => Promise<unknown>,
  opts: SearchOptions
) {
  const state = normalizeSearchOptions(opts);
  const results = await initialStoreRequest(state);
  if (state.fullDetail) return fetchFullDetailResults(appFetcher, results, state);
  return results;
}

export default search;
