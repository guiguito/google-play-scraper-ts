const { expect } = require('chai');
const nock = require('nock');
const gplay = require('../dist/cjs/index.js').default;
const { BASE_URL } = require('../dist/cjs/constants.js');

describe('memoized helper', () => {
  afterEach(() => nock.cleanAll());

  it('caches module calls within the specified maxAge', async () => {
    const memo = gplay.memoized({ maxAge: 10_000 });
    const term = 'cache-me';
    const data = [[[ [term, null] ]]];
    const response = [[null, null, JSON.stringify(data)]];
    const body = `)]}'\n${JSON.stringify(response)}`;

    const scope = nock(BASE_URL)
      .post(/IJ4APc/)
      .reply(200, body, { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' });

    const first = await memo.suggest({ term });
    const second = await memo.suggest({ term });

    expect(first).to.deep.equal(second);
    scope.done();
  });

  it('evicts the oldest key when cache size limit is exceeded', async () => {
    const memo = gplay.memoized({ max: 1, maxAge: 10_000 });
    const makeBody = (label) => `)]}'\n${JSON.stringify([[null, null, JSON.stringify([[[label, null]]])]])}`;

    const alpha1 = nock(BASE_URL)
      .post(/IJ4APc/)
      .reply(200, makeBody('alpha'), { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' });
    await memo.suggest({ term: 'alpha' });
    alpha1.done();

    const beta1 = nock(BASE_URL)
      .post(/IJ4APc/)
      .reply(200, makeBody('beta'), { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' });
    await memo.suggest({ term: 'beta' });
    beta1.done();

    const alpha2 = nock(BASE_URL)
      .post(/IJ4APc/)
      .reply(200, makeBody('alpha'), { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' });
    await memo.suggest({ term: 'alpha' });
    alpha2.done();
  });
});
