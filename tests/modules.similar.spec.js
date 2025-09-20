const { expect } = require('chai');
const nock = require('nock');
const { BASE_URL } = require('../dist/cjs/constants.js');
const similar = require('../dist/cjs/modules/similar.js').default;

describe('modules/similar', () => {
  afterEach(() => nock.cleanAll());

  it('fetches cluster and parses similar apps', async () => {
    // Details page with AF_dataServiceRequests providing clusters
    const cluster = [];
    cluster[21] = [null, ['Similar apps', null, [null, null, null, null, ['', '', '/store/apps/collection/cluster']]]];
    // eslint-disable-next-line no-useless-escape
    const clusterText = JSON.stringify([cluster]).replace(/\"/g, "'");
    const dsText = `{'ds:tag': { id: 'ag2B9c', 1: { 1: ${clusterText} } }}`;
    const afInit = `<script>AF_initDataCallback({key: 'ds:tag', data: ${JSON.stringify({ 1: { 1: [cluster] } })}, sideChannel: {}});</script>`;
    const legacyHtml = `<script>AF_initDataCallback({key: 'ds:3', data: null, sideChannel: {}});</script>`;
    const detailsHtml = `${afInit}; var AF_dataServiceRequests ${dsText}; var AF_initDataChunkQueue${legacyHtml}`;

    const clusterItem = [];
    clusterItem[2] = 'App X';
    clusterItem[12] = ['com.cluster.app'];
    clusterItem[9] = [null, null, null, null, ['', '', '/store/apps/details?id=com.cluster.app']];
    const ds3 = [];
    ds3[0] = [];
    ds3[0][1] = [];
    ds3[0][1][0] = [];
    ds3[0][1][0][21] = [];
    ds3[0][1][0][21][0] = [clusterItem];
    const clusterHtml = `<script>AF_initDataCallback({key: 'ds:3', data: ${JSON.stringify(ds3)}, sideChannel: {}});</script>`;

    const scope1 = nock(BASE_URL)
      .get(uri => uri.startsWith('/store/apps/details'))
      .reply(200, detailsHtml, { 'Content-Type': 'text/html' });
    const scope2 = nock(BASE_URL)
      .get(uri => uri.startsWith('/store/apps/collection/cluster'))
      .reply(200, clusterHtml, { 'Content-Type': 'text/html' });

    const res = await similar({ appId: 'com.foo', lang: 'en', country: 'us' });
    expect(Array.isArray(res)).to.equal(true);
    scope1.done();
    scope2.done();
  });

  it('falls back to service requests when cluster id changes', async () => {
    const cluster = [];
    cluster[21] = [null, ['Similar apps', null, [null, null, null, null, ['', '', '/store/apps/collection/cluster/fallback']]]];
    const clusterText = JSON.stringify([cluster]).replace(/\"/g, "'");
    const dsText = `{'ds:tag': { id: 'new-cluster-id', 1: { 1: ${clusterText} } }}`;
    const afInit = `<script>AF_initDataCallback({key: 'ds:tag', data: ${JSON.stringify({ 1: { 1: [cluster] } })}, sideChannel: {}});</script>`;
    const legacyHtml = `<script>AF_initDataCallback({key: 'ds:3', data: null, sideChannel: {}});</script>`;
    const detailsHtml = `${afInit}; var AF_dataServiceRequests ${dsText}; var AF_initDataChunkQueue${legacyHtml}`;

    const clusterItem = [];
    clusterItem[2] = 'Fallback App';
    clusterItem[12] = ['com.fallback.app'];
    clusterItem[9] = [null, null, null, null, ['', '', '/store/apps/details?id=com.fallback.app']];
    const ds3 = [];
    ds3[0] = [];
    ds3[0][1] = [];
    ds3[0][1][0] = [];
    ds3[0][1][0][21] = [];
    ds3[0][1][0][21][0] = [clusterItem];
    const clusterHtml = `<script>AF_initDataCallback({key: 'ds:3', data: ${JSON.stringify(ds3)}, sideChannel: {}});</script>`;

    const scope1 = nock(BASE_URL)
      .get(uri => uri.startsWith('/store/apps/details'))
      .reply(200, detailsHtml, { 'Content-Type': 'text/html' });
    const scope2 = nock(BASE_URL)
      .get(uri => uri.startsWith('/store/apps/collection/cluster/fallback'))
      .reply(200, clusterHtml, { 'Content-Type': 'text/html' });

    const res = await similar({ appId: 'com.foo', lang: 'en', country: 'us' });
    expect(res[0].appId).to.equal('com.fallback.app');
    scope1.done();
    scope2.done();
  });

  it('finds clusters nested inside service request objects', async () => {
    const cluster = [];
    cluster[21] = [null, ['Similar games', null, [null, null, null, null, ['', '', '/store/apps/collection/cluster/nested']]]];
    const nested = { wrapper: cluster };
    const nestedText = JSON.stringify(nested).replace(/"/g, "'");
    const dsText = `{'ds:tag': { id: 'ag2B9c', 1: { 1: ${nestedText} } }}`;
    const afInit = `<script>AF_initDataCallback({key: 'ds:tag', data: ${JSON.stringify({ 1: { 1: nested } })}, sideChannel: {}});</script>`;
    const detailsHtml = `${afInit}; var AF_dataServiceRequests ${dsText}; var AF_initDataChunkQueue`;

    const clusterItem = [];
    clusterItem[2] = 'Nested App';
    clusterItem[12] = ['com.nested.app'];
    clusterItem[9] = [null, null, null, null, ['', '', '/store/apps/details?id=com.nested.app']];
    const ds3 = [];
    ds3[0] = [];
    ds3[0][1] = [];
    ds3[0][1][0] = [];
    ds3[0][1][0][21] = [];
    ds3[0][1][0][21][0] = [clusterItem];
    const clusterHtml = `<script>AF_initDataCallback({key: 'ds:3', data: ${JSON.stringify(ds3)}, sideChannel: {}});</script>`;
    const scope1 = nock(BASE_URL)
      .get(uri => uri.startsWith('/store/apps/details'))
      .reply(200, detailsHtml, { 'Content-Type': 'text/html' });
    const scope2 = nock(BASE_URL)
      .get(uri => uri.startsWith('/store/apps/collection/cluster/nested'))
      .reply(200, clusterHtml, { 'Content-Type': 'text/html' });

    const res = await similar({ appId: 'com.foo', lang: 'en', country: 'us' });
    expect(res[0].appId).to.equal('com.nested.app');
    scope1.done();
    scope2.done();
  });

  it('falls back to the first cluster when labels change', async () => {
    const cluster = [];
    cluster[21] = [null, ['Recommended for you', null, [null, null, null, null, ['', '', '/store/apps/collection/cluster/recommended']]]];
    const clusterText = JSON.stringify([cluster]).replace(/\"/g, "'");
    const dsText = `{'ds:tag': { id: 'ag2B9c', 1: { 1: ${clusterText} } }}`;
    const afInit = `<script>AF_initDataCallback({key: 'ds:tag', data: ${JSON.stringify({ 1: { 1: [cluster] } })}, sideChannel: {}});</script>`;
    const detailsHtml = `${afInit}; var AF_dataServiceRequests ${dsText}; var AF_initDataChunkQueue`;

    const clusterItem = [];
    clusterItem[2] = 'Label Change App';
    clusterItem[12] = ['com.labelchange.app'];
    clusterItem[9] = [null, null, null, null, ['', '', '/store/apps/details?id=com.labelchange.app']];
    const ds3 = [];
    ds3[0] = [];
    ds3[0][1] = [];
    ds3[0][1][0] = [];
    ds3[0][1][0][21] = [];
    ds3[0][1][0][21][0] = [clusterItem];
    const clusterHtml = `<script>AF_initDataCallback({key: 'ds:3', data: ${JSON.stringify(ds3)}, sideChannel: {}});</script>`;

    const scope1 = nock(BASE_URL)
      .get(uri => uri.startsWith('/store/apps/details'))
      .reply(200, detailsHtml, { 'Content-Type': 'text/html' });
    const scope2 = nock(BASE_URL)
      .get(uri => uri.startsWith('/store/apps/collection/cluster/recommended'))
      .reply(200, clusterHtml, { 'Content-Type': 'text/html' });

    const res = await similar({ appId: 'com.foo', lang: 'en', country: 'us' });
    expect(res[0].appId).to.equal('com.labelchange.app');
    scope1.done();
    scope2.done();
  });
});
