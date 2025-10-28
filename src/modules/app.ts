import { BASE_URL } from '../constants';
import { extractor, type GenericMappings } from '../utils/scriptData';
import helper from '../utils/mappingHelpers';
import { request } from '../http/client';
import type { JsonValue } from '../types';

export interface AppOptions {
  appId: string;
  lang?: string; // e.g., 'en'
  country?: string; // e.g., 'us'
  requestOptions?: { headers?: Record<string, string> };
}

export async function app(opts: AppOptions) {
  if (!opts || !opts.appId) {
    throw new Error('appId missing');
  }
  const lang = opts.lang ?? 'en';
  const country = opts.country ?? 'us';
  const params = new URLSearchParams({ id: opts.appId, hl: lang, gl: country });
  const reqUrl = `${BASE_URL}/store/apps/details?${params.toString()}`;

  const html = await request({ url: reqUrl, method: 'GET', headers: opts.requestOptions?.headers, country });
  const parse = (await import('../utils/scriptData')).default.parse; // avoid cycle
  const data = parse(html);
  const mapped = extractor(MAPPINGS)(data);
  return {
    ...mapped,
    appId: opts.appId,
    url: reqUrl,
  };
}

function asString(value: JsonValue | undefined) {
  return typeof value === 'string' ? value : undefined;
}

