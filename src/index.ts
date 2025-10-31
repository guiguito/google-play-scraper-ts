import { constants } from './constants';
import { configureProxy as applyProxyConfig, type ProxySettings } from './http/proxyConfig';
import app from './modules/app';
import list from './modules/list';
import search, { searchGlobal, type SearchOptions } from './modules/search';
import suggest from './modules/suggest';
import developer from './modules/developer';
import reviews from './modules/reviews';
import similar from './modules/similar';
import permissions from './modules/permissions';
import datasafety from './modules/datasafety';
import categories from './modules/categories';

export type { Constants } from './constants';
export { constants };

type MemoizeOptions = {
  maxAge?: number;
  max?: number;
};

type AsyncFn<A extends unknown[] = unknown[], R = unknown> = (...args: A) => Promise<R>;

const baseApi = {
  ...constants,
  app,
  list,
  search: (opts: SearchOptions) => search(app, opts),
  searchGlobal: (opts: SearchOptions) => searchGlobal(app, opts),
  suggest,
  developer,
  reviews,
  similar,
  permissions,
  datasafety,
  categories,
};

export type PlayStoreApi = typeof baseApi & { memoized?: typeof memoized };

export type {
  ProxySettings,
  ProxyConfig,
  ProxyUrlDefinition,
  ProxyDefinition,
} from './http/proxyConfig';

export { searchGlobal } from './modules/search';

export interface CreatePlayStoreApiOptions {
  proxies?: ProxySettings | null;
  memoize?: MemoizeOptions;
}

export function configureProxies(settings?: ProxySettings | null): void {
  applyProxyConfig(settings);
}

export function createPlayStoreApi(options?: CreatePlayStoreApiOptions): PlayStoreApi {
  applyProxyConfig(options?.proxies ?? null);
  return options?.memoize ? memoized(options.memoize) : { ...baseApi, memoized };
}

export function memoized(_opts?: MemoizeOptions): PlayStoreApi {
  const cache = new Map<string, { t: number; v: unknown }>();
  const maxAge = _opts?.maxAge ?? 5 * 60 * 1000;
  const max = _opts?.max ?? 1000;
  function m<A extends unknown[], R>(fn: AsyncFn<A, R>): AsyncFn<A, R> {
    return async (...args: A) => {
      const key = `${fn.name}:${JSON.stringify(args)}`;
      const now = Date.now();
      const hit = cache.get(key);
      if (hit && now - hit.t <= maxAge) return hit.v as R;
      const value = await fn(...args);
      cache.set(key, { t: now, v: value });
      if (cache.size > max) {
        const it = cache.keys().next();
        if (!it.done) cache.delete(it.value as string);
      }
      return value;
    };
  }
  const mApp = m(app);
  const memoizedSearch = m((opts: SearchOptions) => search(mApp, opts));
  const memoizedSearchGlobal = m((opts: SearchOptions) => searchGlobal(mApp, opts));
  return {
    ...constants,
    app: mApp,
    list: m(list),
    search: memoizedSearch,
    searchGlobal: memoizedSearchGlobal,
    suggest: m(suggest),
    developer: m(developer),
    reviews: m(reviews),
    similar: m(similar),
    permissions: m(permissions),
    datasafety: m(datasafety),
    categories: m(categories),
    memoized,
  };
}

export default { ...baseApi, memoized } as PlayStoreApi;
