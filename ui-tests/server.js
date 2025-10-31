const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const gplayModule = require('../dist/cjs/index.js');
const gplay = gplayModule.default;
const { constants, configureProxies } = gplayModule;
const { setProxyUsageListener } = require('../dist/cjs/http/client.js');

const METHODS = {
  app: (options) => gplay.app(options),
  list: (options) => gplay.list(options),
  search: (options = {}) => {
    const { mode, ...rest } = options;
    const variant = mode === 'global' ? 'global' : 'modern';
    const fn =
      variant === 'global' && typeof gplay.searchGlobal === 'function'
        ? gplay.searchGlobal
        : gplay.search;
    return fn(rest);
  },
  suggest: (options) => gplay.suggest(options),
  developer: (options) => gplay.developer(options),
  reviews: (options) => gplay.reviews(options),
  similar: (options) => gplay.similar(options),
  permissions: (options) => gplay.permissions(options),
  datasafety: (options) => gplay.datasafety(options),
  categories: (options) => gplay.categories(options),
};

const root = __dirname;
let proxySettings = null;

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const contentType =
      ext === '.html'
        ? 'text/html'
        : ext === '.js'
          ? 'application/javascript'
          : 'text/plain';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function configureProxyState(settings) {
  configureProxies(settings ?? null);
  proxySettings = settings ?? null;
  const status = buildProxyStatus();
  if (status.enabled) {
    console.log(`[ui-tests] proxy configured`, status);
  } else {
    console.log('[ui-tests] proxy configuration cleared');
  }
}

function parseProxyPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  if (!entries.length) return null;

  const result = {};
  const perCountry = {};

  for (const rawEntry of entries) {
    if (!rawEntry || typeof rawEntry !== 'object') continue;
    const scope = rawEntry.scope === 'country' ? 'country' : 'default';
    const definition = buildProxyDefinition(rawEntry);

    if (scope === 'default') {
      result.default = definition;
    } else {
      const code = normalizeCountryCode(rawEntry.country);
      if (!code) {
        throw new Error('Per-country proxy entries require a 2-letter country code.');
      }
      perCountry[code] = definition;
    }
  }

  if (Object.keys(perCountry).length > 0) {
    result.perCountry = perCountry;
  }

  if (!result.default && !result.perCountry) {
    return null;
  }

  return result;
}

function buildProxyDefinition(entry) {
  if (entry.url) {
    const url = String(entry.url).trim();
    if (!url) throw new Error('Proxy URL cannot be empty.');
    const headers = normalizeHeaders(entry.headers);
    const definition = headers ? { url, headers } : { url };
    if (entry.allowInsecure === true) {
      definition.rejectUnauthorized = false;
    }
    return definition;
  }

  const host = typeof entry.host === 'string' ? entry.host.trim() : '';
  const rawPort = typeof entry.port === 'string' || typeof entry.port === 'number' ? Number(entry.port) : NaN;
  if (!host || Number.isNaN(rawPort) || rawPort <= 0) {
    throw new Error('Proxy entries must include either a URL or both host and port.');
  }
  const headers = normalizeHeaders(entry.headers);
  const definition = {
    host,
    port: rawPort,
    protocol: entry.protocol === 'https' ? 'https' : 'http',
  };
  if (entry.allowInsecure === true) {
    definition.rejectUnauthorized = false;
  }
  if (entry.username || entry.password) {
    definition.auth = {
      username: entry.username ?? '',
      password: entry.password ?? '',
    };
  }
  if (headers) {
    definition.headers = headers;
  }
  return definition;
}

function normalizeHeaders(headers) {
  if (!headers || typeof headers !== 'object') return undefined;
  const normalized = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      normalized[key] = value;
    }
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

function normalizeCountryCode(country) {
  if (!country) return undefined;
  const code = String(country).trim();
  if (!code) return undefined;
  if (code.length !== 2) {
    throw new Error(`Country code "${code}" must be 2 letters (ISO alpha-2).`);
  }
  return code.toLowerCase();
}

function buildProxyStatus() {
  if (!proxySettings) return { enabled: false };

  const status = { enabled: true };
  if (proxySettings.default) {
    status.default = describeProxyDefinition(proxySettings.default);
  }
  if (proxySettings.perCountry) {
    status.perCountry = Object.entries(proxySettings.perCountry).map(([country, definition]) => ({
      country,
      ...describeProxyDefinition(definition),
    }));
  }
  return status;
}

