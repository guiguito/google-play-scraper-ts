import { BASE_URL, constants } from '../constants';
import { request } from '../http/client';
import * as scriptData from '../utils/scriptData';
import type { JsonValue } from '../types';
import type { AppListItem } from '../utils/appList';

const CLUSTER_NAMES: Record<string, string> = {
  TOP_FREE: 'topselling_free',
  TOP_PAID: 'topselling_paid',
  GROSSING: 'topgrossing',
};

function getBodyForRequests(payload: { num: number; collection: string; category: string }) {
  const { num } = payload;
  const body = `f.req=%5B%5B%5B%22vyAe2%22%2C%22%5B%5Bnull%2C%5B%5B8%2C%5B20%2C${num}%5D%5D%2Ctrue%2Cnull%2C%5B64%2C1%2C195%2C71%2C8%2C72%2C9%2C10%2C11%2C139%2C12%2C16%2C145%2C148%2C150%2C151%2C152%2C27%2C30%2C31%2C96%2C32%2C34%2C163%2C100%2C165%2C104%2C169%2C108%2C110%2C113%2C55%2C56%2C57%2C122%5D%2C%5Bnull%2Cnull%2C%5B%5B%5Btrue%5D%2Cnull%2C%5B%5Bnull%2C%5B%5D%5D%5D%2Cnull%2Cnull%2Cnull%2Cnull%2C%5Bnull%2C2%5D%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B1%5D%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B1%5D%5D%2C%5Bnull%2C%5B%5Bnull%2C%5B%5D%5D%5D%5D%2C%5Bnull%2C%5B%5Bnull%2C%5B%5D%5D%5D%2Cnull%2C%5Btrue%5D%5D%2C%5Bnull%2C%5B%5Bnull%2C%5B%5D%5D%5D%5D%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B%5B%5Bnull%2C%5B%5D%5D%5D%5D%2C%5B%5B%5Bnull%2C%5B%5D%5D%5D%5D%5D%2C%5B%5B%5B%5B7%2C1%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C31%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C104%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D`;
  return body;
}

function buildInitialUrl(opts: { lang: string; country: string; age?: string }) {
  const params = new URLSearchParams({ hl: opts.lang, gl: opts.country });
  if (opts.age) params.set('age', opts.age);
  const base = `${BASE_URL}/_/PlayStoreUi/data/batchexecute?rpcids=vyAe2&source-path=%2Fstore%2Fapps&f.sid=-4178618388443751758&bl=boq_playuiserver_20220612.08_p0&authuser=0&soc-app=121&soc-platform=1&soc-device=1&_reqid=82003&rt=c`;
  return `${base}&${params.toString()}`;
}

export interface ListOptions {
  collection?: keyof typeof constants.collection;
  category?: keyof typeof constants.category | string;
  age?: keyof typeof constants.age | string;
  lang?: string;
  country?: string;
  num?: number;
  fullDetail?: boolean;
}

const APPS_MAPPINGS = {
  title: { path: [0, 3], fun: asString },
  appId: { path: [0, 0, 0], fun: asString },
  url: { path: [0, 10, 4, 2], fun: toAbsoluteUrl },
  icon: { path: [0, 1, 3, 2], fun: asString },
  developer: { path: [0, 14], fun: asString },
  currency: { path: [0, 8, 1, 0, 1], fun: asString },
  price: { path: [0, 8, 1, 0, 0], fun: microToPrice },
  free: { path: [0, 8, 1, 0, 0], fun: isFreePrice },
  summary: { path: [0, 13, 1], fun: asString },
  scoreText: { path: [0, 4, 0], fun: asString },
  score: { path: [0, 4, 1], fun: asNumber },
} satisfies scriptData.GenericMappings;

function asString(value: JsonValue | undefined) {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: JsonValue | undefined) {
  return typeof value === 'number' ? value : undefined;
}

function toAbsoluteUrl(path: JsonValue | undefined) {
  return typeof path === 'string' ? new URL(path, BASE_URL).toString() : undefined;
}

function microToPrice(value: JsonValue | undefined) {
  return typeof value === 'number' ? value / 1_000_000 : 0;
}

function isFreePrice(value: JsonValue | undefined) {
  return value === 0;
}

export async function list(opts: ListOptions) {
  const fullListOpts = Object.assign({ lang: 'en', country: 'us', num: 500 }, opts);

  const categoryValues = Object.values(constants.category) as string[];
  const collectionValues = Object.values(constants.collection) as string[];

  const category = (fullListOpts.category ?? constants.category.APPLICATION) as string;
  if (!categoryValues.includes(category)) {
    throw new Error(`Invalid category ${category}`);
  }
  const collection = (fullListOpts.collection ?? constants.collection.TOP_FREE) as string;
  if (!collectionValues.includes(collection)) {
    throw new Error(`Invalid collection ${collection}`);
  }

  const body = getBodyForRequests({ num: fullListOpts.num!, collection: CLUSTER_NAMES[collection], category });
  const url = buildInitialUrl(fullListOpts);
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };
  const html = await request({ url, method: 'POST', body, headers });
  const jsonLine = html.split('\n')[3];
  const parsedLine = JSON.parse(jsonLine) as JsonValue;
  const payload = Array.isArray(parsedLine) && Array.isArray(parsedLine[0]) ? parsedLine[0][2] : undefined;
  const data = typeof payload === 'string' ? (JSON.parse(payload) as JsonValue) : null;
  if (!data) return [] as AppListItem[];

  const appsPath = [0, 1, 0, 28, 0] as const;
  const appsSection = scriptData.getPathValue(data, appsPath);
  const mapApp = scriptData.extractor<AppListItem>(APPS_MAPPINGS);
  const processedApps = Array.isArray(appsSection) ? appsSection.map((entry) => mapApp(entry)) : [];

  if (fullListOpts.fullDetail) {
    const { app } = await import('./app');
    return Promise.all(
      processedApps
        .filter((item): item is AppListItem & { appId: string } => typeof item.appId === 'string')
        .map((item) => app({ appId: item.appId, lang: fullListOpts.lang!, country: fullListOpts.country! }))
    );
  }
  return processedApps;
}

export default list;
