const { expect } = require('chai');
const nock = require('nock');
const { BASE_URL } = require('../dist/cjs/constants.js');
const datasafety = require('../dist/cjs/modules/datasafety.js').default;

describe('modules/datasafety', () => {
  afterEach(() => nock.cleanAll());

  it('parses datasafety entries from AF_initDataCallback', async () => {
    // Build ds:3 paths used by mapping
    const detail = ['email', false, 'ads'];
    const dataEntry = []; // one data entry block
    dataEntry[0] = [null, 'Personal info']; // type at [0,1]
    dataEntry[4] = [detail];
    const security = [null, 'Encrypt data', [null, 'Data is encrypted']];

    const ds3 = [];
    ds3[1] = [];
    ds3[1][2] = [];
    ds3[1][2][137] = [];
    ds3[1][2][137][4] = [];
    ds3[1][2][137][4][0] = [[dataEntry]];
    ds3[1][2][137][4][1] = [[dataEntry]];
    ds3[1][2][137][9] = [];
    ds3[1][2][137][9][2] = [security];
    ds3[1][2][99] = [];
    ds3[1][2][99][0] = [];
    ds3[1][2][99][0][5] = [];
    ds3[1][2][99][0][5][2] = 'https://privacy';

    const html = `<script>AF_initDataCallback({key: 'ds:3', data: ${JSON.stringify(ds3)}, sideChannel: {}});</script>`;
    const scope = nock(BASE_URL)
      .get(uri => uri.startsWith('/store/apps/datasafety'))
      .reply(200, html, { 'Content-Type': 'text/html' });

    const res = await datasafety({ appId: 'com.test', lang: 'en' });
    expect(res.sharedData).to.deep.equal([
      {
        data: 'email',
        optional: false,
        purpose: 'ads',
        type: 'Personal info',
      },
    ]);
    expect(res.collectedData).to.deep.equal([
      {
        data: 'email',
        optional: false,
        purpose: 'ads',
        type: 'Personal info',
      },
    ]);
    expect(res.securityPractices).to.deep.equal([
      { practice: 'Encrypt data', description: 'Data is encrypted' },
    ]);
    expect(res.privacyPolicyUrl).to.equal('https://privacy');
    scope.done();
  });

  it('returns empty arrays when sections are absent', async () => {
    const html = `<script>AF_initDataCallback({key: 'ds:3', data: [], sideChannel: {}});</script>`;
    const scope = nock(BASE_URL)
      .get(uri => uri.startsWith('/store/apps/datasafety'))
      .reply(200, html, { 'Content-Type': 'text/html' });

    const res = await datasafety({ appId: 'com.empty' });
    expect(res.sharedData).to.deep.equal([]);
    expect(res.collectedData).to.deep.equal([]);
    expect(res.securityPractices).to.deep.equal([]);
    expect(res.privacyPolicyUrl).to.equal(undefined);
    scope.done();
  });

  it('handles legacy structures without optional flags', async () => {
    const detail = ['location', null, null];
    const dataEntry = [];
    dataEntry[0] = [null, 'Location'];
    dataEntry[4] = [detail];
    const ds3 = [];
    ds3[1] = [];
    ds3[1][2] = [];
    ds3[1][2][137] = [];
    ds3[1][2][137][4] = [];
    ds3[1][2][137][4][0] = [[dataEntry]];

    const html = `<script>AF_initDataCallback({key: 'ds:3', data: ${JSON.stringify(ds3)}, sideChannel: {}});</script>`;
    const scope = nock(BASE_URL)
      .get(uri => uri.startsWith('/store/apps/datasafety'))
      .reply(200, html, { 'Content-Type': 'text/html' });

    const res = await datasafety({ appId: 'com.legacy' });
    expect(res.sharedData[0].optional).to.equal(null);
    expect(res.sharedData[0].purpose).to.equal(null);
    scope.done();
  });
});
