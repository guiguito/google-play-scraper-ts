import { BASE_URL } from '../constants';
import { extractor, getPathValue, type MappingSpec } from './scriptData';
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

function asString(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: JsonValue | undefined): number | undefined {
  return typeof value === 'number' ? value : undefined;
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

type AppListMappings = { [K in keyof AppListItem]: MappingSpec<AppListItem[K]> };

const APP_MAPPINGS: AppListMappings = {
  title: { path: [2], fun: asString },
  appId: { path: [12, 0], fun: asString },
  url: {
    path: [9, 4, 2],
    fun: (path) => (typeof path === 'string' ? new URL(path, BASE_URL).toString() : undefined),
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
  summary: { path: [4, 1, 1, 1, 1], fun: asString },
  scoreText: { path: [6, 0, 2, 1, 0], fun: asString },
  score: { path: [6, 0, 2, 1, 1], fun: asNumber },
};

const mapApp = extractor<AppListItem>(APP_MAPPINGS);

export function extract(root: ReadonlyArray<string | number>, data: JsonValue): AppListItem[] {
  const input = getPathValue(data, root);
  if (!Array.isArray(input)) return [];
  return input.map((item) => mapApp(item));
}

export default { MAPPINGS: APP_MAPPINGS, extract };
