import { URL } from 'node:url';

export interface ProxyAuth {
  username: string;
  password: string;
}

export type ProxyDefinition =
  | ProxyConfig
  | ProxyUrlDefinition;

export interface ProxyConfig {
  host: string;
  port: number;
  protocol?: 'http' | 'https';
  auth?: ProxyAuth;
  headers?: Record<string, string>;
  rejectUnauthorized?: boolean;
}

export interface ProxyUrlDefinition {
  url: string;
  headers?: Record<string, string>;
  rejectUnauthorized?: boolean;
}

export interface ProxySettings {
  /**
   * Proxy applied when no per-country match is found.
   */
  default?: ProxyDefinition;
  /**
   * Proxy configuration keyed by ISO alpha-2 country (case-insensitive).
   */
  perCountry?: Record<string, ProxyDefinition>;
}

export type ResolvedProxyConfig = {
  protocol: 'http' | 'https';
  host: string;
  port: number;
  headers: Record<string, string>;
  authHeader?: string;
  rejectUnauthorized: boolean;
};

type ProxyState = {
  defaultProxy?: ResolvedProxyConfig;
  perCountry: Map<string, ResolvedProxyConfig>;
};

let state: ProxyState = {
  defaultProxy: undefined,
  perCountry: new Map<string, ResolvedProxyConfig>(),
};

export function configureProxy(settings?: ProxySettings | null): void {
  const next: ProxyState = {
    defaultProxy: undefined,
    perCountry: new Map<string, ResolvedProxyConfig>(),
  };

  if (settings?.default) {
    next.defaultProxy = normalizeProxy(settings.default);
  }

  if (settings?.perCountry) {
    for (const [country, definition] of Object.entries(settings.perCountry)) {
      const code = normalizeCountry(country);
      if (!code) continue;
      next.perCountry.set(code, normalizeProxy(definition));
    }
  }

  state = next;
}

export function resetProxyConfiguration(): void {
  configureProxy();
}

export function getProxyForCountry(country?: string | null): ResolvedProxyConfig | undefined {
  const normalized = normalizeCountry(country);
  if (normalized && state.perCountry.has(normalized)) {
    return state.perCountry.get(normalized);
  }
  return state.defaultProxy;
}

function normalizeCountry(country?: string | null): string | undefined {
  if (!country) return undefined;
  const trimmed = country.trim();
  if (!trimmed) return undefined;
  return trimmed.toLowerCase();
}

function normalizeProxy(definition: ProxyDefinition): ResolvedProxyConfig {
  const resolved = isUrlDefinition(definition) ? fromUrl(definition) : fromConfig(definition);
  const headers = { ...(resolved.headers ?? {}) };
  const authHeader = resolved.authHeader ?? buildAuthHeader(resolved.auth);
  if (authHeader) headers['Proxy-Authorization'] = authHeader;

  return {
    protocol: resolved.protocol,
    host: resolved.host,
    port: resolved.port,
    headers,
    authHeader,
    rejectUnauthorized: resolved.rejectUnauthorized,
  };
}

type NormalizedInput = {
  protocol: 'http' | 'https';
  host: string;
  port: number;
  headers?: Record<string, string>;
  auth?: ProxyAuth;
  authHeader?: string;
  rejectUnauthorized: boolean;
};

function fromConfig(config: ProxyConfig): NormalizedInput {
  if (!config.host) throw new Error('Proxy host is required.');
  if (!config.port) throw new Error('Proxy port is required.');

  return {
    protocol: config.protocol ?? 'http',
    host: config.host,
    port: config.port,
    headers: { ...(config.headers ?? {}) },
    auth: config.auth,
    rejectUnauthorized: config.rejectUnauthorized ?? true,
  };
}

function fromUrl(definition: ProxyUrlDefinition): NormalizedInput {
  const parsed = new URL(definition.url);
  const protocol = (parsed.protocol?.replace(/:$/, '') || 'http') as 'http' | 'https';
  const host = parsed.hostname;
  if (!host) throw new Error('Proxy URL must include a hostname.');
  if (protocol !== 'http' && protocol !== 'https') {
    throw new Error(`Unsupported proxy protocol: ${protocol}. Only 'http' and 'https' proxies are supported.`);
  }
  const port = parsed.port ? Number(parsed.port) : protocol === 'https' ? 443 : 80;
  const username = parsed.username ? decodeURIComponent(parsed.username) : '';
  const password = parsed.password ? decodeURIComponent(parsed.password) : '';
  const authHeader = username || password ? buildAuthHeader({ username, password }) : undefined;

  return {
    protocol,
    host,
    port,
    headers: { ...(definition.headers ?? {}) },
    authHeader,
    rejectUnauthorized: definition.rejectUnauthorized ?? true,
  };
}

function isUrlDefinition(definition: ProxyDefinition): definition is ProxyUrlDefinition {
  return typeof definition === 'object' && definition !== null && 'url' in definition;
}

function buildAuthHeader(auth?: ProxyAuth): string | undefined {
  if (!auth) return undefined;
  const { username, password } = auth;
  const encoded = Buffer.from(`${username ?? ''}:${password ?? ''}`, 'utf8').toString('base64');
  return `Basic ${encoded}`;
}
