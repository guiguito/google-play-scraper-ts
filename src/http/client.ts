import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import { URL as NodeURL } from 'node:url';
import type { ClientRequest } from 'node:http';
import { HttpError } from '../errors';
import { getProxyForCountry, type ResolvedProxyConfig } from './proxyConfig';
import { SimpleCookieJar } from './cookies';

type ProxyUsageListener = (info: { url: string; proxy?: ResolvedProxyConfig; attempt: number }) => void;

let proxyUsageListener: ProxyUsageListener | undefined;

export function setProxyUsageListener(listener?: ProxyUsageListener): void {
  proxyUsageListener = listener;
}

export type RequestOptions = {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  timeoutMs?: number;
  country?: string;
};

export type RetryOptions = {
  retries: number;
  backoffMs: number; // base backoff
  maxBackoffMs?: number;
};

export type ThrottleOptions = {
  interval: number;
  limit: number;
};

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

type ExecutionOptions = {
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string | Uint8Array;
  timeoutMs?: number;
};

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

function isRetriableStatus(status?: number): boolean { return status !== undefined && status >= 500 && status < 600; }

function deriveCountry(explicit: string | undefined, url: NodeURL): string | undefined {
  if (explicit) return explicit;
  const gl = url.searchParams.get('gl');
  if (gl) return gl;
  return undefined;
}

export async function request(
  opts: RequestOptions,
  retry: RetryOptions = { retries: 2, backoffMs: 300 },
  hooks?: { onProxyResolved?: (info: { url: string; proxy?: ResolvedProxyConfig; attempt: number }) => void }
): Promise<string> {
  const { url, method = 'GET', headers = {}, body, timeoutMs, country } = opts;
  const requestHeaders = { ...DEFAULT_HEADERS, ...headers };
  const urlObj = new NodeURL(url);
  const proxy = getProxyForCountry(deriveCountry(country, urlObj));

  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= retry.retries) {
    try {
      proxyUsageListener?.({ url, proxy, attempt });
      hooks?.onProxyResolved?.({ url, proxy, attempt });
      const text = await (proxy
        ? requestViaProxy(urlObj, { method, headers: requestHeaders, body, timeoutMs }, proxy)
        : requestDirect(urlObj, { method, headers: requestHeaders, body, timeoutMs }));
      return text;
    } catch (error) {
      lastErr = error;
      const status = error instanceof HttpError ? error.status : undefined;
      const shouldRetry = attempt < retry.retries && (status === undefined || isRetriableStatus(status));
      if (!shouldRetry) break;

      const backoff = Math.min(
        retry.maxBackoffMs ?? Number.MAX_SAFE_INTEGER,
        retry.backoffMs * Math.pow(2, attempt)
      );
      await sleep(backoff);
      attempt += 1;
      continue;
    }
  }

  if (lastErr instanceof Error) throw lastErr;
  throw new Error(String(lastErr));
}

export function createClient(
  retry: RetryOptions = { retries: 2, backoffMs: 300 },
  hooks?: { onProxyResolved?: (info: { url: string; proxy?: ResolvedProxyConfig; attempt: number }) => void }
) {
  const jar = new SimpleCookieJar();
  return {
    async request(opts: RequestOptions): Promise<string> {
      const headers = jar.apply(opts.url, opts.headers ?? {});
      return request({ ...opts, headers }, retry, hooks);
    },
    jar,
    retry,
  };
}

function requestDirect(url: NodeURL, opts: ExecutionOptions): Promise<string> {
  const lib = url.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const { resolve: safeResolve, reject: safeReject } = createSafeResolvers(resolve, reject);
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + (url.search || ''),
        method: opts.method,
        headers: opts.headers,
      },
      (res) => consumeResponse(res, safeResolve, safeReject)
    );

    req.on('error', safeReject);
    if (opts.timeoutMs) req.setTimeout(opts.timeoutMs, () => req.destroy(new Error('Request timed out')));

    writeBody(req, opts.body);
    req.end();
  });
}

function requestViaProxy(url: NodeURL, opts: ExecutionOptions, proxy: ResolvedProxyConfig): Promise<string> {
  if (url.protocol === 'http:') {
    return httpViaProxy(url, opts, proxy);
  }
  if (url.protocol === 'https:') {
    return httpsViaProxy(url, opts, proxy);
  }
  throw new Error(`Unsupported protocol: ${url.protocol}`);
}

