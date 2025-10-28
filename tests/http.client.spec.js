const { expect } = require('chai');
const { EventEmitter } = require('node:events');
const http = require('node:http');
const https = require('node:https');
const tls = require('node:tls');
const { Headers: UndiciHeaders } = require('undici');
const { request, createClient } = require('../dist/cjs/http/client.js');
const { SimpleCookieJar } = require('../dist/cjs/http/cookies.js');
const { HttpError } = require('../dist/cjs/errors.js');
const { configureProxy, resetProxyConfiguration } = require('../dist/cjs/http/proxyConfig.js');

const HeadersCtor = global.Headers || UndiciHeaders;

afterEach(() => {
  resetProxyConfiguration();
});

function stubRequests(responses) {
  const originals = { http: http.request, https: https.request };
  let callIndex = 0;
  const stub = (options, callback) => {
    const current = responses[Math.min(callIndex, responses.length - 1)];
    callIndex += 1;

    if (typeof current.inspect === 'function') current.inspect(options);

    const res = new EventEmitter();
    res.statusCode = current.statusCode;
    res.statusMessage = current.statusMessage ?? '';

    process.nextTick(() => {
      callback(res);
      if (current.body !== undefined) res.emit('data', Buffer.from(current.body));
      res.emit('end');
    });

    return {
      on(event, handler) {
        if (event === 'error') current.errorHandler = handler;
        return this;
      },
      write() {},
      end() {
        if (current.error) {
          process.nextTick(() => current.errorHandler?.(current.error));
        }
      },
    };
  };
  http.request = stub;
  https.request = stub;
  return () => {
    http.request = originals.http;
    https.request = originals.https;
  };
}

describe('http/client request', () => {
  it('returns the response body on success', async () => {
    const restore = stubRequests([{ statusCode: 200, body: 'ok' }]);
    const res = await request({ url: 'http://example.test/' });
    expect(res).to.equal('ok');
    restore();
  });

  it('retries on retriable status codes', async () => {
    const restore = stubRequests([
      { statusCode: 500, statusMessage: 'err', body: 'fail' },
      { statusCode: 200, body: 'ok' },
    ]);
    const res = await request({ url: 'http://retry.test/' }, { retries: 1, backoffMs: 0 });
    expect(res).to.equal('ok');
    restore();
  });

  it('throws HttpError with status and body for non-retriable responses', async () => {
    const restore = stubRequests([{ statusCode: 404, statusMessage: 'Not Found', body: 'missing' }]);
    try {
      await request({ url: 'http://fail.test/' }, { retries: 0, backoffMs: 0 });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).to.be.instanceOf(HttpError);
      expect(err.status).to.equal(404);
      expect(err.body).to.equal('missing');
    }
    restore();
  });
});

