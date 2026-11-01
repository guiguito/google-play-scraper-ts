const { expect } = require('chai');
const { constants } = require('../dist/cjs/constants.js');
const categories = require('../dist/cjs/modules/categories.js').default;

describe('modules/categories', () => {
  // Play's /store/apps no longer renders a category menu (Nov 2026), so categories() returns the
  // known list. Net connect is disabled in tests: any request would make this fail.
  it('returns every known category without a network request', async () => {
    const res = await categories();
    expect(res).to.have.members(Object.values(constants.category));
    expect(res).to.have.lengthOf(Object.values(constants.category).length);
  });
});
