const { expect } = require('chai');
const nock = require('nock');
const { BASE_URL } = require('../dist/cjs/constants.js');
const app = require('../dist/cjs/modules/app.js').default;

function setPath(root, path, value) {
  let cursor = root;
  for (let i = 0; i < path.length; i += 1) {
    const key = path[i];
    const isLast = i === path.length - 1;
    const nextKey = path[i + 1];
    const containerKey = typeof key === 'number' ? key : key;
    if (isLast) {
      cursor[containerKey] = value;
      return;
    }
    if (cursor[containerKey] == null) {
      const nextIsArray = typeof nextKey === 'number' || Number.isInteger(Number(nextKey));
      cursor[containerKey] = nextIsArray ? [] : {};
    }
    cursor = cursor[containerKey];
  }
}

describe('modules/app', () => {
  afterEach(() => nock.cleanAll());

  it('parses details from AF_initDataCallback payload', async () => {
    const details = [];
    setPath(details, [1, 2, 0, 0], 'Test App');
    setPath(details, [1, 2, 68, 0], 'Test Dev');
    setPath(details, [1, 2, 95, 0, 3, 2], 'https://cdn.example/icon.png');
    const legal = [];
    legal[4] = [];
    legal[4][2] = [];
    legal[4][2][0] = [];
    legal[4][2][0][0] = '123 Main St\nCity';
    setPath(details, [1, 2, 69], legal);
    setPath(details, [1, 2, 79, 0, 0, 0], 'Games');
    setPath(details, [1, 2, 79, 0, 0, 2], 'GAME');
    const screenshot = [];
    screenshot[3] = [];
    screenshot[3][2] = 'https://cdn.example/screen.png';
    setPath(details, [1, 2, 78, 0], [screenshot]);
    setPath(details, [1, 2, 18, 0], 1);
    setPath(details, [1, 2, 62], 'playpass');

    const html = `<!doctype html><html><body>
      <script>AF_initDataCallback({key: 'ds:5', data: ${JSON.stringify(details)}, sideChannel: {}});</script>
    </body></html>`;

    const scope = nock(BASE_URL)
      .get(uri => uri.startsWith('/store/apps/details'))
      .reply(200, html, { 'Content-Type': 'text/html' });

    const result = await app({ appId: 'com.test.app', lang: 'en', country: 'us' });

    expect(result.title).to.equal('Test App');
    expect(result.developer).to.equal('Test Dev');
    expect(result.icon).to.equal('https://cdn.example/icon.png');
    expect(result.developerLegalAddress).to.equal('123 Main St, City');
    expect(result.screenshots).to.deep.equal(['https://cdn.example/screen.png']);
    expect(result.url).to.equal(`${BASE_URL}/store/apps/details?id=com.test.app&hl=en&gl=us`);
    expect(result.categories).to.deep.equal([{ name: 'Games', id: 'GAME' }]);
    expect(result.available).to.equal(true);
    expect(result.isAvailableInPlayPass).to.equal(true);
    scope.done();
  });

  it('applies fallbacks for missing fields and normalizes values', async () => {
    const details = [];
    setPath(details, [1, 2, 57, 0, 0, 0, 0, 1, 0, 0], 1_230_000_00);
    setPath(details, [1, 2, 57, 0, 0, 0, 0, 1, 1, 0], 2_000_000_00);
    setPath(details, [1, 2, 57, 0, 0, 0, 0, 1, 0, 2], undefined);
    setPath(details, [1, 2, 18, 0], 0);
    const fallbackCategory = [];
    fallbackCategory[0] = 'Fallback';
    fallbackCategory[2] = 'FALLBACK';
    setPath(details, [1, 2, 79, 0, 0], fallbackCategory);
    setPath(details, [1, 2, 145, 0, 1, 0], 123);
    setPath(details, [1, 2, 140, 0, 0, 0], undefined);

    const comment = [];
    comment[1] = [];
    comment[1][0] = 'Author';
    comment[10] = '1.0';
    comment[5] = [];
    comment[5][0] = Date.now();
    comment[4] = 'Great';
    const ds8 = [[comment]];

    const html = `
      <script>AF_initDataCallback({key: 'ds:5', data: ${JSON.stringify(details)}, sideChannel: {}});</script>
      <script>AF_initDataCallback({key: 'ds:8', data: ${JSON.stringify(ds8)}, sideChannel: {}});</script>
    `;

    const scope = nock(BASE_URL)
      .get(uri => uri.startsWith('/store/apps/details'))
      .reply(200, html, { 'Content-Type': 'text/html' });

    const result = await app({ appId: 'com.test.app', lang: 'en', country: 'us' });

    expect(result.price).to.equal(123);
    expect(result.originalPrice).to.equal(200);
    expect(result.priceText).to.equal('Free');
    expect(result.free).to.equal(false);
    expect(result.categories).to.deep.equal([{ name: 'Fallback', id: 'FALLBACK' }]);
    expect(result.updated).to.equal(123000);
    expect(result.version).to.equal('VARY');
    expect(result.comments).to.deep.equal(['Great']);
    scope.done();
  });
});
