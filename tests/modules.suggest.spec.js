const { expect } = require('chai');
const nock = require('nock');
const { BASE_URL } = require('../dist/cjs/constants.js');
const suggest = require('../dist/cjs/modules/suggest.js').default;

describe('modules/suggest', () => {
  afterEach(() => nock.cleanAll());

  it('returns suggestions from batchexecute', async () => {
    const data = [[ [ ['spotify'], ['soundcloud'] ] ]];
    const input = [[null, null, JSON.stringify(data)]];
    const body = ")]}'\n" + JSON.stringify(input);
    const scope = nock(BASE_URL)
      .post(/\/batchexecute/)
      .reply(200, body, { 'Content-Type': 'text/plain' });

    const res = await suggest({ term: 'spo', lang: 'en', country: 'us' });
    expect(res).to.include('spotify');
    scope.done();
  });
});
