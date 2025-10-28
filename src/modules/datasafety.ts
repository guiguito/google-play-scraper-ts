import { BASE_URL } from '../constants';
import { request } from '../http/client';
import * as scriptData from '../utils/scriptData';
import type { JsonValue } from '../types';

export interface DataSafetyOptions { appId: string; lang?: string; country?: string }

export async function datasafety(opts: DataSafetyOptions) {
  if (!opts || !opts.appId) throw new Error('appId missing');
  const PLAYSTORE_URL = `${BASE_URL}/store/apps/datasafety`;
  const searchParams = new URLSearchParams({ id: opts.appId, hl: opts.lang || 'en' });
  const reqUrl = `${PLAYSTORE_URL}?${searchParams}`;
  const html = await request({ url: reqUrl, method: 'GET', country: opts.country });
  const parsed = scriptData.parse(html);
  const mapped = scriptData.extractor(MAPPINGS)(parsed);
  return mapped;
}

const MAPPINGS = {
  sharedData: { path: ['ds:3', 1, 2, 137, 4, 0, 0], fun: mapDataEntries },
  collectedData: { path: ['ds:3', 1, 2, 137, 4, 1, 0], fun: mapDataEntries },
  securityPractices: { path: ['ds:3', 1, 2, 137, 9, 2], fun: mapSecurityPractices },
  privacyPolicyUrl: ['ds:3', 1, 2, 99, 0, 5, 2],
} satisfies scriptData.GenericMappings;

function mapSecurityPractices(practices: JsonValue | undefined) {
  if (!Array.isArray(practices)) return [] as Array<{ practice?: string; description?: string }>;
  return practices.map((practice) => {
    if (!Array.isArray(practice)) return { practice: undefined, description: undefined };
    const practiceName = scriptData.getPathValue(practice, [1]);
    const description = scriptData.getPathValue(practice, [2, 1]);
    return {
      practice: typeof practiceName === 'string' ? practiceName : undefined,
      description: typeof description === 'string' ? description : undefined,
    };
  });
}

function mapDataEntries(dataEntries: JsonValue | undefined) {
  if (!Array.isArray(dataEntries)) return [] as Array<{ data?: string; optional?: JsonValue; purpose?: JsonValue; type?: JsonValue }>;
  return dataEntries.flatMap((entry) => {
    if (!Array.isArray(entry)) return [];
    const type = scriptData.getPathValue(entry, [0, 1]);
    const details = scriptData.getPathValue(entry, [4]);
    if (!Array.isArray(details)) return [];
    return details
      .map((detail) => ({
        data: typeof scriptData.getPathValue(detail, [0]) === 'string' ? (scriptData.getPathValue(detail, [0]) as string) : undefined,
        optional: scriptData.getPathValue(detail, [1]),
        purpose: scriptData.getPathValue(detail, [2]),
        type,
      }));
  });
}

export default datasafety;
