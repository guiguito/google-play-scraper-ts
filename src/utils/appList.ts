import { BASE_URL } from '../constants';
import { extractor, getPathValue, type MappingSpec } from './scriptData';
import helper from './mappingHelpers';
import type { JsonValue } from '../types';

export interface AppListItem {
  title?: string;
  appId?: string;
  url?: string;
  icon?: string;
  developer?: string;
  developerId?: string;
  priceText?: string;
  currency?: string;
  price?: number;
  free?: boolean;
  summary?: string;
  scoreText?: string;
  score?: number;
}

export function asString(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function asNumber(value: JsonValue | undefined): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export function toAbsoluteUrl(path: JsonValue | undefined): string | undefined {
  return typeof path === 'string' ? new URL(path, BASE_URL).toString() : undefined;
}

function microToPrice(value: JsonValue | undefined): number {
  return typeof value === 'number' ? value / 1_000_000 : 0;
}

/** App card shape used by list, developer and similar pages; `prefix` is where the card sits in each entry. */
export function cardMappings(prefix: number[] = []): Omit<AppListMappings, 'developerId' | 'priceText'> {
  const at = (...path: number[]) => [...prefix, ...path];
  return {
    title: { path: at(3), fun: asString },
    appId: { path: at(0, 0), fun: asString },
    url: { path: at(10, 4, 2), fun: toAbsoluteUrl },
    icon: { path: at(1, 3, 2), fun: asString },
    developer: { path: at(14), fun: asString },
    currency: { path: at(8, 1, 0, 1), fun: asString },
    price: { path: at(8, 1, 0, 0), fun: microToPrice },
    free: { path: at(8, 1, 0, 0), fun: (value) => value === 0 },
    summary: { path: at(13), fun: helper.summaryText },
    scoreText: { path: at(4, 0), fun: asString },
    score: { path: at(4, 1), fun: asNumber },
  };
}

function parsePrice(value: JsonValue | undefined): number {
  if (typeof value === 'number') return value / 1_000_000;
  if (typeof value === 'string') {
    const match = value.match(/([0-9.,]+)/);
    return match ? parseFloat(match[1]) : 0;
  }
  return 0;
}

function extractDeveloperId(link: JsonValue | undefined) {
  return typeof link === 'string' ? link.split('?id=')[1] : undefined;
}

type AppListMappings = { [K in keyof AppListItem]-?: MappingSpec<AppListItem[K]> };

const APP_MAPPINGS: AppListMappings = {
  title: { path: [2], fun: asString },
  appId: { path: [12, 0], fun: asString },
  url: {
    path: [9, 4, 2],
    fun: toAbsoluteUrl,
  },
  icon: { path: [1, 1, 0, 3, 2], fun: asString },
  developer: { path: [4, 0, 0, 0], fun: asString },
  developerId: { path: [4, 0, 0, 1, 4, 2], fun: extractDeveloperId },
  priceText: {
    path: [7, 0, 3, 2, 1, 0, 2],
    fun: (price) => (typeof price === 'string' ? price : 'FREE'),
  },
  currency: { path: [7, 0, 3, 2, 1, 0, 1], fun: asString },
  price: {
    path: [7, 0, 3, 2, 1, 0, 2],
    fun: (price) => parsePrice(price),
  },
  free: {
    path: [7, 0, 3, 2, 1, 0, 2],
    fun: (price) => price === undefined,
  },
  summary: { path: [4, 1, 1, 1], fun: helper.summaryText },
  scoreText: { path: [6, 0, 2, 1, 0], fun: asString },
  score: { path: [6, 0, 2, 1, 1], fun: asNumber },
};

const mapApp = extractor<AppListItem>(APP_MAPPINGS);

export function extract(root: ReadonlyArray<string | number>, data: JsonValue): AppListItem[] {
  const input = getPathValue(data, root);
  if (!Array.isArray(input)) return [];
  return input.map((item) => mapApp(item));
}

export default { MAPPINGS: APP_MAPPINGS, extract, cardMappings };
