const { expect } = require('chai');
const nock = require('nock');
const { BASE_URL } = require('../dist/cjs/constants.js');
const { processPages, checkFinished } = require('../dist/cjs/utils/processPages.js');

function buildListEntry({ title, appId }) {
  const entry = [];
  entry[2] = title;
  entry[12] = [appId];
  entry[9] = [null, null, null, null, ['', '', `/store/apps/details?id=${appId}`]];
  entry[1] = [];
  entry[1][1] = [];
  entry[1][1][0] = [];
  entry[1][1][0][3] = [];
  entry[1][1][0][3][2] = 'https://icon.example';
  entry[4] = [];
  entry[4][0] = [];
  entry[4][0][0] = [];
  entry[4][0][0][0] = 'Dev';
  entry[7] = [null, null, null, null, null, null, null, null, null, null, null, null];
  entry[6] = [null, [null, [null, null, null, null, null, null, null, null, null, null, null, null]]];
  return entry;
}

describe('utils/processPages', () => {
  afterEach(() => nock.cleanAll());

  it('extracts a page of apps without pagination', async () => {
    const entry = buildListEntry({ title: 'First', appId: 'com.first' });
    const data = [];
    data[0] = [];
    data[0][0] = [];
    data[0][0][0] = [entry];
    data[0][0][7] = [];
    data[0][0][7][1] = null;

    const apps = await processPages(
      data,
      { num: 1, numberOfApps: 1, fullDetail: false, lang: 'en', country: 'us' },
      [],
      { apps: [0, 0, 0], token: [0, 0, 7, 1] }
    );

    expect(apps).to.have.length(1);
    expect(apps[0].appId).to.equal('com.first');
  });

  it('fetches the next page when a token is present', async () => {
    const entry = buildListEntry({ title: 'Second', appId: 'com.second' });
    const payload = [];
    payload[0] = [];
    payload[0][0] = [];
    payload[0][0][0] = [entry];
    payload[0][0][7] = [];
    payload[0][0][7][1] = null;

    const response = `)]}'\n${JSON.stringify([[null, null, JSON.stringify(payload)]])}`;

    const scope = nock(BASE_URL)
      .post(/\/batchexecute/)
      .reply(200, response, { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' });

    const result = await checkFinished(
      { num: 2, numberOfApps: 1, fullDetail: false, lang: 'en', country: 'us' },
      [{ appId: 'com.first', title: 'First' }],
      'TOKEN'
    );

    expect(result).to.have.length(2);
    expect(result[1].appId).to.equal('com.second');
    scope.done();
  });

  it('caps batchexecute page size to 200 when higher values are requested', async () => {
    const entry = buildListEntry({ title: 'Second', appId: 'com.second' });
    const payload = [];
    payload[0] = [];
    payload[0][0] = [];
    payload[0][0][0] = [entry];
    payload[0][0][7] = [];
    payload[0][0][7][1] = null;

    const response = `)]}'\n${JSON.stringify([[null, null, JSON.stringify(payload)]])}`;

    const scope = nock(BASE_URL)
      .post(/\/batchexecute/, (body) => {
        const serialized = typeof body === 'string' ? body : JSON.stringify(body);
        return serialized.includes('[10,[10,200]]') && !serialized.includes('[10,[10,250]]');
      })
      .reply(200, response, { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' });

    const result = await checkFinished(
      { num: 250, numberOfApps: 250, fullDetail: false, lang: 'en', country: 'us' },
      [{ appId: 'com.first', title: 'First' }],
      'TOKEN'
    );

    expect(result).to.have.length(2);
    expect(result[1].appId).to.equal('com.second');
    scope.done();
  });
});
