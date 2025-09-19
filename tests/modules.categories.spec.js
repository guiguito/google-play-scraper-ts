const { expect } = require('chai');
const nock = require('nock');
const { BASE_URL } = require('../dist/cjs/constants.js');
const categories = require('../dist/cjs/modules/categories.js').default;

describe('modules/categories', () => {
  afterEach(() => nock.cleanAll());

  it('parses category links from homepage', async () => {
    const html = `
      <ul>
        <li><a href="/store/apps/category/GAME">Games</a></li>
        <li><a href="/store/apps/category/TOOLS">Tools</a></li>
        <li><a href="/store/apps?something=1">Ignore</a></li>
      </ul>`;
    const scope = nock(BASE_URL).get('/store/apps').reply(200, html, { 'Content-Type': 'text/html' });
    const res = await categories();
    expect(res).to.include('GAME');
    expect(res).to.include('TOOLS');
    expect(res).to.include('APPLICATION');
    scope.done();
  });
});
