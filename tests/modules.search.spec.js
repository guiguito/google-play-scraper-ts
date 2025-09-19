const { expect } = require('chai');
const nock = require('nock');
const { BASE_URL } = require('../dist/cjs/constants.js');
const search = require('../dist/cjs/modules/search.js').default;

describe('modules/search', () => {
  afterEach(() => nock.cleanAll());

  it('parses first page via AF_initDataCallback', async () => {
    // Build minimal AF_initDataCallback for ds:1 with apps in path [0,1,0,0,0]
    const appEntry = [];
    appEntry[2] = 'My App';
    appEntry[12] = ['com.test.app'];
    appEntry[9] = [null, null, null, null, ['','', '/store/apps/details?id=com.test.app']];
    const ds1 = [ [ [ [ [appEntry] ] ] ] ];
    const html = `<script>AF_initDataCallback({key: 'ds:1', data: ${JSON.stringify(ds1)}, sideChannel: {}});</script>`;

    const scope = nock(BASE_URL)
      .get(uri => uri.startsWith('/work/search'))
      .reply(200, html, { 'Content-Type': 'text/html' });

    const res = await search(() => Promise.resolve(), { term: 'test', num: 1, lang: 'en', country: 'us' });
    expect(Array.isArray(res)).to.equal(true);
    scope.done();
  });

  it('fetches full detail results using provided app fetcher', async () => {
    const appEntry = [];
    appEntry[2] = 'Detail App';
    appEntry[12] = ['com.detail.app'];
    appEntry[9] = [null, null, null, null, ['', '', '/store/apps/details?id=com.detail.app']];

    const tokenSection = [];
    tokenSection[1] = 'TOKEN';

    const ds1 = [];
    ds1[0] = [];
    ds1[0][1] = [];
    ds1[0][1][0] = [];
    ds1[0][1][0][0] = [[appEntry], tokenSection];

    const html = `<script>AF_initDataCallback({key: 'ds:1', data: ${JSON.stringify(ds1)}, sideChannel: {}});</script>`;

    const scope = nock(BASE_URL)
      .get(uri => uri.startsWith('/work/search'))
      .reply(200, html, { 'Content-Type': 'text/html' });

    const calls = [];
    const results = await search(async (args) => {
      calls.push(args);
      return { fetched: true, ...args };
    }, { term: 'detail', num: 1, lang: 'en', country: 'us', fullDetail: true });

    expect(calls).to.deep.equal([{ appId: 'com.detail.app', lang: 'en', country: 'us' }]);
    expect(results).to.deep.equal([{ fetched: true, appId: 'com.detail.app', lang: 'en', country: 'us' }]);
    scope.done();
  });
});
