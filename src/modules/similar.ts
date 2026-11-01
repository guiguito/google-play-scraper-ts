import { BASE_URL } from '../constants';
import { ValidationError } from '../errors';
import { request } from '../http/client';
import { app } from './app';
import * as scriptData from '../utils/scriptData';
import { processPages, checkFinished, type ProcessMappings } from '../utils/processPages';
import appList, { cardMappings } from '../utils/appList';
import { fetchFullDetails, hydrateMissingSummaries } from '../utils/hydrateMissingSummaries';
import type { AppDetails, JsonValue } from '../types';
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
  /** Extra HTTP headers for every request this call makes (including app() fan-outs). */
  requestOptions?: { headers?: Record<string, string> };
  /** Set to false to skip the extra app() request per entry that lacks a summary. Default true. */
  backfillSummaries?: boolean;
}

export async function similar(opts: SimilarOptions): Promise<AppListItem[] | AppDetails[]> {
  if (!opts || !opts.appId) throw new ValidationError('appId missing');
  const merged = { ...opts, lang: opts.lang || 'en', country: opts.country || 'us' };
  const qs = new URLSearchParams({ id: merged.appId, hl: merged.lang, gl: merged.country }).toString();
  const similarUrl = `${BASE_URL}/store/apps/details?${qs}`;
  const html = await request({ url: similarUrl, method: 'GET', headers: opts.requestOptions?.headers, country: merged.country });
  const parsed = scriptData.parse(html);
  return parseSimilarApps(parsed, merged);
}

async function parseSimilarApps(
  similarObject: scriptData.ParsedScriptData,
  opts: SimilarOptions & { lang: string; country: string }
) {
  const clustersValue = scriptData.extractDataWithServiceRequestId(similarObject, INITIAL_MAPPINGS.clusters);
  // Play lists "More by <developer>" before the similar cluster, with localized titles. The developer's
  // name appears in that title in every language, so skip it; fall back to the first cluster otherwise.
  const developer = scriptData.getPathValue(similarObject as unknown as JsonValue, ['ds:5', 1, 2, 68, 0]);
  const pickCluster = (candidates: JsonValue[]) =>
    candidates.find((c) => {
      const title = scriptData.getPathValue(c, CLUSTER_MAPPING.title);
      return !(typeof developer === 'string' && typeof title === 'string' && title.includes(developer));
    }) ?? candidates[0];
  let clusterSource = pickCluster(collectClusters(clustersValue));
  if (!clusterSource) {
    clusterSource = pickCluster(collectClusters(similarObject as unknown as JsonValue));
  }
  /* istanbul ignore next */
  if (!clusterSource && process.env.GP_DEBUG) {
    // minimal debug breadcrumbs to help diagnose live site shape changes
    // avoid serializing entire parsed tree
    const serviceKeys = Object.keys(similarObject.serviceRequestData || {});
    console.warn('[similar] clustersValue:', !!clustersValue, 'serviceKeys:', serviceKeys.slice(0, 5));
  }
  if (!clusterSource) {
    // Fallback: extract any app cards directly from the details page payloads
    // ponytail: no cluster to page through, so cap at the 60 apps a cluster would give.
    const refined = extractAnyApps(similarObject).filter((a) => a.appId !== opts.appId).slice(0, 60);
    if (refined.length > 0) {
      if (opts.fullDetail) return fetchFullDetails(refined, opts, app);
      return hydrateMissingSummaries(refined, opts, app);
    }
    throw new Error('Similar apps not found');
  }
  const clusterUrl = getParsedCluster(clusterSource);
  if (!clusterUrl) throw new Error('Similar cluster URL not found');

  const fullClusterUrl = `${BASE_URL}${clusterUrl}&gl=${encodeURIComponent(opts.country)}&hl=${encodeURIComponent(opts.lang)}`;
  const html = await request({ url: fullClusterUrl, method: 'GET', headers: opts.requestOptions?.headers, country: opts.country });
  const parsed = scriptData.parse(html);

  // First cluster page has a different mapping than subsequent batchexecute pages.
  const firstPageApps = extractFirstPageApps(parsed);
  const apps = opts.fullDetail ? await fetchFullDetails(firstPageApps, opts, app) : firstPageApps;
  const tokenValue = scriptData.getPathValue(parsed, INITIAL_MAPPINGS.token);
  const token = typeof tokenValue === 'string' ? tokenValue : undefined;

  // Continue with batchexecute paging which uses appList mappings.
  const pageOpts = { num: 60, numberOfApps: 60, fullDetail: opts.fullDetail, lang: opts.lang, country: opts.country, requestOptions: opts.requestOptions };
  const paged = await checkFinished<AppListItem | AppDetails>(pageOpts, apps, token, app);
  if (opts.fullDetail) return paged as AppDetails[];
  return hydrateMissingSummaries(paged as AppListItem[], opts, app);
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

// Cluster pages use the plain card shape; some reuse the appList shape, so fill gaps from it.
const mapCard = scriptData.extractor<AppListItem>(cardMappings());
const mapListCard = scriptData.extractor<AppListItem>(appList.MAPPINGS);

function mapAnyCard(node: JsonValue): AppListItem {
  const card = Object.entries(mapCard(node)).filter(([, v]) => v !== undefined);
  return { ...mapListCard(node), ...Object.fromEntries(card) };
}

function extractFirstPageApps(parsed: JsonValue): AppListItem[] {
  const items = scriptData.getPathValue(parsed, INITIAL_MAPPINGS.apps);
  return Array.isArray(items) ? items.map(mapAnyCard) : [];
}

function extractAnyApps(parsed: JsonValue): AppListItem[] {
  const seen = new Set<string>();
  const results: AppListItem[] = [];
  let budget = 5000; // cap traversal to avoid runaway costs
  function consider(node: JsonValue) {
    const merged = mapAnyCard(node);
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

export default similar;