function describeProxyDefinition(definition) {
  if (!definition || typeof definition !== 'object') return {};
  if ('url' in definition) {
    const parsed = safeParseUrl(definition.url);
    const headers = definition.headers ? Object.keys(definition.headers) : [];
    const insecure = definition.rejectUnauthorized === false;
    return {
      source: 'url',
      host: parsed?.hostname,
      port: parsed ? resolvePort(parsed) : undefined,
      protocol: parsed?.protocol?.replace(/:$/, ''),
      hasAuth: Boolean(parsed && (parsed.username || parsed.password)),
      headers,
      maskedUrl: parsed ? maskProxyUrl(definition.url) : '[invalid-url]',
      insecure,
    };
  }
  const headers = definition.headers ? Object.keys(definition.headers) : [];
  const insecure = definition.rejectUnauthorized === false;
  return {
    source: 'config',
    host: definition.host,
    port: definition.port,
    protocol: definition.protocol ?? 'http',
    hasAuth: Boolean(definition.auth),
    headers,
    insecure,
  };
}

function safeParseUrl(raw) {
  try {
    return new URL(raw);
  } catch (_error) {
    return null;
  }
}

function resolvePort(url) {
  if (url.port) return Number(url.port);
  if (url.protocol === 'https:') return 443;
  return 80;
}

function maskProxyUrl(url) {
  const parsed = safeParseUrl(url);
  if (!parsed) return '[invalid-url]';
  const auth = parsed.username || parsed.password ? `${parsed.username || ''}${parsed.password ? ':******' : ''}@` : '';
  const port = parsed.port ? `:${parsed.port}` : '';
  return `${parsed.protocol}//${auth}${parsed.hostname}${port}`;
}

configureProxyState(null);

setProxyUsageListener(({ url, proxy, attempt }) => {
  if (proxy) {
    const insecure = proxy.rejectUnauthorized === false ? ' (TLS insecure)' : '';
    console.log(
      `[ui-tests] http → proxy[${attempt + 1}] ${proxy.protocol}://${proxy.host}:${proxy.port}${insecure} (${url})`
    );
  } else if (attempt === 0) {
    console.log(`[ui-tests] http → direct (${url})`);
  }
});

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/meta') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify({ constants, proxy: buildProxyStatus() }));
    return;
  }

  if (url.pathname === '/proxy') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ proxy: buildProxyStatus() }));
      return;
    }
    if (req.method === 'DELETE') {
      configureProxyState(null);
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = body ? JSON.parse(body) : {};
          const settings = parseProxyPayload(payload);
          configureProxyState(settings);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ proxy: buildProxyStatus() }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message || String(error) }));
        }
      });
      return;
    }
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Unsupported method ${req.method} for /proxy` }));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    const method = url.pathname.replace('/api/', '');
    const handler = METHODS[method];
    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Unknown method ${method}` }));
      return;
    }
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      let options = {};
      try {
        const parsed = body ? JSON.parse(body) : {};
        options = parsed?.options ?? {};
        const start = Date.now();
        const label = formatMethodLabel(method, options);
        console.log(`[ui-tests] ${label} → options`, options);
        const result = await handler(options);
        console.log(`[ui-tests] ${label} ✔ ${Date.now() - start}ms`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        const label = formatMethodLabel(method, options);
        console.error(`[ui-tests] ${label} ✖`, {
          message: error?.message || String(error),
          status: error?.status,
          body: error?.body,
        });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message || String(error) }));
      }
    });
    return;
  }

  const filePath = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
  serveFile(filePath, res);
});

const port = process.env.PORT || 5173;
server.listen(port, () => {
  console.log(`UI tests available at http://localhost:${port}`);
  console.log('Remember to run `npm run build` from the project root before starting the UI tests.');
  console.log('Set LIVE=1 when launching this server if you need fresh data from Google Play.');
});

function formatMethodLabel(method, options) {
  if (method === 'search') {
    const variant = options?.mode === 'global' ? 'global' : 'store';
    return `search[${variant}]()`;
  }
  return `${method}()`;
}
