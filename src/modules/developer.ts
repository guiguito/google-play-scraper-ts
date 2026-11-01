import { BASE_URL } from '../constants';
import { ValidationError } from '../errors';
import { request } from '../http/client';
import { app } from './app';
import * as scriptData from '../utils/scriptData';
import { checkFinished } from '../utils/processPages';
import { fetchFullDetails, hydrateMissingSummaries } from '../utils/hydrateMissingSummaries';
import type { AppDetails, JsonValue } from '../types';
import { cardMappings, type AppListItem } from '../utils/appList';

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
  /** Extra HTTP headers for every request this call makes (including app() fan-outs). */
  requestOptions?: { headers?: Record<string, string> };
  /** Set to false to skip the extra app() request per entry that lacks a summary. Default true. */
  backfillSummaries?: boolean;
}

export async function developer(opts: DeveloperOptions): Promise<AppListItem[] | AppDetails[]> {
  if (!opts.devId) throw new ValidationError('devId missing');
  const merged = { ...opts, num: opts.num ?? 60, lang: opts.lang ?? 'en', country: opts.country ?? 'us' };
  const url = buildUrl(merged);
  const html = await request({ url, method: 'GET', headers: opts.requestOptions?.headers, country: merged.country });
  const parsed = scriptData.parse(html);
  return parseDeveloperApps(parsed, merged);
}










async function parseDeveloperApps(html: JsonValue, opts: DeveloperOptions & { num: number; lang: string; country: string }) {
  const parsed = typeof html === 'string' ? scriptData.parse(html) : html;
  const usesTextId = Number.isNaN(Number(opts.devId));
  const initialMappings = usesTextId
    ? { apps: ['ds:3', 0, 1, 0, 22, 0] as const, token: ['ds:3', 0, 1, 0, 22, 1, 3, 1] as const }
    : { apps: ['ds:3', 0, 1, 0, 21, 0] as const, token: ['ds:3', 0, 1, 0, 21, 1, 3, 1] as const };

  const appMappings = cardMappings(usesTextId ? [0] : []);
  const mapApp = scriptData.extractor<AppListItem>(appMappings);
  const appsSection = scriptData.getPathValue(parsed, initialMappings.apps);
  const processedApps = Array.isArray(appsSection) ? appsSection.map((entry) => mapApp(entry)) : [];
  const tokenValue = scriptData.getPathValue(parsed, initialMappings.token);
  const token = typeof tokenValue === 'string' ? tokenValue : undefined;
  const apps = await checkFinished(
    { num: opts.num, numberOfApps: opts.num, lang: opts.lang, country: opts.country, requestOptions: opts.requestOptions },
    processedApps,
    token
  );
  if (opts.fullDetail) return fetchFullDetails(apps, opts, app);
  return hydrateMissingSummaries(apps, opts, app);
}

export default developer;
