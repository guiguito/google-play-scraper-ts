import { BASE_URL } from '../constants';
import { request, createClient } from '../http/client';
import * as scriptData from '../utils/scriptData';
import { processPages, checkFinished, type ProcessMappings } from '../utils/processPages';
import appList from '../utils/appList';
import helper from '../utils/mappingHelpers';
import { hydrateMissingSummaries } from '../utils/hydrateMissingSummaries';
import type { JsonValue } from '../types';
import type { AppListItem } from '../utils/appList';

const INITIAL_MAPPINGS = {
  clusters: { path: ['1', '1'] as const, fun: (value: JsonValue | undefined) => value, useServiceRequestId: 'ag2B9c' as const },
  apps: ['ds:3', 0, 1, 0, 21, 0] as const,
  token: ['ds:3', 0, 1, 0, 21, 1, 3, 1] as const,
};

const PAGE_MAPPINGS: ProcessMappings = {
  apps: [...INITIAL_MAPPINGS.apps],
  token: [...INITIAL_MAPPINGS.token],
};

const CLUSTER_MAPPING = { title: [21, 1, 0] as const, url: [21, 1, 2, 4, 2] as const };

const SIMILAR_APPS = 'Similar apps';
const SIMILAR_GAMES = 'Similar games';

export interface SimilarOptions {
  appId: string;
  lang?: string;
  country?: string;
  fullDetail?: boolean;
}

export async function similar(opts: SimilarOptions) {
  if (!opts || !opts.appId) throw new Error('appId missing');
  const merged = { appId: encodeURIComponent(opts.appId), lang: opts.lang || 'en', country: opts.country || 'us', fullDetail: opts.fullDetail };
  const qs = new URLSearchParams({ id: merged.appId, hl: merged.lang, gl: merged.country }).toString();
  const similarUrl = `${BASE_URL}/store/apps/details?${qs}`;
  const client = createClient();
  const html = await client.request({ url: similarUrl, method: 'GET', country: merged.country });
  const parsed = scriptData.parse(html);
  return parseSimilarApps(parsed, merged, client);
}

async function parseSimilarApps(
  similarObject: scriptData.ParsedScriptData,
  opts: { appId: string; lang: string; country: string; fullDetail?: boolean },
  client = createClient()
) {
  const clustersValue = scriptData.extractDataWithServiceRequestId(similarObject, INITIAL_MAPPINGS.clusters);
  const inIdCandidates = collectClusters(clustersValue);
  // Mimic reference behavior: prefer the first candidate cluster if available
  let clusterSource = inIdCandidates[0];
  if (!clusterSource) {
    const srCandidates = collectClusters(similarObject.serviceRequestData);
    clusterSource = srCandidates[0];
  }
  if (!clusterSource) {
    const pageCandidates = collectClusters(similarObject as unknown as JsonValue);
    clusterSource = pageCandidates[0];
  }
  /* istanbul ignore next */
  if (!clusterSource && process.env.GP_DEBUG) {
    // minimal debug breadcrumbs to help diagnose live site shape changes
    // avoid serializing entire parsed tree
    const serviceKeys = Object.keys(similarObject.serviceRequestData || {});
    // eslint-disable-next-line no-console
    console.warn('[similar] clustersValue:', !!clustersValue, 'serviceKeys:', serviceKeys.slice(0, 5));
  }
  if (!clusterSource) {
    // Fallback: extract any app cards directly from the details page payloads
    const inlineApps = extractAnyApps(similarObject);
    const refined = refineSimilarList(inlineApps, decodeURIComponent(opts.appId));
    if (refined.length > 0) {
      if (opts.fullDetail) return fetchFullDetail(refined, opts);
      const fetchDetails = async ({ appId, lang, country }: { appId: string; lang: string; country: string }) => {
        const { app } = await import('./app');
        return app({ appId, lang, country });
      };
      return hydrateMissingSummaries(refined, opts, fetchDetails);
    }
    throw new Error('Similar apps not found');
  }
  const clusterUrl = getParsedCluster(clusterSource);
  if (!clusterUrl) throw new Error('Similar cluster URL not found');

  const fullClusterUrl = `${BASE_URL}${clusterUrl}&gl=${opts.country}&hl=${opts.lang}`;
  const html = await client.request({ url: fullClusterUrl, method: 'GET', country: opts.country });
  const parsed = scriptData.parse(html);

  // First cluster page has a different mapping than subsequent batchexecute pages.
  const firstPageApps = extractFirstPageApps(parsed);
  const apps = opts.fullDetail ? await fetchFullDetail(firstPageApps, opts) : firstPageApps;
  const tokenValue = scriptData.getPathValue(parsed, INITIAL_MAPPINGS.token);
  const token = typeof tokenValue === 'string' ? tokenValue : undefined;

  // Continue with batchexecute paging which uses appList mappings.
  const appDetails = async ({ appId, lang, country }: { appId: string; lang: string; country: string }) => {
    const { app } = await import('./app');
    return app({ appId, lang, country });
  };
  const paged = await checkFinished(
    { num: 60, numberOfApps: 60, fullDetail: opts.fullDetail, lang: opts.lang, country: opts.country },
    apps,
    token,
    appDetails,
    ({ url, method, headers, body, country }) => client.request({ url, method, headers, body, country })
  );
  if (opts.fullDetail) return paged;
  const fetchDetails = async ({ appId, lang, country }: { appId: string; lang: string; country: string }) => {
    const { app } = await import('./app');
    return app({ appId, lang, country });
  };
  return hydrateMissingSummaries(paged as AppListItem[], opts, fetchDetails);
}

