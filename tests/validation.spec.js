const { expect } = require('chai');
const { constants } = require('../dist/cjs/constants.js');
const app = require('../dist/cjs/modules/app.js').default;
const search = require('../dist/cjs/modules/search.js').default;
const list = require('../dist/cjs/modules/list.js').default;
const developer = require('../dist/cjs/modules/developer.js').default;
const permissions = require('../dist/cjs/modules/permissions.js').default;
const reviews = require('../dist/cjs/modules/reviews.js').default;

describe('validation and edge cases', () => {
  it('app: throws when appId missing', async () => {
    let threw = false;
    try { // @ts-ignore
      await app({});
    } catch (e) { threw = true; }
    expect(threw).to.equal(true);
  });

  it('search: throws when term missing and when num > 250', async () => {
    let threw1 = false; let threw2 = false;
    try { // @ts-ignore
      await search(() => Promise.resolve(), {});
    } catch (e) { threw1 = true; }
    try {
      await search(() => Promise.resolve(), { term: 'x', num: 300 });
    } catch (e) { threw2 = true; }
    expect(threw1).to.equal(true);
    expect(threw2).to.equal(true);
  });

  it('list: throws on invalid category/collection', async () => {
    let a=false,b=false;
    try { await list({ category: 'BAD', collection: constants.collection.TOP_FREE }); } catch { a=true; }
    try { await list({ category: constants.category.APPLICATION, collection: 'BAD' }); } catch { b=true; }
    expect(a && b).to.equal(true);
  });

  it('developer: throws when devId missing', async () => {
    let threw=false; try { // @ts-ignore
      await developer({}); } catch { threw=true; }
    expect(threw).to.equal(true);
  });

  it('permissions: throws when appId missing', async () => {
    let threw=false; try { // @ts-ignore
      await permissions({}); } catch { threw=true; }
    expect(threw).to.equal(true);
  });

  it('reviews: throws on invalid sort', async () => {
    let threw=false; try { await reviews({ appId: 'com.test', sort: 999 }); } catch { threw=true; }
    expect(threw).to.equal(true);
  });
});
