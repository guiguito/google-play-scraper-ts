import { BASE_URL } from '../constants';
import { request } from '../http/client';
import type { JsonValue } from '../types';

export interface SuggestOptions {
  term: string;
  lang?: string;
  country?: string;
  requestOptions?: { headers?: Record<string, string> };
}

export async function suggest(opts: SuggestOptions) {
  if (!opts || !opts.term) throw new Error('term missing');
  const lang = opts.lang || 'en';
  const country = opts.country || 'us';
  const url = `${BASE_URL}/_/PlayStoreUi/data/batchexecute?rpcids=IJ4APc&f.sid=-697906427155521722&bl=boq_playuiserver_20190903.08_p0&hl=${lang}&gl=${country}&authuser&soc-app=121&soc-platform=1&soc-device=1&_reqid=1065213`;
  const term = encodeURIComponent(opts.term);
  const body = `f.req=%5B%5B%5B%22IJ4APc%22%2C%22%5B%5Bnull%2C%5B%5C%22${term}%5C%22%5D%2C%5B10%5D%2C%5B2%5D%2C4%5D%5D%22%5D%5D%5D`;
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };
  const html = await request({ url, method: 'POST', body, headers });
  const input = JSON.parse(html.substring(5)) as JsonValue;
  const payload = Array.isArray(input) && Array.isArray(input[0]) ? input[0][2] : undefined;
  const data = typeof payload === 'string' ? (JSON.parse(payload) as JsonValue) : null;
  if (!Array.isArray(data)) return [];
  const suggestions = data[0];
  if (!Array.isArray(suggestions) || !Array.isArray(suggestions[0])) return [];
  return suggestions[0]
    .map((entry) => (Array.isArray(entry) && typeof entry[0] === 'string' ? entry[0] : undefined))
    .filter((value): value is string => typeof value === 'string');
}

export default suggest;
