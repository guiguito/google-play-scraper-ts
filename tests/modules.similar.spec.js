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
    const dsText = `{'ds:tag' : {id:'ag2B9c',request:[]}}`;
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
    expect(res.map((a) => a.appId)).to.deep.equal(['com.cluster.app']);
    scope1.done();
    scope2.done();
  });

  // Live layout (Nov 2026): ds:8 lists "More by <developer>" first and the similar cluster second,
  // with localized titles, so the choice can't rely on English titles or on taking the first cluster.
  it('picks the similar cluster over the "more by developer" one, in any language', async () => {
    const mkCluster = (title, url) => {
      const c = [];
      c[21] = [[], [title, null, [null, null, null, null, ['', '', url]]]];
      return c;
    };
    const ds5 = [];
    ds5[1] = [];
    ds5[1][2] = [];
    ds5[1][2][68] = ['Acme Corp'];
    const ds8 = [null, [null, [
      mkCluster('Autres applications de "Acme Corp"', '/store/apps/dev?id=123'),
      mkCluster('Jeux similaires', '/store/apps/collection/cluster?gsr=SIMILAR'),
    ]]];
    const af = (key, data) => `<script>AF_initDataCallback({key: '${key}', data: ${JSON.stringify(data)}, sideChannel: {}});</script>`;
    const clusterPage = (appId) => {
      const item = [];
      item[0] = [appId];
      item[3] = appId;
      item[13] = [null, 'Summary'];
      const ds3 = [];
      ds3[0] = [];
      ds3[0][1] = [];
      ds3[0][1][0] = [];
      ds3[0][1][0][21] = [[item]];
      return af('ds:3', ds3);
    };

    nock(BASE_URL).get((uri) => uri.startsWith('/store/apps/details')).reply(200, af('ds:5', ds5) + af('ds:8', ds8));
    nock(BASE_URL).get((uri) => uri.startsWith('/store/apps/collection/cluster')).reply(200, clusterPage('com.similar.app'));
    nock(BASE_URL).get((uri) => uri.startsWith('/store/apps/dev')).reply(200, clusterPage('com.acme.other'));

    const res = await similar({ appId: 'com.acme.app', lang: 'fr', country: 'fr' });
    expect(res.map((a) => a.appId)).to.deep.equal(['com.similar.app']);
  });

  it('scans the whole page when the service request id changes', async () => {
    const cluster = [];
    cluster[21] = [null, ['Similar apps', null, [null, null, null, null, ['', '', '/store/apps/collection/cluster/fallback']]]];
    const dsText = `{'ds:tag' : {id:'new-cluster-id',request:[]}}`;
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

  it('finds clusters nested deeper inside the ds block', async () => {
    const cluster = [];
    cluster[21] = [null, ['Similar games', null, [null, null, null, null, ['', '', '/store/apps/collection/cluster/nested']]]];
    const nested = { wrapper: cluster };
    const dsText = `{'ds:tag' : {id:'ag2B9c',request:[]}}`;
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
    const dsText = `{'ds:tag' : {id:'ag2B9c',request:[]}}`;
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

  it('returns inline ds:3 apps when no cluster URL is present', async () => {
    // Details page without AF_dataServiceRequests cluster id; only inline ds:3 with apps
    const item = [];
    item[2] = 'Spotify for Artists';
    item[12] = ['com.spotify.s4a'];
    item[9] = [null, null, null, null, ['', '', '/store/apps/details?id=com.spotify.s4a']];
    const ds3 = [];
    ds3[0] = [];
    ds3[0][1] = [];
    ds3[0][1][0] = [];
    ds3[0][1][0][21] = [];
    ds3[0][1][0][21][0] = [item];
    const detailsHtml = `<script>AF_initDataCallback({key: 'ds:3', data: ${JSON.stringify(ds3)}, sideChannel: {}});</script>`;

    const scope = nock(BASE_URL)
      .get(uri => uri.startsWith('/store/apps/details'))
      .reply(200, detailsHtml, { 'Content-Type': 'text/html' });

    const res = await similar({ appId: 'com.spotify.music', lang: 'en', country: 'us' });
    expect(res.length).to.be.greaterThan(0);
    expect(res[0].appId).to.equal('com.spotify.s4a');
    scope.done();
  });

  it('backfills missing summary from app details when fullDetail is false', async () => {
    const item = [];
    item[2] = 'Spotify for Artists';
    item[12] = ['com.spotify.s4a'];
    item[9] = [null, null, null, null, ['', '', '/store/apps/details?id=com.spotify.s4a']];
    const ds3 = [];
    ds3[0] = [];
    ds3[0][1] = [];
    ds3[0][1][0] = [];
    ds3[0][1][0][21] = [];
    ds3[0][1][0][21][0] = [item];
    const seedHtml = `<script>AF_initDataCallback({key: 'ds:3', data: ${JSON.stringify(ds3)}, sideChannel: {}});</script>`;

    const details = [];
    details[1] = [];
    details[1][2] = [];
    details[1][2][0] = [];
    details[1][2][0][0] = 'Spotify for Artists';
    details[1][2][73] = [[null, 'Grow your audience and track releases']];
    const detailHtml = `<script>AF_initDataCallback({key: 'ds:5', data: ${JSON.stringify(details)}, sideChannel: {}});</script>`;

    const scopeSeed = nock(BASE_URL)
      .get(uri => uri.startsWith('/store/apps/details') && uri.includes('id=com.spotify.music'))
      .reply(200, seedHtml, { 'Content-Type': 'text/html' });
    const scopeDetail = nock(BASE_URL)
      .get(uri => uri.startsWith('/store/apps/details') && uri.includes('id=com.spotify.s4a'))
      .reply(200, detailHtml, { 'Content-Type': 'text/html' });

    const res = await similar({ appId: 'com.spotify.music', lang: 'en', country: 'us', fullDetail: false });
    expect(res.length).to.be.greaterThan(0);
    expect(res[0].appId).to.equal('com.spotify.s4a');
    expect(res[0].summary).to.equal('Grow your audience and track releases');
    scopeSeed.done();
    scopeDetail.done();
  });
});
