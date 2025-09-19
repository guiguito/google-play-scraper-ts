import { BASE_URL } from '../constants';
import { request } from '../http/client';
import * as scriptData from '../utils/scriptData';
import { processPages, type ProcessMappings } from '../utils/processPages';
import type { JsonValue } from '../types';

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
  const qs = new URLSearchParams({ id: merged.appId, hl: 'en', gl: merged.country }).toString();
  const similarUrl = `${BASE_URL}/store/apps/details?${qs}`;
  const html = await request({ url: similarUrl, method: 'GET' });
  const parsed = scriptData.parse(html);
  return parseSimilarApps(parsed, merged);
}

async function parseSimilarApps(similarObject: JsonValue, opts: { appId: string; lang: string; country: string; fullDetail?: boolean }) {
  const clustersValue = scriptData.extractDataWithServiceRequestId(similarObject as scriptData.ParsedScriptData, INITIAL_MAPPINGS.clusters);
  const clusterSource = findClusterEntry(clustersValue);
  if (!clusterSource) throw new Error('Similar apps not found');
  const clusterUrl = getParsedCluster(clusterSource);
  if (!clusterUrl) throw new Error('Similar cluster URL not found');

  const fullClusterUrl = `${BASE_URL}${clusterUrl}&gl=${opts.country}&hl=${opts.lang}`;
  const html = await request({ url: fullClusterUrl, method: 'GET' });
  const parsed = scriptData.parse(html);
  return processPages(parsed, { num: 60, numberOfApps: 60, fullDetail: opts.fullDetail, lang: opts.lang, country: opts.country }, [], PAGE_MAPPINGS);
}

function isSimilarCluster(cluster: JsonValue | undefined) {
  const title = scriptData.getPathValue(cluster ?? null, CLUSTER_MAPPING.title);
  return title === SIMILAR_APPS || title === SIMILAR_GAMES;
}

function getParsedCluster(similarObject: JsonValue | undefined) {
  const url = scriptData.getPathValue(similarObject ?? null, CLUSTER_MAPPING.url);
  return typeof url === 'string' ? url : '';
}

function findClusterEntry(value: JsonValue | undefined): JsonValue | undefined {
  if (isSimilarCluster(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findClusterEntry(item);
      if (found) return found;
    }
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, JsonValue>)) {
      const found = findClusterEntry(item);
      if (found) return found;
    }
  }
  return undefined;
}

export default similar;