const MAPPINGS: GenericMappings = {
  title: ['ds:5', 1, 2, 0, 0],
  description: {
    path: ['ds:5', 1, 2],
    fun: (val) => helper.descriptionText(helper.descriptionHtmlLocalized(val)),
  },
  descriptionHTML: {
    path: ['ds:5', 1, 2],
    fun: helper.descriptionHtmlLocalized,
  },
  summary: ['ds:5', 1, 2, 73, 0, 1],
  installs: ['ds:5', 1, 2, 13, 0],
  minInstalls: ['ds:5', 1, 2, 13, 1],
  maxInstalls: ['ds:5', 1, 2, 13, 2],
  score: ['ds:5', 1, 2, 51, 0, 1],
  scoreText: ['ds:5', 1, 2, 51, 0, 0],
  ratings: ['ds:5', 1, 2, 51, 2, 1],
  reviews: ['ds:5', 1, 2, 51, 3, 1],
  histogram: {
    path: ['ds:5', 1, 2, 51, 1],
    fun: helper.buildHistogram,
  },
  price: {
    path: ['ds:5', 1, 2, 57, 0, 0, 0, 0, 1, 0, 0],
    fun: (val) => (typeof val === 'number' ? val / 1_000_000 : 0),
  },
  originalPrice: {
    path: ['ds:5', 1, 2, 57, 0, 0, 0, 0, 1, 1, 0],
    fun: (price) => (typeof price === 'number' ? price / 1_000_000 : undefined),
  },
  discountEndDate: ['ds:5', 1, 2, 57, 0, 0, 0, 0, 14, 1],
  free: {
    path: ['ds:5', 1, 2, 57, 0, 0, 0, 0, 1, 0, 0],
    fun: (val) => val === 0,
  },
  currency: ['ds:5', 1, 2, 57, 0, 0, 0, 0, 1, 0, 1],
  priceText: {
    path: ['ds:5', 1, 2, 57, 0, 0, 0, 0, 1, 0, 2],
    fun: (priceText) => helper.priceText(typeof priceText === 'string' ? priceText : undefined),
  },
  available: { path: ['ds:5', 1, 2, 18, 0], fun: Boolean },
  offersIAP: { path: ['ds:5', 1, 2, 19, 0], fun: Boolean },
  IAPRange: ['ds:5', 1, 2, 19, 0],
  androidVersion: {
    path: ['ds:5', 1, 2, 140, 1, 1, 0, 0, 1],
    fun: (version) => helper.normalizeAndroidVersion(typeof version === 'string' ? version : undefined),
  },
  androidVersionText: {
    path: ['ds:5', 1, 2, 140, 1, 1, 0, 0, 1],
    fun: (version) => (typeof version === 'string' && version ? version : 'Varies with device'),
  },
  androidMaxVersion: {
    path: ['ds:5', 1, 2, 140, 1, 1, 0, 1, 1],
    fun: (version) => helper.normalizeAndroidVersion(typeof version === 'string' ? version : undefined),
  },
  developer: ['ds:5', 1, 2, 68, 0],
  developerId: {
    path: ['ds:5', 1, 2, 68, 1, 4, 2],
    fun: (devUrl) => (typeof devUrl === 'string' ? devUrl.split('id=')[1] : undefined),
  },
  developerEmail: ['ds:5', 1, 2, 69, 1, 0],
  developerWebsite: ['ds:5', 1, 2, 69, 0, 5, 2],
  developerAddress: ['ds:5', 1, 2, 69, 2, 0],
  developerLegalName: ['ds:5', 1, 2, 69, 4, 0],
  developerLegalEmail: ['ds:5', 1, 2, 69, 4, 1, 0],
  developerLegalAddress: {
    path: ['ds:5', 1, 2, 69],
    fun: (searchArray) => {
      if (!Array.isArray(searchArray)) return undefined;
      const container = searchArray[4];
      if (!Array.isArray(container)) return undefined;
      const detail = container[2];
      if (!Array.isArray(detail) || !Array.isArray(detail[0])) return undefined;
      const address = detail[0][0];
      return typeof address === 'string' ? address.replace(/\n/g, ', ') : undefined;
    },
  },
  developerLegalPhoneNumber: ['ds:5', 1, 2, 69, 4, 3],
  privacyPolicy: ['ds:5', 1, 2, 99, 0, 5, 2],
  developerInternalID: {
    path: ['ds:5', 1, 2, 68, 1, 4, 2],
    fun: (devUrl) => (typeof devUrl === 'string' ? devUrl.split('id=')[1] : undefined),
  },
  genre: ['ds:5', 1, 2, 79, 0, 0, 0],
  genreId: ['ds:5', 1, 2, 79, 0, 0, 2],
  categories: {
    path: ['ds:5', 1, 2],
    fun: (searchArray: JsonValue | undefined) => {
      if (!Array.isArray(searchArray)) return [] as Array<{ name: string; id: string }>;
      const categories = helper.extractCategories(searchArray[118]);
      if (categories.length === 0) {
        const fallback = searchArray[79];
        if (Array.isArray(fallback) && Array.isArray(fallback[0]) && Array.isArray(fallback[0][0])) {
          const fallbackEntry = fallback[0][0];
          const name = asString(fallbackEntry[0]);
          const id = asString(fallbackEntry[2]);
          if (name && id) categories.push({ name, id });
        }
      }
      return categories;
    },
  },
  icon: ['ds:5', 1, 2, 95, 0, 3, 2],
  headerImage: ['ds:5', 1, 2, 96, 0, 3, 2],
  screenshots: {
    path: ['ds:5', 1, 2, 78, 0],
    fun: (screenshots) => {
      if (!Array.isArray(screenshots)) return [] as string[];
      return screenshots
        .map((item) => {
          if (!Array.isArray(item)) return undefined;
          const third = item[3];
          if (!Array.isArray(third)) return undefined;
          const url = third[2];
          return typeof url === 'string' ? url : undefined;
        })
        .filter((url): url is string => typeof url === 'string');
    },
  },
  video: ['ds:5', 1, 2, 100, 0, 0, 3, 2],
  videoImage: ['ds:5', 1, 2, 100, 1, 0, 3, 2],
  previewVideo: ['ds:5', 1, 2, 100, 1, 2, 0, 2],
  contentRating: ['ds:5', 1, 2, 9, 0],
  contentRatingDescription: ['ds:5', 1, 2, 9, 2, 1],
  adSupported: { path: ['ds:5', 1, 2, 48], fun: Boolean },
  released: ['ds:5', 1, 2, 10, 0],
  updated: { path: ['ds:5', 1, 2, 145, 0, 1, 0], fun: (ts) => (typeof ts === 'number' ? ts * 1000 : undefined) },
  version: { path: ['ds:5', 1, 2, 140, 0, 0, 0], fun: (val) => (typeof val === 'string' && val ? val : 'VARY') },
  recentChanges: ['ds:5', 1, 2, 144, 1, 1],
  comments: { path: [], fun: helper.extractComments },
  preregister: { path: ['ds:5', 1, 2, 18, 0], fun: (val) => val === 1 },
  earlyAccessEnabled: { path: ['ds:5', 1, 2, 18, 2], fun: (val) => typeof val === 'string' },
  isAvailableInPlayPass: { path: ['ds:5', 1, 2, 62], fun: (field) => Boolean(field) },
} as const;

export default app;
