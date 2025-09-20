const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const nock = require('nock');
const { BASE_URL } = require('../dist/cjs/constants.js');
const similar = require('../dist/cjs/modules/similar.js').default;

describe('modules/similar live fixture (optional)', () => {
  afterEach(() => nock.cleanAll());

  it('parses from recorded details/cluster fixtures when available', async function () {
    if (!process.env.USE_FIXTURE) return this.skip();
    const appId = process.env.FIXTURE_APPID || 'com.spotify.music';
    const lang = process.env.FIXTURE_LANG || 'en';
    const country = process.env.FIXTURE_COUNTRY || 'us';
    const base = `${appId}.${lang}-${country}`;
    const dir = path.join(__dirname, '..', 'fixtures', 'similar');
    const detailsPath = path.join(dir, `${base}.details.html`);
    const clusterPath = path.join(dir, `${base}.cluster.html`);
    if (!fs.existsSync(detailsPath)) return this.skip();

    const detailsHtml = fs.readFileSync(detailsPath, 'utf8');
    const clusterHtml = fs.existsSync(clusterPath) ? fs.readFileSync(clusterPath, 'utf8') : null;

    const scope1 = nock(BASE_URL)
      .get((uri) => uri.startsWith('/store/apps/details'))
      .reply(200, detailsHtml, { 'Content-Type': 'text/html' });

    if (clusterHtml) {
      nock(BASE_URL)
        .get((uri) => uri.startsWith('/store/apps/collection/cluster'))
        .reply(200, clusterHtml, { 'Content-Type': 'text/html' });
    }

    const res = await similar({ appId, lang, country });
    expect(res.length).to.be.greaterThan(0);
    scope1.done();
  });
});

