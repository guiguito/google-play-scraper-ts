// Live smoke tests against the real Play Store: one call per method, checking that key fields are
// still populated. They catch Play layout changes (and stale batchexecute params) that offline
// fixtures can't. Skipped unless LIVE=1; run with `npm run test:live` (also weekly in CI).
const { expect } = require('chai');
const gplay = require('../dist/cjs/index.js').default;

const APP_ID = 'com.spotify.music';
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

(process.env.LIVE === '1' ? describe : describe.skip)('live Play Store smoke', function () {
  this.timeout(60_000);
  this.retries(1);

  it('app', async () => {
    const app = await gplay.app({ appId: APP_ID });
    expect(app.title).to.satisfy(nonEmpty);
    expect(app.developer).to.satisfy(nonEmpty);
    expect(app.icon).to.match(/^https:\/\//);
    expect(app.installs).to.satisfy(nonEmpty);
    expect(app.score).to.be.a('number');
    expect(app.version).to.satisfy(nonEmpty);
  });

  it('list', async () => {
    const apps = await gplay.list({ num: 5, backfillSummaries: false });
    expect(apps).to.have.length.greaterThan(0);
    for (const a of apps) {
      expect(a.appId).to.satisfy(nonEmpty);
      expect(a.title).to.satisfy(nonEmpty);
    }
  });

  it('search', async () => {
    const apps = await gplay.search({ term: 'spotify', num: 3, backfillSummaries: false });
    expect(apps.map((a) => a.appId)).to.include(APP_ID);
  });

  it('suggest', async () => {
    const terms = await gplay.suggest({ term: 'spot' });
    expect(terms).to.have.length.greaterThan(0);
    terms.forEach((t) => expect(t).to.satisfy(nonEmpty));
  });

  it('developer', async () => {
    const apps = await gplay.developer({ devId: 'Spotify AB', num: 5, backfillSummaries: false });
    expect(apps.map((a) => a.appId)).to.include(APP_ID);
  });

  it('reviews', async () => {
    const { data } = await gplay.reviews({ appId: APP_ID, num: 5 });
    expect(data).to.have.length.greaterThan(0);
    expect(data[0].text).to.satisfy(nonEmpty);
    expect(data[0].date).to.satisfy(nonEmpty);
  });

  it('similar', async () => {
    const apps = await gplay.similar({ appId: APP_ID, backfillSummaries: false });
    expect(apps).to.have.length.greaterThan(0);
    expect(apps.map((a) => a.appId)).to.not.include(APP_ID);
  });

  it('permissions', async () => {
    const perms = await gplay.permissions({ appId: APP_ID, short: true });
    expect(perms).to.have.length.greaterThan(0);
  });

  it('datasafety', async () => {
    const safety = await gplay.datasafety({ appId: APP_ID });
    expect(safety.collectedData.length + safety.sharedData.length).to.be.greaterThan(0);
  });
});
