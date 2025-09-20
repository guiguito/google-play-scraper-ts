const { expect } = require('chai');
const nock = require('nock');
const { BASE_URL, constants } = require('../dist/cjs/constants.js');
const list = require('../dist/cjs/modules/list.js').default;

function buildListItem() {
  const item = [];
  item[0] = [];
  item[0][3] = 'My App';
  item[0][0] = ['com.test.app'];
  item[0][10] = [null, null, null, null, ['', '', '/store/apps/details?id=com.test.app']];
  item[0][1] = [null, [null, [null, ''], ['', '', 'https://icon']]];
  item[0][14] = 'Dev';
  item[0][8] = [null, [null, [0, 'USD']]];
  item[0][4] = [['4.5', 4.5]];
  item[0][13] = [null, 'Summary'];
  return item;
}

function buildCollectionPayload(items) {
  const data = [];
  data[0] = [];
  data[0][1] = [];
  data[0][1][0] = [];
  data[0][1][0][28] = [];
  data[0][1][0][28][0] = items;
  return data;
}

describe('modules/list', () => {
  afterEach(() => nock.cleanAll());

  it('parses collection apps from batchexecute response', async () => {
    const data = buildCollectionPayload([buildListItem()]);
    const input = [[null, null, JSON.stringify(data)]];
    const body = `x\ny\nz\n${JSON.stringify(input)}\n`;

    const scope = nock(BASE_URL)
      .post(/\/batchexecute/)
      .reply(200, body, { 'Content-Type': 'text/plain' });

    const res = await list({ category: constants.category.APPLICATION, collection: constants.collection.TOP_FREE, num: 1, lang: 'en', country: 'us' });
    expect(res).to.have.length(1);
    expect(res[0].appId).to.equal('com.test.app');
    scope.done();
  });

  it('encodes collection and category in the batchexecute request body', async () => {
    const data = buildCollectionPayload([]);
    const input = [[null, null, JSON.stringify(data)]];
    const responseBody = `x\ny\nz\n${JSON.stringify(input)}\n`;

    let capturedBody = '';
    const scope = nock(BASE_URL)
      .post(/\/batchexecute/, (body) => {
        if (Buffer.isBuffer(body)) {
          capturedBody = body.toString('utf8');
        } else if (typeof body === 'string') {
          capturedBody = body;
        } else {
          capturedBody = JSON.stringify(body);
        }
        return true;
      })
      .reply(200, responseBody, { 'Content-Type': 'text/plain' });

    await list({
      category: constants.category.APPLICATION,
      collection: constants.collection.TOP_FREE,
      num: 1,
      lang: 'en',
      country: 'us',
    });

    expect(capturedBody).to.include('topselling_free');
    expect(capturedBody).to.include('APPLICATION');
    scope.done();
  });

  it('retrieves full detail when requested', async () => {
    const detailItem = buildListItem();
    detailItem[0][3] = 'Detail App';
    detailItem[0][0] = ['com.detail.app'];
    const data = buildCollectionPayload([detailItem]);
    const input = [[null, null, JSON.stringify(data)]];
    const body = `x\ny\nz\n${JSON.stringify(input)}\n`;

    const listScope = nock(BASE_URL)
      .post(/\/batchexecute/)
      .reply(200, body, { 'Content-Type': 'text/plain' });

    const details = [];
    details[1] = [];
    details[1][2] = [];
    details[1][2][0] = [];
    details[1][2][0][0] = 'Detail App';

    const appHtml = `<script>AF_initDataCallback({key: 'ds:5', data: ${JSON.stringify(details)}, sideChannel: {}});</script>`;
    const appScope = nock(BASE_URL)
      .get(uri => uri.startsWith('/store/apps/details'))
      .reply(200, appHtml, { 'Content-Type': 'text/html' });

    const res = await list({
      category: constants.category.APPLICATION,
      collection: constants.collection.TOP_FREE,
      num: 1,
      lang: 'en',
      country: 'us',
      fullDetail: true,
    });

    expect(res).to.have.length(1);
    expect(res[0].title).to.equal('Detail App');
    listScope.done();
    appScope.done();
  });
});
