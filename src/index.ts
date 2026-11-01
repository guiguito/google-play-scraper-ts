import { constants } from './constants';
import { configureProxy as applyProxyConfig, type ProxySettings } from './http/proxyConfig';
import app from './modules/app';
import list from './modules/list';
import search, { type SearchOptions } from './modules/search';
import availability, { type AvailabilityOptions } from './modules/availability';
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
export { HttpError, NotFoundError, RateLimitError, BlockedError, ValidationError } from './errors';
export type {
  AppDetails,
  AppSummary,
  Review,
  PermissionItem,
  DataSafety,
  DataSafetyItem,
  FullDetailFn,
  JsonValue,
  JsonPrimitive,
} from './types';
export type { AppOptions } from './modules/app';
export type { ListOptions, DeveloperOptions, SimilarOptions, SearchOptions };
export type { SuggestOptions } from './modules/suggest';
export type { ReviewsOptions } from './modules/reviews';
export type { PermissionsOptions } from './modules/permissions';
export type { DataSafetyOptions } from './modules/datasafety';
export type { AvailabilityOptions };

export type MemoizeOptions = {
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
  availability: (opts: AvailabilityOptions) => availability(app, opts),
};

export type PlayStoreApi = typeof baseApi & { memoized: typeof memoized };

export type {
  ProxySettings,
  ProxyConfig,
  ProxyUrlDefinition,
  ProxyDefinition,
  ProxyAuth,
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
  const cache = new Map<string, { t: number; v: Promise<unknown> }>();
  const maxAge = _opts?.maxAge ?? 5 * 60 * 1000;
  const max = _opts?.max ?? 1000;
  // Typed as F so overloads (fullDetail, short) survive memoization. Keyed by method name, not fn.name,
  // which minifiers rename. The promise is cached, so concurrent identical calls share one request.
  function m<F extends (...args: never[]) => Promise<unknown>>(name: string, fn: F): F {
    const call = fn as unknown as (...args: unknown[]) => Promise<unknown>;
    const wrapped = (...args: unknown[]) => {
      const key = `${name}:${JSON.stringify(args)}`;
      const now = Date.now();
      const hit = cache.get(key);
      if (hit && now - hit.t <= maxAge) return hit.v;
      const value = call(...args);
      cache.delete(key); // re-insert so eviction order follows insertion time
      cache.set(key, { t: now, v: value });
      // Don't keep failures: the next call retries.
      value.catch(() => cache.get(key)?.v === value && cache.delete(key));
      if (cache.size > max) {
        const it = cache.keys().next();
        if (!it.done) cache.delete(it.value);
      }
      return value;
    };
    return wrapped as unknown as F;
  }
  const mApp = m('app', app);
  const memoizedSearch = m('search', ((opts: SearchOptions) => search(mApp, opts)) as FullDetailFn<SearchOptions>);
  return {
    ...constants,
    app: mApp,
    list: m('list', baseApi.list),
    search: memoizedSearch,
    suggest: m('suggest', suggest),
    developer: m('developer', baseApi.developer),
    reviews: m('reviews', reviews),
    similar: m('similar', baseApi.similar),
    permissions: m('permissions', permissions),
    datasafety: m('datasafety', datasafety),
    categories: m('categories', categories),
    // Not memoized itself: it goes through mApp, so each country's lookup is cached as an app() call.
    availability: (opts: AvailabilityOptions) => availability(mApp, opts),
    memoized,
  };
}

export default { ...baseApi, memoized } as PlayStoreApi;
