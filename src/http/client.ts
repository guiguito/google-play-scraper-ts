export type RequestOptions = {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  timeoutMs?: number;
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

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

function isRetriableStatus(status?: number): boolean { return status !== undefined && status >= 500 && status < 600; }

import http from 'node:http';
import https from 'node:https';
import { URL as NodeURL } from 'node:url';
import { HttpError } from '../errors';

export async function request(
  opts: RequestOptions,
  retry: RetryOptions = { retries: 2, backoffMs: 300 }
): Promise<string> {
  const { url, method = 'GET', headers = {}, body } = opts;
  let attempt = 0;
  let lastErr: unknown;
  const u = new NodeURL(url);
  const lib = u.protocol === 'http:' ? http : https;

  while (attempt <= retry.retries) {
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const req = lib.request(
          {
            protocol: u.protocol,
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + (u.search || ''),
            method,
            headers,
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
            res.on('end', () => {
              const buf = Buffer.concat(chunks);
              const status = res.statusCode || 0;
              const bodyText = buf.toString('utf8');
              if (status >= 200 && status < 300) return resolve(bodyText);
              if (isRetriableStatus(status) && attempt < retry.retries) return reject(new Error(`HTTP ${status}`));
              reject(new HttpError(`Request failed: ${status} ${res.statusMessage}`, status, bodyText));
            });
          }
        );
        req.on('error', reject);
        if (body) {
          if (typeof body === 'string') {
            req.write(body);
          } else {
            req.write(Buffer.from(body));
          }
        }
        req.end();
      });
      return text;
    } catch (e: unknown) {
      lastErr = e;
      if (attempt >= retry.retries) break;
      const backoff = Math.min(
        retry.maxBackoffMs ?? Number.MAX_SAFE_INTEGER,
        retry.backoffMs * Math.pow(2, attempt)
      );
      await sleep(backoff);
      attempt += 1;
      continue;
    }
  }
  throw lastErr as Error;
}

// Optional cookie-aware client
import { SimpleCookieJar } from './cookies';

export function createClient(retry: RetryOptions = { retries: 2, backoffMs: 300 }) {
  const jar = new SimpleCookieJar();
  return {
    async request(opts: RequestOptions): Promise<string> {
      const headers = jar.apply(opts.url, opts.headers ?? {});
      const text = await request({ ...opts, headers }, retry);
      return text;
    },
    jar,
    retry,
  };
}
