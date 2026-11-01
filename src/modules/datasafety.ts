import { BASE_URL } from '../constants';
import { request } from '../http/client';
import * as scriptData from '../utils/scriptData';
import type { DataSafety, DataSafetyItem, JsonValue } from '../types';

export interface DataSafetyOptions {
  appId: string;
  lang?: string;
  /** Only used to pick a per-country proxy. */
  country?: string;
  /** Extra HTTP headers for every request this call makes (including app() fan-outs). */
  requestOptions?: { headers?: Record<string, string> };
}

export async function datasafety(opts: DataSafetyOptions): Promise<DataSafety> {
  if (!opts || !opts.appId) throw new Error('appId missing');
  const PLAYSTORE_URL = `${BASE_URL}/store/apps/datasafety`;
  const searchParams = new URLSearchParams({ id: opts.appId, hl: opts.lang || 'en' });
  const reqUrl = `${PLAYSTORE_URL}?${searchParams}`;
  const html = await request({ url: reqUrl, method: 'GET', headers: opts.requestOptions?.headers, country: opts.country });
  const parsed = scriptData.parse(html);
  const mapped = scriptData.extractor<DataSafety>(MAPPINGS)(parsed);
  return mapped;
}

const MAPPINGS = {
  sharedData: { path: ['ds:3', 1, 2, 137, 4, 0, 0], fun: mapDataEntries },
  collectedData: { path: ['ds:3', 1, 2, 137, 4, 1, 0], fun: mapDataEntries },
  securityPractices: { path: ['ds:3', 1, 2, 137, 9, 2], fun: mapSecurityPractices },
  privacyPolicyUrl: ['ds:3', 1, 2, 99, 0, 5, 2],
} satisfies Record<string, scriptData.MappingSpec<unknown>>;

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

function mapDataEntries(dataEntries: JsonValue | undefined): DataSafetyItem[] {
  if (!Array.isArray(dataEntries)) return [];
  return dataEntries.flatMap((entry) => {
    if (!Array.isArray(entry)) return [];
    const type = scriptData.getPathValue(entry, [0, 1]);
    const details = scriptData.getPathValue(entry, [4]);
    if (!Array.isArray(details)) return [];
    return details
      .map((detail) => {
        const data = scriptData.getPathValue(detail, [0]);
        const optional = scriptData.getPathValue(detail, [1]);
        const purpose = scriptData.getPathValue(detail, [2]);
        return {
          data: typeof data === 'string' ? data : undefined,
          optional: typeof optional === 'boolean' ? optional : null,
          purpose: typeof purpose === 'string' ? purpose : null,
          type: typeof type === 'string' ? type : undefined,
        };
      });
  });
}

export default datasafety;
