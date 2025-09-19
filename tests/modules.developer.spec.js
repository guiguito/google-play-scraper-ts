const { expect } = require('chai');
const nock = require('nock');
const { BASE_URL } = require('../dist/cjs/constants.js');
const developer = require('../dist/cjs/modules/developer.js').default;

describe('modules/developer', () => {
  afterEach(() => nock.cleanAll());

  it('parses developer apps from AF_initDataCallback', async () => {
    // Build ds:3 so that path [0,1,0,22,0] is the apps list
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

    const ds3 = [];
    ds3[0] = [];
    ds3[0][1] = [];
    ds3[0][1][0] = [];
    ds3[0][1][0][22] = [];
    ds3[0][1][0][22][0] = [item];
    // token at [0,1,0,22,1,3,1] omitted

    const html = `<script>AF_initDataCallback({key: 'ds:3', data: ${JSON.stringify(ds3)}, sideChannel: {}});</script>`;
    const scope = nock(BASE_URL)
      .get(uri => uri.startsWith('/store/apps/developer'))
      .reply(200, html, { 'Content-Type': 'text/html' });

    const res = await developer({ devId: 'Acme', num: 1, lang: 'en', country: 'us' });
    expect(res).to.have.length(1);
    expect(res[0].appId).to.equal('com.test.app');
    scope.done();
  });
});
