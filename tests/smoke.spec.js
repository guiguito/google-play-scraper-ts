const { expect } = require('chai');
const api = require('../dist/cjs/index.js').default;
const { constants } = require('../dist/cjs/index.js');
const { pathToFileURL } = require('node:url');

describe('smoke', () => {
  it('exports constants and memoized', () => {
    expect(constants).to.be.an('object');
    expect(api).to.have.property('memoized');
  });

  it('supports ESM import default export', async function () {
    this.timeout(5000);
    const esmPath = pathToFileURL(require.resolve('../dist/esm/index.js')).href;
    const esm = await import(esmPath);
    expect(typeof esm.default?.app).to.equal('function');
  });
});
