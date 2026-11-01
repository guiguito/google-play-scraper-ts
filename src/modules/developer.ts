import { BASE_URL } from '../constants';
import { request } from '../http/client';
import * as scriptData from '../utils/scriptData';
import { checkFinished } from '../utils/processPages';
import { hydrateMissingSummaries } from '../utils/hydrateMissingSummaries';
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
}

export async function developer(opts: DeveloperOptions): Promise<AppListItem[] | AppDetails[]> {
  if (!opts.devId) throw new Error('devId missing');
  const merged = { ...opts, num: opts.num ?? 60, lang: opts.lang ?? 'en', country: opts.country ?? 'us' };
  const url = buildUrl(merged);
  const html = await request({ url, method: 'GET', country: merged.country });
  const parsed = scriptData.parse(html);
  return parseDeveloperApps(parsed, { ...merged, fullDetail: !!merged.fullDetail });
}










async function parseDeveloperApps(html: JsonValue, opts: { devId: string; num: number; lang: string; country: string; fullDetail?: boolean }) {
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
    { num: opts.num, numberOfApps: opts.num, lang: opts.lang, country: opts.country },
    processedApps,
    token
  );
  const fetchDetails = async ({ appId, lang, country }: { appId: string; lang: string; country: string }) => {
    const { app } = await import('./app');
    return app({ appId, lang, country });
  };
  if (opts.fullDetail) {
    return Promise.all(
      apps
        .filter((item): item is AppListItem & { appId: string } => typeof item.appId === 'string')
        .map((item) => fetchDetails({ appId: item.appId, lang: opts.lang, country: opts.country }))
    );
  }
  return hydrateMissingSummaries(apps, { lang: opts.lang, country: opts.country }, fetchDetails);
}

export default developer;
