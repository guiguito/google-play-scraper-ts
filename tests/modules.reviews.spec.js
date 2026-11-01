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
    const sizes = capturePageSizes([150, 50]);
    const res = await reviews({ appId: 'com.test', num: 200 });
    expect(sizes).to.deep.equal([150, 50]);
    expect(res.data.length).to.equal(200);
  });
});
