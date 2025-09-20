#!/usr/bin/env node
/*
 Records live fixtures for similar() by fetching the details page and, if present,
 the first cluster URL. Requires a built dist (npm run build) to import parsing utils.

 Usage:
   LIVE=1 node scripts/record-similar-fixture.js --appId com.spotify.music --lang en --country us --out tests/fixtures/similar
*/

const fs = require('fs');
const path = require('path');
const https = require('https');

const { BASE_URL } = require('../dist/cjs/constants.js');
const scriptData = require('../dist/cjs/utils/scriptData.js');

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

const appId = arg('appId');
const lang = arg('lang', 'en');
const country = arg('country', 'us');
const outDir = arg('out', path.join('tests', 'fixtures', 'similar'));

if (!process.env.LIVE) {
  console.error('Set LIVE=1 to enable live recording.');
  process.exit(1);
}
if (!appId) {
  console.error('--appId is required');
  process.exit(1);
}

function get(url) {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

function getPathValue(source, pathArr) {
  return scriptData.getPathValue(source, pathArr);
}

function collectClusters(value) {
  const out = [];
  function hasUrl(node) {
    const url = getPathValue(node, [21, 1, 2, 4, 2]);
    return typeof url === 'string' && url.length > 0;
  }
  function walk(v) {
    if (!v) return;
    if (hasUrl(v)) out.push(v);
    if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object') Object.values(v).forEach(walk);
  }
  walk(value);
  return out;
}

(async () => {
  const qs = new URLSearchParams({ id: appId, hl: lang, gl: country }).toString();
  const detailsUrl = `${BASE_URL}/store/apps/details?${qs}`;
  console.log('[record] GET', detailsUrl);
  const detailsHtml = await get(detailsUrl);

  const parsed = scriptData.parse(detailsHtml);
  const candidates = collectClusters(parsed);
  const clusterUrl = candidates.length ? getPathValue(candidates[0], [21, 1, 2, 4, 2]) : '';

  fs.mkdirSync(outDir, { recursive: true });
  const base = `${appId}.${lang}-${country}`;
  const detailsPath = path.join(outDir, `${base}.details.html`);
  fs.writeFileSync(detailsPath, detailsHtml, 'utf8');
  console.log('[record] wrote', detailsPath);

  if (typeof clusterUrl === 'string' && clusterUrl) {
    const fullCluster = `${BASE_URL}${clusterUrl}&gl=${country}&hl=${lang}`;
    console.log('[record] GET', fullCluster);
    const clusterHtml = await get(fullCluster);
    const clusterPath = path.join(outDir, `${base}.cluster.html`);
    fs.writeFileSync(clusterPath, clusterHtml, 'utf8');
    console.log('[record] wrote', clusterPath);
  } else {
    console.warn('[record] no cluster URL found in details page. Only details fixture recorded.');
  }
})().catch((e) => {
  console.error('[record] failed:', e);
  process.exit(1);
});