describe('proxy routing', () => {
  it('routes http requests through a configured country proxy', async () => {
    configureProxy({
      perCountry: {
        us: { host: 'proxy.test', port: 8080, auth: { username: 'user', password: 'pass' } },
      },
    });

    let captured;
    const restore = stubRequests([
      { statusCode: 200, body: 'proxy-ok', inspect: (opts) => { captured = opts; } },
    ]);

    const body = await request({ url: 'http://example.test/resource?gl=us' });
    expect(body).to.equal('proxy-ok');
    expect(captured).to.be.an('object');
    expect(captured.hostname).to.equal('proxy.test');
    expect(captured.port).to.equal(8080);
    expect(captured.path).to.equal('http://example.test/resource?gl=us');
    expect(captured.headers.Host).to.equal('example.test');
    expect(captured.headers['Proxy-Authorization']).to.equal('Basic dXNlcjpwYXNz');
    restore();
  });

  it('falls back to default proxy when no country match exists', async () => {
    configureProxy({
      default: { host: 'proxy.test', port: 3128 },
    });

    let captured;
    const restore = stubRequests([
      { statusCode: 200, body: 'default-proxy', inspect: (opts) => { captured = opts; } },
    ]);

    const body = await request({ url: 'http://example.test/path', country: 'fr' });
    expect(body).to.equal('default-proxy');
    expect(captured.hostname).to.equal('proxy.test');
    expect(captured.port).to.equal(3128);
    expect(captured.path).to.equal('http://example.test/path');
    restore();
  });

  it('establishes a CONNECT tunnel for https requests', async () => {
    configureProxy({
      perCountry: { us: { host: 'proxy.test', port: 8080 } },
    });

    const originals = { http: http.request, https: https.request, tls: tls.connect };
    const fakeSocket = new EventEmitter();
    fakeSocket.setTimeout = () => {};
    fakeSocket.destroy = () => {};
    fakeSocket.write = () => {};
    fakeSocket.end = () => {};
    fakeSocket.unshift = () => {};

    const fakeTlsSocket = new EventEmitter();
    fakeTlsSocket.setTimeout = () => {};
    fakeTlsSocket.destroy = () => {};
    fakeTlsSocket.write = () => {};
    fakeTlsSocket.end = () => {};

    let connectOptions;
    let httpsOptions;
    let createdSocket;

    tls.connect = () => fakeTlsSocket;

    http.request = (options) => {
      if (options.method === 'CONNECT') {
        connectOptions = options;
        const req = new EventEmitter();
        req.write = () => {};
        req.setTimeout = () => {};
        req.end = () => {
          process.nextTick(() => {
            req.emit('connect', { statusCode: 200, statusMessage: 'OK' }, fakeSocket, Buffer.alloc(0));
          });
        };
        return req;
      }
      throw new Error('Unexpected http.request invocation during proxy CONNECT test');
    };

    https.request = (options, callback) => {
      httpsOptions = options;
      createdSocket = typeof options.createConnection === 'function' ? options.createConnection() : undefined;
      const res = new EventEmitter();
      res.statusCode = 200;
      res.statusMessage = 'OK';
      const req = new EventEmitter();
      req.write = () => {};
      req.setTimeout = () => {};
      req.end = () => {
        process.nextTick(() => {
          callback(res);
          res.emit('data', Buffer.from('via-connect'));
          res.emit('end');
        });
      };
      return req;
    };

    try {
      const body = await request({ url: 'https://example.test/resource', country: 'us' });
      expect(body).to.equal('via-connect');
      expect(connectOptions.method).to.equal('CONNECT');
      expect(connectOptions.hostname).to.equal('proxy.test');
      expect(connectOptions.path).to.equal('example.test:443');
      expect(httpsOptions.hostname).to.equal('example.test');
      expect(httpsOptions.agent).to.equal(false);
      expect(createdSocket).to.equal(fakeTlsSocket);
    } finally {
      http.request = originals.http;
      https.request = originals.https;
      tls.connect = originals.tls;
    }
  });
});

describe('http/cookies SimpleCookieJar', () => {
  it('stores cookies from headers and applies them per-domain', () => {
    const jar = new SimpleCookieJar();
    const headers = new HeadersCtor();
    headers.set('set-cookie', 'session=abc; Path=/');
    jar.setFromHeaders('https://cookie.test/', headers);
    const applied = jar.apply('https://cookie.test/path', {});
    expect(applied.Cookie).to.equal('session=abc');
    const untouched = jar.apply('https://other.test/', { Existing: 'value' });
    expect(untouched).to.deep.equal({ Existing: 'value' });
  });

  it('integrates with createClient to reuse cookies', async () => {
    const client = createClient({ retries: 0, backoffMs: 0 });
    const headers = new HeadersCtor();
    headers.set('set-cookie', 'token=xyz; Path=/');
    client.jar.setFromHeaders('http://cookie.test/', headers);

    let capturedHeaders;
    const restore = stubRequests([
      { statusCode: 200, body: 'ok', inspect: (opts) => { capturedHeaders = opts.headers; } },
    ]);
    await client.request({ url: 'http://cookie.test/' });
    expect(capturedHeaders.Cookie).to.equal('token=xyz');
    restore();
  });
});
