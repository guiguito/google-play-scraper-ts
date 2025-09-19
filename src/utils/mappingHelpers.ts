import * as cheerio from 'cheerio';
import { getPathValue } from './scriptData';
import type { JsonObject, JsonValue } from '../types';

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function descriptionHtmlLocalized(searchArray: JsonValue | undefined) {
  if (searchArray === undefined) return '';
  const translation = getPathValue(searchArray, [12, 0, 0, 1]);
  if (typeof translation === 'string') return translation;
  const original = getPathValue(searchArray, [72, 0, 1]);
  return typeof original === 'string' ? original : '';
}

export function descriptionText(description: string) {
  const html = cheerio.load('<div>' + description.replace(/<br>/g, '\r\n') + '</div>');
  return html('div').text();
}

export function priceText(priceText?: string) {
  return priceText || 'Free';
}

export function normalizeAndroidVersion(androidVersionText?: string) {
  if (!androidVersionText) return 'VARY';
  const number = androidVersionText.split(' ')[0];
  if (parseFloat(number)) return number;
  return 'VARY';
}

export function buildHistogram(container?: JsonValue) {
  const getBucketValue = (index: number): number => {
    if (!Array.isArray(container)) return 0;
    const bucket = container[index];
    if (!Array.isArray(bucket)) return 0;
    const value = bucket[1];
    return typeof value === 'number' ? value : 0;
  };
  return {
    1: getBucketValue(1),
    2: getBucketValue(2),
    3: getBucketValue(3),
    4: getBucketValue(4),
    5: getBucketValue(5),
  } as Record<number, number>;
}

export function extractComments(data: JsonValue | undefined) {
  if (data === undefined) return [] as string[];
  const sources = ['ds:8', 'ds:9'] as const;
  for (const path of sources) {
    const author = getPathValue(data, [path, 0, 0, 1, 0]);
    const version = getPathValue(data, [path, 0, 0, 10]);
    const date = getPathValue(data, [path, 0, 0, 5, 0]);
    if (author && version && date) {
      const comments = getPathValue(data, [path, 0]);
      if (Array.isArray(comments)) {
        return comments
          .map((comment) => getPathValue(comment, [4]))
          .filter((comment): comment is string => typeof comment === 'string')
          .slice(0, 5);
      }
    }
  }
  return [] as string[];
}

export function extractFeatures(featuresArray: JsonValue | undefined) {
  if (!Array.isArray(featuresArray)) return [] as Array<{ title: string | undefined; description: string | undefined }>;
  const [, , maybeFeatures] = featuresArray;
  if (!Array.isArray(maybeFeatures)) return [];
  return maybeFeatures.map((feature) => {
    const title = Array.isArray(feature) && typeof feature[0] === 'string' ? feature[0] : undefined;
    const descriptionValue = getPathValue(feature, [1, 0, 0, 1]);
    return {
      title,
      description: typeof descriptionValue === 'string' ? descriptionValue : undefined,
    };
  });
}

type Category = { name: string; id: string };

export function extractCategories(searchArray: JsonValue | undefined, categories: Category[] = []): Category[] {
  if (searchArray == null) return categories;
  if (Array.isArray(searchArray)) {
    if (searchArray.length >= 3 && typeof searchArray[0] === 'string' && typeof searchArray[2] === 'string') {
      categories.push({ name: searchArray[0], id: searchArray[2] });
      return categories;
    }
    searchArray.forEach((sub) => extractCategories(sub, categories));
    return categories;
  }
  if (isJsonObject(searchArray)) {
    Object.values(searchArray).forEach((value) => extractCategories(value, categories));
  }
  return categories;
}

export default {
  descriptionHtmlLocalized,
  descriptionText,
  priceText,
  normalizeAndroidVersion,
  buildHistogram,
  extractComments,
  extractFeatures,
  extractCategories,
};
