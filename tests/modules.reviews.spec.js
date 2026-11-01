const { expect } = require('chai');
const nock = require('nock');
const { BASE_URL, constants } = require('../dist/cjs/constants.js');
const reviews = require('../dist/cjs/modules/reviews.js').default;

describe('modules/reviews', () => {
  afterEach(() => nock.cleanAll());

  it('returns reviews and next token', async () => {
    const reviewItem = [
      'review-id',
      ['userName', [null, { 3: { 2: 'http://image' } }]],
      5,
      null,
      'Great app',
      [1690000000, 0],
      10,
      [null, 'reply', [1690000001, 0]],
      null,
      null,
      '1.0.0',
      null,
      [ ['quality', [5]] ],
    ];
    const data = [[reviewItem], [null, ['TOKEN']]];
    const input = [[null, null, JSON.stringify(data)]];
    const body = ")]}'\n" + JSON.stringify(input);
    const scope = nock(BASE_URL).post(/\/batchexecute/).reply(200, body);
    const res = await reviews({ appId: 'com.test', num: 1, sort: constants.sort.NEWEST });
    expect(res.data.length).to.equal(1);
    expect(JSON.stringify(res.nextPaginationToken)).to.contain('TOKEN');
    scope.done();
  });
  // Play returns as many reviews as the request asks for, and the token points past all of them.
  // Asking for more than `num` and slicing would make the token skip the sliced-off reviews.
  function capturePageSizes(pages) {
    const sizes = [];
    pages.forEach((count, p) => {
      const items = Array.from({ length: count }, (_, i) => [`r${p}-${i}`, ['u', null], 5, null, 't', [1690000000, 0], 0]);
      const token = p < pages.length - 1 ? [null, [`T${p}`]] : [null, null];
      const body = ")]}'\n" + JSON.stringify([[null, null, JSON.stringify([items, token])]]);
      nock(BASE_URL)
        .post(/\/batchexecute/, (b) => {
          const raw = typeof b === 'string' ? decodeURIComponent(b) : JSON.stringify(b);
          sizes.push(Number(raw.match(/\[2,\d+,\[(\d+),/)[1]));
          return true;
        })
        .reply(200, body);
    });
    return sizes;
  }

  it('asks Play for exactly num reviews when paginating manually', async () => {
    const sizes = capturePageSizes([50]);
    const res = await reviews({ appId: 'com.test', num: 50, paginate: true });
    expect(sizes).to.deep.equal([50]);
    expect(res.data.length).to.equal(50);
  });

  it('never fetches past num when auto-following tokens', async () => {
    // Play serves a short first page (150 of 200 asked): the next request asks only for the rest.
    const sizes = capturePageSizes([150, 50]);
    const res = await reviews({ appId: 'com.test', num: 200 });
    expect(sizes).to.deep.equal([200, 50]);
    expect(res.data.length).to.equal(200);
  });

  // Live (Nov 2026): num 2000 comes back in one request; Play serves an empty payload above 4500.
  it('asks for up to 4500 reviews per request', async () => {
    const sizes = capturePageSizes([4500, 500]);
    const res = await reviews({ appId: 'com.test', num: 5000 });
    expect(sizes).to.deep.equal([4500, 500]);
    expect(res.data.length).to.equal(5000);
  });

  it('sends the score and device filters on every page', async () => {
    const filters = [];
    [0, 1].forEach((p) => {
      const items = [[`r${p}`, ['u', null], 1, null, 't', [1690000000, 0], 0]];
      const token = p === 0 ? [null, 'T0'] : [null, null];
      nock(BASE_URL)
        .post(/\/batchexecute/, (b) => (filters.push(JSON.parse(JSON.parse(b['f.req'])[0][0][1])[2][4]), true))
        .reply(200, ")]}'\n" + JSON.stringify([[null, null, JSON.stringify([items, token])]]));
    });
    const res = await reviews({ appId: 'com.test', num: 2, score: 1, device: constants.device.TABLET });
    const expected = [null, 1, null, null, null, null, null, null, 3];
    expect(filters).to.deep.equal([expected, expected]);
    expect(res.data.map((r) => r.id)).to.deep.equal(['r0', 'r1']);
  });

  it('stops when a page has no reviews but still returns a token', async () => {
    const body = ")]}'\n" + JSON.stringify([[null, null, JSON.stringify([[], [null, 'SAME']])]]);
    const scope = nock(BASE_URL).post(/\/batchexecute/).once().reply(200, body);
    const res = await reviews({ appId: 'com.test', num: 100 });
    expect(res.data).to.deep.equal([]);
    scope.done();
  });

  it('encodes appId and pagination token as JSON in the request body', async () => {
    let fReq;
    const scope = nock(BASE_URL)
      .post(/\/batchexecute/, (b) => { fReq = b['f.req']; return true; })
      .reply(200, ")]}'\n[[null,null,null]]");
    await reviews({ appId: 'com.test', paginate: true, num: 10, nextPaginationToken: 'a+b/c="d"' });
    const inner = JSON.parse(JSON.parse(fReq)[0][0][1]);
    expect(inner[2][2]).to.deep.equal([10, null, 'a+b/c="d"']);
    expect(inner[3]).to.deep.equal(['com.test', 7]);
    scope.done();
  });
});
