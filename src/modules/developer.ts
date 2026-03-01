import { BASE_URL } from '../constants';
import { request } from '../http/client';
import * as scriptData from '../utils/scriptData';
import { checkFinished } from '../utils/processPages';
import helper from '../utils/mappingHelpers';
import { hydrateMissingSummaries } from '../utils/hydrateMissingSummaries';
import type { JsonValue } from '../types';
import type { AppListItem } from '../utils/appList';

function buildUrl(opts: { lang: string; devId: string; country: string }) {
  const base = `${BASE_URL}/store/apps`;
  const path = Number.isNaN(Number(opts.devId)) ? '/developer' : '/dev';
  const qs = new URLSearchParams({ id: opts.devId, hl: opts.lang, gl: opts.country }).toString();
  return `${base}${path}?${qs}`;
}

export interface DeveloperOptions {
  devId: string;
  lang?: string;
  country?: string;
  num?: number;
  fullDetail?: boolean;
}

export async function developer(opts: DeveloperOptions) {
  if (!opts.devId) throw new Error('devId missing');
  const merged = Object.assign({ num: 60, lang: 'en', country: 'us' }, opts);
  const url = buildUrl(merged);
  const html = await request({ url, method: 'GET', country: merged.country });
  const parsed = scriptData.parse(html);
  return parseDeveloperApps(parsed, { ...merged, fullDetail: !!merged.fullDetail });
}

const TEXT_MAPPINGS = {
  title: { path: [0, 3], fun: asString },
  appId: { path: [0, 0, 0], fun: asString },
  url: { path: [0, 10, 4, 2], fun: toAbsoluteUrl },
  icon: { path: [0, 1, 3, 2], fun: asString },
  developer: { path: [0, 14], fun: asString },
  currency: { path: [0, 8, 1, 0, 1], fun: asString },
  price: { path: [0, 8, 1, 0, 0], fun: microToPrice },
  free: { path: [0, 8, 1, 0, 0], fun: isFreePrice },
  summary: { path: [0, 13], fun: helper.summaryText },
  scoreText: { path: [0, 4, 0], fun: asString },
  score: { path: [0, 4, 1], fun: asNumber },
} satisfies scriptData.GenericMappings;

const NUMERIC_MAPPINGS = {
  title: { path: [3], fun: asString },
  appId: { path: [0, 0], fun: asString },
  url: { path: [10, 4, 2], fun: toAbsoluteUrl },
  icon: { path: [1, 3, 2], fun: asString },
  developer: { path: [14], fun: asString },
  currency: { path: [8, 1, 0, 1], fun: asString },
  price: { path: [8, 1, 0, 0], fun: microToPrice },
  free: { path: [8, 1, 0, 0], fun: isFreePrice },
  summary: { path: [13], fun: helper.summaryText },
  scoreText: { path: [4, 0], fun: asString },
  score: { path: [4, 1], fun: asNumber },
} satisfies scriptData.GenericMappings;

function asString(value: JsonValue | undefined) {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: JsonValue | undefined) {
  return typeof value === 'number' ? value : undefined;
}

function toAbsoluteUrl(path: JsonValue | undefined) {
  return typeof path === 'string' ? new URL(path, BASE_URL).toString() : undefined;
}

function microToPrice(value: JsonValue | undefined) {
  return typeof value === 'number' ? value / 1_000_000 : 0;
}

function isFreePrice(value: JsonValue | undefined) {
  return value === 0;
}

async function parseDeveloperApps(html: JsonValue, opts: { devId: string; num: number; lang: string; country: string; fullDetail?: boolean }) {
  const parsed = typeof html === 'string' ? scriptData.parse(html) : html;
  const usesTextId = Number.isNaN(Number(opts.devId));
  const initialMappings = usesTextId
    ? { apps: ['ds:3', 0, 1, 0, 22, 0] as const, token: ['ds:3', 0, 1, 0, 22, 1, 3, 1] as const }
    : { apps: ['ds:3', 0, 1, 0, 21, 0] as const, token: ['ds:3', 0, 1, 0, 21, 1, 3, 1] as const };

  const appMappings = usesTextId ? TEXT_MAPPINGS : NUMERIC_MAPPINGS;
  const mapApp = scriptData.extractor<AppListItem>(appMappings);
  const appsSection = scriptData.getPathValue(parsed, initialMappings.apps);
  const processedApps = Array.isArray(appsSection) ? appsSection.map((entry) => mapApp(entry)) : [];
  const tokenValue = scriptData.getPathValue(parsed, initialMappings.token);
  const token = typeof tokenValue === 'string' ? tokenValue : undefined;
  const apps = await checkFinished(
    { num: opts.num, numberOfApps: opts.num, fullDetail: opts.fullDetail, lang: opts.lang, country: opts.country },
    processedApps,
    token
  );
  if (opts.fullDetail) return apps;
  const fetchDetails = async ({ appId, lang, country }: { appId: string; lang: string; country: string }) => {
    const { app } = await import('./app');
    return app({ appId, lang, country });
  };
  return hydrateMissingSummaries(apps, { lang: opts.lang, country: opts.country }, fetchDetails);
}

export default developer;
