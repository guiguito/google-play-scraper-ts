const { expect } = require('chai');
const { EventEmitter } = require('node:events');
const http = require('node:http');
const https = require('node:https');
const { Headers: UndiciHeaders } = require('undici');
const { request, createClient } = require('../dist/cjs/http/client.js');
const { SimpleCookieJar } = require('../dist/cjs/http/cookies.js');
const { HttpError } = require('../dist/cjs/errors.js');

const HeadersCtor = global.Headers || UndiciHeaders;

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