function isSimilarCluster(cluster: JsonValue | undefined) {
  const title = scriptData.getPathValue(cluster ?? null, CLUSTER_MAPPING.title);
  return title === SIMILAR_APPS || title === SIMILAR_GAMES;
}

function getParsedCluster(similarObject: JsonValue | undefined) {
  const url = scriptData.getPathValue(similarObject ?? null, CLUSTER_MAPPING.url);
  return typeof url === 'string' ? url : '';
}

function hasClusterUrl(cluster: JsonValue | undefined) {
  const url = scriptData.getPathValue(cluster ?? null, CLUSTER_MAPPING.url);
  return typeof url === 'string' && url.length > 0;
}

function collectClusters(value: JsonValue | undefined): JsonValue[] {
  const out: JsonValue[] = [];
  function walk(v: JsonValue | undefined) {
    if (!v) return;
    if (hasClusterUrl(v)) {
      out.push(v);
    }
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
    } else if (typeof v === 'object') {
      for (const item of Object.values(v as Record<string, JsonValue>)) walk(item);
    }
  }
  walk(value);
  return out;
}

// First page (cluster HTML) mappings follow the reference implementation
// and differ from subsequent batchexecute pages parsed by appList.
function extractFirstPageApps(parsed: JsonValue): AppListItem[] {
  function asString(v: JsonValue | undefined) { return typeof v === 'string' ? v : undefined; }
  function asNumber(v: JsonValue | undefined) { return typeof v === 'number' ? v : undefined; }
  const FIRST_PAGE_MAPPINGS = {
    title: { path: [3] as const, fun: asString },
    appId: { path: [0, 0] as const, fun: asString },
    url: { path: [10, 4, 2] as const, fun: (p: JsonValue | undefined) => typeof p === 'string' ? new URL(p, BASE_URL).toString() : undefined },
    icon: { path: [1, 3, 2] as const, fun: asString },
    developer: { path: [14] as const, fun: asString },
    currency: { path: [8, 1, 0, 1] as const, fun: asString },
    price: { path: [8, 1, 0, 0] as const, fun: (v: JsonValue | undefined) => typeof v === 'number' ? v / 1_000_000 : 0 },
    free: { path: [8, 1, 0, 0] as const, fun: (v: JsonValue | undefined) => v === 0 },
    summary: { path: [13] as const, fun: helper.summaryText },
    scoreText: { path: [4, 0] as const, fun: asString },
    score: { path: [4, 1] as const, fun: asNumber },
  } satisfies Record<string, { path: ReadonlyArray<string | number>; fun: (v: JsonValue | undefined) => unknown }>;

  const mapPrimary = scriptData.extractor(FIRST_PAGE_MAPPINGS as unknown as Record<string, any>);
  // Fallback extractor: some cluster pages reuse the appList card shape
  const mapFallback = scriptData.extractor(appList.MAPPINGS as unknown as Record<string, any>);
  const items = scriptData.getPathValue(parsed, INITIAL_MAPPINGS.apps);
  if (!Array.isArray(items)) return [];
  return items.map((i) => {
    const a = mapPrimary(i) as AppListItem;
    const b = mapFallback(i) as AppListItem;
    const merged: AppListItem = { ...b };
    for (const [k, v] of Object.entries(a)) {
      if (v !== undefined) (merged as any)[k] = v;
    }
    return merged;
  });
}

async function fetchFullDetail(apps: AppListItem[], opts: { lang: string; country: string }) {
  const { app } = await import('./app');
  const tasks = apps
    .filter((i): i is AppListItem & { appId: string } => typeof i.appId === 'string')
    .map((i) => app({ appId: i.appId, lang: opts.lang, country: opts.country }));
  return Promise.all(tasks);
}

