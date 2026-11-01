const { expect } = require('chai');
const nock = require('nock');
const { request } = require('../dist/cjs/http/client.js');

describe('http/client concurrency', () => {
  afterEach(() => nock.cleanAll());

  // fullDetail and summary backfills fan out one app() per result (up to 500 for list());
  // the client must not open all of those connections at once.
  it('keeps at most 5 requests in flight', async () => {
    let active = 0;
    let peak = 0;
    nock('https://play.google.com')
      .get('/x')
      .times(12)
      .reply((uri, body, cb) => {
        active += 1;
        peak = Math.max(peak, active);
        setTimeout(() => {
          active -= 1;
          cb(null, [200, 'ok']);
        }, 20);
      });

    const results = await Promise.all(Array.from({ length: 12 }, () => request({ url: 'https://play.google.com/x' })));
    expect(results).to.have.lengthOf(12);
    expect(peak).to.equal(5);
  });
});
