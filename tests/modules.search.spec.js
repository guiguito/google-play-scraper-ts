const { expect } = require('chai');
const nock = require('nock');
const { BASE_URL } = require('../dist/cjs/constants.js');
const searchModule = require('../dist/cjs/modules/search.js');

const search = searchModule.default;

function buildStoreListItem({
  appId = 'com.test.app',
  title = 'My App',
  icon = 'https://example.com/icon.png',
  developer = 'DevCo',
  scoreText = '4.5',
  score = 4.5,
  currency = 'USD',
  summary = 'Summary<br>line',
  installLabel = 'Install',
} = {}) {
  const item = [];
  item[0] = [appId, 7];
  item[1] = [null, 2, [512, 512], [null, null, icon]];
  item[3] = title;
  item[4] = [scoreText, score];
  item[8] = [null, [[0, currency, '']]];
  item[10] = [null, null, null, null, ['', '', `/store/apps/details?id=${appId}`]];
  item[13] = [null, summary];
  item[14] = developer;
  item[25] = [
    [
      [null, [installLabel]],
    ],
  ];
  return item;
}

function buildStoreListDs4(items, token = null) {
  const listCluster = [];
  listCluster[22] = [
    items.map((item) => [item]),
    [
      '',
      null,
      null,
      token ? [null, token] : null,
      1,
    ],
  ];

  const ds4 = [
    [
      null,
      [listCluster],
    ],
  ];

  return ds4;
}

function buildStoreSearchHtml({
  ds4,
  includeRpcDescriptor = false,
  requestDescriptor = null,
  wizGlobalData = { FdrFJe: '-123456789', cfb2h: 'boq_playuiserver_20990101.00_p0' },
} = {}) {
  const ds4Script = `<script>AF_initDataCallback({key: 'ds:4', data: ${JSON.stringify(ds4)}, sideChannel: {}});</script>`;
  if (!includeRpcDescriptor || !requestDescriptor) return ds4Script;
  const wizScript = `<script>WIZ_global_data = ${JSON.stringify(wizGlobalData)};</script>`;
  const serviceRequests =
    `<script>; var AF_dataServiceRequests = {'ds:4': {id: 'lGYRle', request: ${JSON.stringify(requestDescriptor)}}};` +
    ' var AF_initDataChunkQueue = []; </script>';
  return `${wizScript}${serviceRequests}${ds4Script}`;
}

function buildListHtml() {
  const ds4 = buildStoreListDs4([buildStoreListItem()], 'TOKEN123');
  return buildStoreSearchHtml({ ds4 });
}

function buildSingleHtml(options = {}) {
  const summary = Object.prototype.hasOwnProperty.call(options, 'summary')
    ? options.summary
    : 'Single summary';
  const description = options.description;
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
  if (summary !== undefined) {
    single[73] = [[null, summary]];
  }
  if (description !== undefined) {
    single[72] = [[null, description]];
  }
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

  it('backfills missing summary with app details when fullDetail is false', async () => {
    const html = buildSingleHtml({ summary: undefined, description: 'This is the full app description' });

    const scope = nock(BASE_URL)
      .get((uri) => uri.startsWith('/store/search'))
      .reply(200, html, { 'Content-Type': 'text/html' });

    const calls = [];
    const res = await search(async (args) => {
      calls.push(args);
      return { summary: 'Tap to pay with your phone' };
    }, { term: 'wallet', num: 1, lang: 'en', country: 'us', fullDetail: false });

    expect(calls).to.deep.equal([{ appId: 'com.unique.app', lang: 'en', country: 'us' }]);
    expect(res).to.have.lengthOf(1);
    expect(res[0].summary).to.equal('Tap to pay with your phone');
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

  it('does not use full description as summary when single-result summary is missing', async () => {
    const html = buildSingleHtml({ summary: undefined, description: 'This is the full app description' });

    const scope = nock(BASE_URL)
      .get((uri) => uri.startsWith('/store/search'))
      .reply(200, html, { 'Content-Type': 'text/html' });

    const res = await search(() => Promise.resolve(), { term: 'unique', num: 1, lang: 'en', country: 'us' });
    expect(res).to.have.lengthOf(1);
    expect(res[0].summary).to.equal(undefined);
    scope.done();
  });

  it('uses modern store RPC when descriptor is available and caps requested page size to 60', async () => {
    const firstPageDs4 = buildStoreListDs4([buildStoreListItem({ appId: 'com.first' })], null);
    const requestDescriptor = [[[], [[8, [20, 20]]], ['test'], 4, [null, 1], null, null, [], [1]], [1]];
    const html = buildStoreSearchHtml({ ds4: firstPageDs4, includeRpcDescriptor: true, requestDescriptor });

    const rpcDs4 = buildStoreListDs4(
      [
        buildStoreListItem({ appId: 'com.first' }),
        buildStoreListItem({ appId: 'com.second', title: 'Second App', developer: 'Second Dev' }),
        buildStoreListItem({ appId: 'com.third', title: 'Third App', developer: 'Third Dev' }),
      ],
      null
    );
    const rpcResponse = `)]}'\n${JSON.stringify([['wrb.fr', 'lGYRle', JSON.stringify(rpcDs4), null, null, null, 'generic']])}`;

    const getScope = nock(BASE_URL)
      .get((uri) => uri.startsWith('/store/search'))
      .reply(200, html, { 'Content-Type': 'text/html' });

    const postScope = nock(BASE_URL)
      .post((uri) => uri.startsWith('/_/PlayStoreUi/data/batchexecute?rpcids=lGYRle'), (body) => {
        const serialized = typeof body === 'string' ? decodeURIComponent(body) : JSON.stringify(body);
        return serialized.includes('lGYRle') && serialized.includes('[20,60]');
      })
      .reply(200, rpcResponse, { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' });

    const res = await search(() => Promise.resolve(), { term: 'test', num: 200, lang: 'en', country: 'us' });
    expect(res).to.have.lengthOf(3);
    expect(res.map((item) => item.appId)).to.deep.equal(['com.first', 'com.second', 'com.third']);

    getScope.done();
    postScope.done();
  });

  it('falls back to first page when modern store RPC returns no payload', async () => {
    const firstPageDs4 = buildStoreListDs4([buildStoreListItem({ appId: 'com.first' })], null);
    const requestDescriptor = [[[], [[8, [20, 20]]], ['test'], 4, [null, 1], null, null, [], [1]], [1]];
    const html = buildStoreSearchHtml({ ds4: firstPageDs4, includeRpcDescriptor: true, requestDescriptor });
    const rpcError = `)]}'\n${JSON.stringify([['wrb.fr', 'lGYRle', null, null, null, [3], 'generic']])}`;

    const getScope = nock(BASE_URL)
      .get((uri) => uri.startsWith('/store/search'))
      .reply(200, html, { 'Content-Type': 'text/html' });

    const postScope = nock(BASE_URL)
      .post((uri) => uri.startsWith('/_/PlayStoreUi/data/batchexecute?rpcids=lGYRle'))
      .reply(200, rpcError, { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' });

    const res = await search(() => Promise.resolve(), { term: 'test', num: 3, lang: 'en', country: 'us' });
    expect(res).to.have.lengthOf(1);
    expect(res[0].appId).to.equal('com.first');

    getScope.done();
    postScope.done();
  });
});
