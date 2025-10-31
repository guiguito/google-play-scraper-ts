const { expect } = require('chai');
const nock = require('nock');
const { BASE_URL } = require('../dist/cjs/constants.js');
const searchModule = require('../dist/cjs/modules/search.js');

const search = searchModule.default;

function buildListHtml() {
  const item = [];
  item[0] = ['com.test.app', 7];
  item[1] = [null, 2, [512, 512], [null, null, 'https://example.com/icon.png']];
  item[3] = 'My App';
  item[4] = ['4.5', 4.5];
  item[8] = [null, [[0, 'USD', '']]];
  item[10] = [null, null, null, null, ['', '', '/store/apps/details?id=com.test.app']];
  item[13] = [null, 'Summary<br>line'];
  item[14] = 'DevCo';
  item[25] = [
    [
      [null, ['Install']],
    ],
  ];

  const listCluster = [];
  listCluster[22] = [
    [
      [item],
    ],
    [
      '',
      null,
      null,
      [null, 'TOKEN123'],
      1,
    ],
  ];

  const ds4 = [
    [
      null,
      [listCluster],
    ],
  ];

  return `<script>AF_initDataCallback({key: 'ds:4', data: ${JSON.stringify(ds4)}, sideChannel: {}});</script>`;
}

function buildSingleHtml() {
  const single = [];
  single[0] = ['Unique App'];
  single[41] = [[null, null, '/store/apps/details?id=com.unique.app']];
  single[51] = [['4.7', 4.7]];
  single[57] = [];
  single[57][0] = [];
  single[57][0][0] = [];
  single[57][0][0][0] = [];
  single[57][0][0][0][1] = [];
  single[57][0][0][0][1][0] = [0, 'USD', ''];
  single[57][0][0][1] = ['Installer'];
  single[68] = [];
  single[68][0] = 'Single Dev';
  single[68][1] = [];
  single[68][1][4] = [];
  single[68][1][4][2] = '/store/apps/developer?id=SingleDev';
  single[73] = [[null, 'Single summary']];
  single[95] = [
    [
      null,
      2,
      [512, 512],
      [null, null, 'https://example.com/single-icon.png'],
    ],
  ];

  const cluster = [];
  cluster[23] = [];
  cluster[23][16] = [];
  cluster[23][16][2] = single;

  const ds4 = [
    [
      null,
      [cluster],
    ],
  ];

  return `<script>AF_initDataCallback({key: 'ds:4', data: ${JSON.stringify(ds4)}, sideChannel: {}});</script>`;
}

describe('modules/search', () => {
  afterEach(() => nock.cleanAll());

  it('parses store search first page data', async () => {
    const html = buildListHtml();

    const scope = nock(BASE_URL)
      .get((uri) => uri.startsWith('/store/search'))
      .reply(200, html, { 'Content-Type': 'text/html' });

    const res = await search(() => Promise.resolve(), { term: 'test', num: 1, lang: 'en', country: 'us' });
    expect(res).to.deep.equal([
      {
        title: 'My App',
        appId: 'com.test.app',
        url: 'https://play.google.com/store/apps/details?id=com.test.app',
        icon: 'https://example.com/icon.png',
        developer: 'DevCo',
        developerId: undefined,
        priceText: 'Install',
        currency: 'USD',
        price: 0,
        free: true,
        summary: 'Summary',
        scoreText: '4.5',
        score: 4.5,
      },
    ]);
    scope.done();
  });

  it('fetches full detail results using provided app fetcher', async () => {
    const html = buildListHtml();

    const scope = nock(BASE_URL)
      .get((uri) => uri.startsWith('/store/search'))
      .reply(200, html, { 'Content-Type': 'text/html' });

    const calls = [];
    const results = await search(async (args) => {
      calls.push(args);
      return { fetched: true, ...args };
    }, { term: 'detail', num: 1, lang: 'en', country: 'us', fullDetail: true });

    expect(calls).to.deep.equal([{ appId: 'com.test.app', lang: 'en', country: 'us' }]);
    expect(results).to.deep.equal([{ fetched: true, appId: 'com.test.app', lang: 'en', country: 'us' }]);
    scope.done();
  });

  it('handles single result layout', async () => {
    const html = buildSingleHtml();

    const scope = nock(BASE_URL)
      .get((uri) => uri.startsWith('/store/search'))
      .reply(200, html, { 'Content-Type': 'text/html' });

    const res = await search(() => Promise.resolve(), { term: 'unique', num: 1, lang: 'fr', country: 'fr' });
    expect(res).to.have.lengthOf(1);
    expect(res[0]).to.include({
      appId: 'com.unique.app',
      title: 'Unique App',
      developer: 'Single Dev',
      summary: 'Single summary',
      price: 0,
    });
    expect(res[0].score).to.equal(4.7);
    expect(res[0].icon).to.equal('https://example.com/single-icon.png');
    expect(res[0].developerId).to.equal('SingleDev');
    scope.done();
  });
});