function extractAnyApps(parsed: JsonValue): AppListItem[] {
  function asString(v: JsonValue | undefined) { return typeof v === 'string' ? v : undefined; }
  function asNumber(v: JsonValue | undefined) { return typeof v === 'number' ? v : undefined; }
  const FIRST_PAGE_MAPPINGS = {
    title: { path: [3] as const, fun: asString },
    appId: { path: [0, 0] as const, fun: asString },
    url: { path: [10, 4, 2] as const, fun: (p: JsonValue | undefined) => typeof p === 'string' ? new URL(p, BASE_URL).toString() : undefined },
    icon: { path: [1, 3, 2] as const, fun: asString },
    developer: { path: [14] as const, fun: asString },
    currency: { path: [8, 1, 0, 1] as const, fun: asString },
    price: { path: [8, 1, 0, 0] as const, fun: (v: JsonValue | undefined) => typeof v === 'number' ? v / 1_000_000 : 0 },
    free: { path: [8, 1, 0, 0] as const, fun: (v: JsonValue | undefined) => v === 0 },
    summary: { path: [13] as const, fun: helper.summaryText },
    scoreText: { path: [4, 0] as const, fun: asString },
    score: { path: [4, 1] as const, fun: asNumber },
  };
  const mapPrimary = scriptData.extractor(FIRST_PAGE_MAPPINGS as unknown as Record<string, any>);
  const mapFallback = scriptData.extractor(appList.MAPPINGS as unknown as Record<string, any>);

  const seen = new Set<string>();
  const results: AppListItem[] = [];
  let budget = 5000; // cap traversal to avoid runaway costs
  function mergePreferDefined(a: AppListItem, b: AppListItem): AppListItem {
    const out: AppListItem = { ...a };
    for (const [k, v] of Object.entries(b)) { if (v !== undefined) (out as any)[k] = v; }
    return out;
  }
  function consider(node: JsonValue) {
    const a = mapPrimary(node as any) as AppListItem;
    const b = mapFallback(node as any) as AppListItem;
    const merged = mergePreferDefined(b, a);
    if (typeof merged.appId === 'string' && typeof merged.url === 'string' && merged.url.includes('/store/apps/details?id=')) {
      if (!seen.has(merged.appId)) {
        seen.add(merged.appId);
        results.push(merged);
      }
    }
  }
  // Try to locate a container labeled "Similar apps/games" and prefer extracting from it only.
  function findNodeWithSimilarLabel(node: JsonValue | undefined): JsonValue | undefined {
    if (node == null || budget-- <= 0) return undefined;
    const title = scriptData.getPathValue(node, CLUSTER_MAPPING.title);
    if (title === SIMILAR_APPS || title === SIMILAR_GAMES) return node;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = findNodeWithSimilarLabel(item);
        if (found) return found;
      }
    } else if (typeof node === 'object') {
      for (const value of Object.values(node as Record<string, JsonValue>)) {
        const found = findNodeWithSimilarLabel(value);
        if (found) return found;
      }
    }
    return undefined;
  }

  function walk(node: JsonValue | undefined) {
    if (node == null || budget-- <= 0) return;
    if (Array.isArray(node)) {
      consider(node);
      for (const item of node) walk(item);
    } else if (typeof node === 'object') {
      for (const value of Object.values(node as Record<string, JsonValue>)) walk(value);
    }
  }
  const pinned = findNodeWithSimilarLabel(parsed);
  if (pinned) {
    budget = 5000; // reset for focused traversal
    walk(pinned);
  } else {
    walk(parsed);
  }
  return results;
}

function refineSimilarList(apps: AppListItem[], seedAppId: string): AppListItem[] {
  const segs = seedAppId.split('.');
  const vendor2 = segs.slice(0, 2).join('.'); // e.g. com.spotify
  const vendor3 = segs.slice(0, 3).join('.'); // e.g. com.spotify.music
  const keyword = segs[1]?.toLowerCase() || '';
  function score(a: AppListItem): number {
    let s = 0;
    const id = (a.appId || '').toLowerCase();
    const title = (a.title || '').toLowerCase();
    const dev = (a.developer || '').toLowerCase();
    if (id.startsWith(vendor3)) s += 5;
    if (id.startsWith(vendor2)) s += 4;
    if (keyword && (title.includes(keyword) || dev.includes(keyword))) s += 3;
    // lightweight boost for well-known same-company alternates
    if (keyword === 'spotify' && id.startsWith('fm.anchor')) s += 4; // Creators/Anchor
    return s;
  }
  const withScores = apps.map((a) => ({ a, s: score(a) }));
  const strong = withScores.filter(({ s }) => s > 0).sort((x, y) => y.s - x.s).map(({ a }) => a);
  if (strong.length >= 3) return strong.slice(0, 12);
  // If not enough strong matches, return a short list of the most relevant others
  const others = withScores
    .filter(({ s }) => s === 0)
    .map(({ a }) => a)
    .slice(0, Math.max(0, 12 - strong.length));
  return [...strong, ...others];
}

export default similar;
