import { BASE_URL } from '../constants';
import * as scriptData from './scriptData';
import appList from './appList';
import { request } from '../http/client';
import type { JsonValue } from '../types';
import type { AppListItem } from './appList';

type RequestExecutor = (args: {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  country?: string;
}) => Promise<string>;

export interface ProcessMappings {
  apps: ReadonlyArray<string | number>;
  token: ReadonlyArray<string | number>;
}

export interface PageOptions {
  num: number;
  numberOfApps: number;
  fullDetail?: boolean;
  lang: string;
  country: string;
  throttle?: { interval: number; limit: number };
  requestOptions?: { headers?: Record<string, string> };
}

export type AppDetailsFn<T> = (args: {
  appId: string;
  lang: string;
  country: string;
}) => Promise<T>;

export async function processPages<T = AppListItem>(
  html: string | JsonValue,
  opts: PageOptions,
  savedApps: T[],
  mappings: ProcessMappings,
  appDetails?: AppDetailsFn<T>
): Promise<T[]> {
  const parsed: JsonValue = typeof html === 'string' ? scriptData.parse(html) : html;

  const processedApps = appList.extract(mappings.apps, parsed);
  const apps = opts.fullDetail && appDetails
    ? await processFullDetailApps(processedApps, opts, appDetails)
    : (processedApps as unknown as T[]);

  const tokenValue = scriptData.getPathValue(parsed, mappings.token);
  const token = typeof tokenValue === 'string' ? tokenValue : undefined;
  return checkFinished(opts, [...savedApps, ...apps], token, appDetails);
}

async function processFullDetailApps<T>(apps: AppListItem[], opts: PageOptions, appDetails: AppDetailsFn<T>) {
  const tasks = apps
    .filter((app): app is AppListItem & { appId: string } => typeof app.appId === 'string')
    .map((app) => appDetails({ appId: app.appId, lang: opts.lang, country: opts.country }));
  return Promise.all(tasks);
}

const REQUEST_MAPPINGS: ProcessMappings = {
  apps: [0, 0, 0],
  token: [0, 0, 7, 1],
};

const MAX_BATCH_PAGE_SIZE = 200;

function getBodyForRequests({ numberOfApps = 100, withToken = '%token%' }) {
  const body = `f.req=%5B%5B%5B%22qnKhOb%22%2C%22%5B%5Bnull%2C%5B%5B10%2C%5B10%2C${numberOfApps}%5D%5D%2Ctrue%2Cnull%2C%5B96%2C27%2C4%2C8%2C57%2C30%2C110%2C79%2C11%2C16%2C49%2C1%2C3%2C9%2C12%2C104%2C55%2C56%2C51%2C10%2C34%2C77%5D%5D%2Cnull%2C%5C%22${withToken}%5C%22%5D%5D%22%2Cnull%2C%22generic%22%5D%5D%5D`;
  return body;
}

function getBatchPageSize(numberOfApps: number) {
  if (!Number.isFinite(numberOfApps) || numberOfApps < 1) return MAX_BATCH_PAGE_SIZE;
  return Math.min(Math.floor(numberOfApps), MAX_BATCH_PAGE_SIZE);
}

export async function checkFinished<T>(
  opts: PageOptions,
  savedApps: T[],
  nextToken: string | undefined,
  appDetails?: AppDetailsFn<T>,
  requester?: RequestExecutor
): Promise<T[]> {
  if (savedApps.length >= opts.num || !nextToken) {
    return savedApps.slice(0, opts.num);
  }

  const body = getBodyForRequests({ numberOfApps: getBatchPageSize(opts.numberOfApps), withToken: nextToken });
  const url = `${BASE_URL}/_/PlayStoreUi/data/batchexecute?rpcids=qnKhOb&f.sid=-697906427155521722&bl=boq_playuiserver_20190903.08_p0&hl=${opts.lang}&gl=${opts.country}&authuser&soc-app=121&soc-platform=1&soc-device=1&_reqid=1065213`;

  const headers = Object.assign(
    { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    opts.requestOptions?.headers ?? {}
  );

  const doRequest: RequestExecutor = requester
    ? requester
    : ({ url, method, headers, body, country }) => request({ url, method, headers, body, country: country ?? opts.country });

  const html = await doRequest({ url, method: 'POST', body, headers, country: opts.country });
  const input = JSON.parse(html.substring(5)) as JsonValue;
  const batchEntry = Array.isArray(input) && Array.isArray(input[0]) ? input[0] : undefined;
  const rawData = Array.isArray(batchEntry) ? batchEntry[2] : undefined;
  const data = typeof rawData === 'string' ? (JSON.parse(rawData) as JsonValue | null) : null;
  if (data === null) return savedApps;
  return processPages(data, opts, savedApps, REQUEST_MAPPINGS, appDetails);
}

export default { processPages };
