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

  it('createPlayStoreApi keeps proxies set with configureProxies unless proxies is passed', () => {
    const { configureProxies, createPlayStoreApi } = require('../dist/cjs/index.js');
    const { getProxyForCountry } = require('../dist/cjs/http/proxyConfig.js');
    configureProxies({ default: { host: 'p.example', port: 8080 } });
    createPlayStoreApi({ memoize: { maxAge: 1000 } });
    expect(getProxyForCountry('us')?.host).to.equal('p.example');
    createPlayStoreApi({ proxies: null });
    expect(getProxyForCountry('us')).to.equal(undefined);
  });
});
