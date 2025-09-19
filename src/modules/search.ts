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

const INITIAL_MAPPINGS = {
  apps: ['ds:1', 0, 1, 0, 0, 0] as const,
  sections: ['ds:1', 0, 1, 0, 0] as const,
};

const SECTIONS_MAPPING = {
  token: [1] as const,
};

function asString(value: JsonValue | undefined) {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: JsonValue | undefined) {
  return typeof value === 'number' ? value : undefined;
}

const APP_MAPPINGS = {
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

const mapSearchApp = scriptData.extractor<AppListItem>(APP_MAPPINGS);

async function initialRequest(opts: SearchState) {
  const url = `${BASE_URL}/work/search?q=${opts.term}&hl=${opts.lang}&gl=${opts.country}&price=${opts.price}`;
  const html = await request({ url, method: 'GET', headers: opts.requestOptions?.headers });
  return processFirstPage(html, opts, [], INITIAL_MAPPINGS);
}

function isTokenSection(section: JsonValue | undefined) {
  const token = scriptData.getPathValue(section ?? null, SECTIONS_MAPPING.token);
  return typeof token === 'string';
}

async function processFirstPage(
  html: string | JsonValue,
  opts: SearchState,
  savedApps: AppListItem[],
  mappings: typeof INITIAL_MAPPINGS
): Promise<AppListItem[]> {
  const parsed = typeof html === 'string' ? scriptData.parse(html) : html;
  const sections = scriptData.getPathValue(parsed, mappings.sections);
  if (!Array.isArray(sections)) return [];
  const tokenSection = sections.find((section) => isTokenSection(section));
  const appsSection = scriptData.getPathValue(parsed, mappings.apps);
  const processedApps = Array.isArray(appsSection) ? appsSection.map((app) => mapSearchApp(app)) : [];
  const tokenValue = tokenSection ? scriptData.getPathValue(tokenSection, SECTIONS_MAPPING.token) : undefined;
  const token = typeof tokenValue === 'string' ? tokenValue : undefined;
  const results = [...savedApps, ...processedApps];
  return checkFinished(
    { num: opts.num, numberOfApps: opts.num, fullDetail: opts.fullDetail, lang: opts.lang, country: opts.country },
    results,
    token
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
  appFetcher: (args: AppOptions) => Promise<unknown>,
  opts: SearchOptions
) {
  if (!opts || !opts.term) throw new Error('Search term missing');
  if (opts.num && opts.num > 250) throw new Error("The number of results can't exceed 250");

  const merged: SearchState = {
    term: encodeURIComponent(opts.term),
    lang: opts.lang || 'en',
    country: opts.country || 'us',
    num: opts.num || 20,
    fullDetail: opts.fullDetail,
    price: opts.price ? getPriceGoogleValue(opts.price) : 0,
    requestOptions: opts.requestOptions,
  };

  const results = await initialRequest(merged);
  if (merged.fullDetail) {
    return Promise.all(
      results
        .filter((item): item is AppListItem & { appId: string } => typeof item.appId === 'string')
        .map((item) => appFetcher({ appId: item.appId, lang: merged.lang, country: merged.country }))
    );
  }
  return results;
}

export default search;