function httpViaProxy(url: NodeURL, opts: ExecutionOptions, proxy: ResolvedProxyConfig): Promise<string> {
  const transport = proxy.protocol === 'https' ? https : http;
  const requestOptions: http.RequestOptions & https.RequestOptions = {
    protocol: `${proxy.protocol}:`,
    hostname: proxy.host,
    port: proxy.port,
    method: opts.method,
    path: url.toString(),
    headers: { ...proxy.headers, ...opts.headers, Host: url.host },
    agent: false as const,
  };

  if (proxy.protocol === 'https') {
    requestOptions.rejectUnauthorized = proxy.rejectUnauthorized;
    requestOptions.servername = proxy.host;
  }

  return new Promise((resolve, reject) => {
    const { resolve: safeResolve, reject: safeReject } = createSafeResolvers(resolve, reject);
    const req = transport.request(
      requestOptions,
      (res) => consumeResponse(res, safeResolve, safeReject)
    );

    req.on('error', safeReject);
    if (opts.timeoutMs) req.setTimeout(opts.timeoutMs, () => req.destroy(new Error('Proxy request timed out')));

    writeBody(req, opts.body);
    req.end();
  });
}

function httpsViaProxy(url: NodeURL, opts: ExecutionOptions, proxy: ResolvedProxyConfig): Promise<string> {
  const transport = proxy.protocol === 'https' ? https : http;
  return new Promise((resolve, reject) => {
    const { resolve: safeResolve, reject: safeReject } = createSafeResolvers(resolve, reject);
    const connectHeaders = { ...proxy.headers };
    connectHeaders['Host'] = `${url.hostname}:${url.port || 443}`;

    const connectOptions: http.RequestOptions & https.RequestOptions = {
      protocol: `${proxy.protocol}:`,
      hostname: proxy.host,
      port: proxy.port,
      method: 'CONNECT',
      path: `${url.hostname}:${url.port || 443}`,
      headers: connectHeaders,
      agent: false,
    };

    if (proxy.protocol === 'https') {
      connectOptions.rejectUnauthorized = proxy.rejectUnauthorized;
      connectOptions.servername = proxy.host;
    }

    const connectReq = transport.request(connectOptions);

    connectReq.on('connect', (res, socket, head) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        if (head && head.length > 0) socket.unshift(head);
        socket.on('error', safeReject);

        const httpsReq = https.request(
          {
            protocol: 'https:',
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + (url.search || ''),
            method: opts.method,
            headers: opts.headers,
            agent: false,
            createConnection: () => tls.connect({ socket, servername: url.hostname }),
          },
          (res2) => consumeResponse(res2, safeResolve, safeReject)
        );

        httpsReq.on('error', safeReject);
        if (opts.timeoutMs) httpsReq.setTimeout(opts.timeoutMs, () => httpsReq.destroy(new Error('Proxy tunnel request timed out')));

        writeBody(httpsReq, opts.body);
        httpsReq.end();
      } else {
        const status = res.statusCode ?? 0;
        const message = res.statusMessage ?? '';
        socket.destroy();
        safeReject(new HttpError(`Proxy CONNECT failed: ${status}${message ? ` ${message}` : ''}`, status, ''));
      }
    });

    connectReq.on('response', (res) => {
      const status = res.statusCode ?? 0;
      const message = res.statusMessage ?? '';
      res.resume();
      safeReject(new HttpError(`Proxy CONNECT failed: ${status}${message ? ` ${message}` : ''}`, status, ''));
    });

    connectReq.on('error', safeReject);
    if (opts.timeoutMs) connectReq.setTimeout(opts.timeoutMs, () => connectReq.destroy(new Error('Proxy CONNECT timed out')));

    connectReq.end();
  });
}

function consumeResponse(
  res: http.IncomingMessage,
  resolve: (value: string) => void,
  reject: (err: Error) => void
) {
  const chunks: Buffer[] = [];
  res.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
  res.on('error', reject);
  res.on('aborted', () => reject(new Error('Response aborted')));
  res.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    const status = res.statusCode ?? 0;
    if (status >= 200 && status < 300) {
      resolve(body);
      return;
    }
    const message = res.statusMessage ? ` ${res.statusMessage}` : '';
    reject(new HttpError(`Request failed: ${status}${message}`, status, body));
  });
}

function createSafeResolvers(
  resolve: (value: string) => void,
  reject: (err: Error) => void
): { resolve: (value: string) => void; reject: (err: Error) => void } {
  let settled = false;
  return {
    resolve(value) {
      if (settled) return;
      settled = true;
      resolve(value);
    },
    reject(err) {
      if (settled) return;
      settled = true;
      reject(err);
    },
  };
}

function writeBody(req: ClientRequest, body?: string | Uint8Array) {
  if (!body) return;
  if (typeof body === 'string') {
    req.write(body);
  } else {
    req.write(Buffer.from(body));
  }
}
