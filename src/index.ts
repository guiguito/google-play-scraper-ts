import { constants } from './constants';
import { configureProxy as applyProxyConfig, type ProxySettings } from './http/proxyConfig';
import app from './modules/app';
import list from './modules/list';
import search, { type SearchOptions } from './modules/search';
import type { ListOptions } from './modules/list';
import type { DeveloperOptions } from './modules/developer';
import type { SimilarOptions } from './modules/similar';
import type { FullDetailFn } from './types';
import suggest from './modules/suggest';
import developer from './modules/developer';
import reviews from './modules/reviews';
import similar from './modules/similar';
import permissions from './modules/permissions';
import datasafety from './modules/datasafety';
import categories from './modules/categories';

export type { Constants } from './constants';
export { constants };
export { HttpError, NotFoundError, ParseError } from './errors';
export type {
  AppDetails,
  AppSummary,
  Review,
  PermissionItem,
  DataSafety,
  DataSafetyItem,
  FullDetailFn,
} from './types';
export type { AppOptions } from './modules/app';
export type { ListOptions, DeveloperOptions, SimilarOptions, SearchOptions };
export type { SuggestOptions } from './modules/suggest';
export type { ReviewsOptions } from './modules/reviews';
export type { PermissionsOptions } from './modules/permissions';
export type { DataSafetyOptions } from './modules/datasafety';

type MemoizeOptions = {
  maxAge?: number;
  max?: number;
};

const baseApi = {
  ...constants,
  app,
  list: list as FullDetailFn<ListOptions>,
  search: ((opts: SearchOptions) => search(app, opts)) as FullDetailFn<SearchOptions>,
  suggest,
  developer: developer as FullDetailFn<DeveloperOptions>,
  reviews,
  similar: similar as FullDetailFn<SimilarOptions>,
  permissions,
  datasafety,
  categories,
};

export type PlayStoreApi = typeof baseApi & { memoized: typeof memoized };

export type {
  ProxySettings,
  ProxyConfig,
  ProxyUrlDefinition,
  ProxyDefinition,
} from './http/proxyConfig';

export interface CreatePlayStoreApiOptions {
  proxies?: ProxySettings | null;
  memoize?: MemoizeOptions;
}

export function configureProxies(settings?: ProxySettings | null): void {
  applyProxyConfig(settings);
}

export function createPlayStoreApi(options?: CreatePlayStoreApiOptions): PlayStoreApi {
  // Proxy settings are process-wide; only replace them when the caller passes `proxies` (null clears).
  if (options && 'proxies' in options) applyProxyConfig(options.proxies);
  return options?.memoize ? memoized(options.memoize) : { ...baseApi, memoized };
}

export function memoized(_opts?: MemoizeOptions): PlayStoreApi {
  const cache = new Map<string, { t: number; v: unknown }>();
  const maxAge = _opts?.maxAge ?? 5 * 60 * 1000;
  const max = _opts?.max ?? 1000;
  // Typed as F so overloads (fullDetail, short) survive memoization.
  function m<F extends (...args: never[]) => Promise<unknown>>(fn: F): F {
    const call = fn as unknown as (...args: unknown[]) => Promise<unknown>;
    const wrapped = async (...args: unknown[]) => {
      const key = `${fn.name}:${JSON.stringify(args)}`;
      const now = Date.now();
      const hit = cache.get(key);
      if (hit && now - hit.t <= maxAge) return hit.v;
      const value = await call(...args);
      cache.set(key, { t: now, v: value });
      if (cache.size > max) {
        const it = cache.keys().next();
        if (!it.done) cache.delete(it.value as string);
      }
      return value;
    };
    return wrapped as unknown as F;
  }
  const mApp = m(app);
  const memoizedSearch = m(((opts: SearchOptions) => search(mApp, opts)) as FullDetailFn<SearchOptions>);
  return {
    ...constants,
    app: mApp,
    list: m(baseApi.list),
    search: memoizedSearch,
    suggest: m(suggest),
    developer: m(baseApi.developer),
    reviews: m(reviews),
    similar: m(baseApi.similar),
    permissions: m(permissions),
    datasafety: m(datasafety),
    categories: m(categories),
    memoized,
  };
}

export default { ...baseApi, memoized } as PlayStoreApi;
