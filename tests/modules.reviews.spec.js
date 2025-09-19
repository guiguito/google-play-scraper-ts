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
});
