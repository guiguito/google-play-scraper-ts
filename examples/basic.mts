// Run after `npm run build`: node --experimental-strip-types examples/basic.mts (Node 22.6+).
// Type-checked by `npm run verify:types` against the published typings.
import gplay from 'google-play-scraper-ts';

const app = await gplay.app({ appId: 'com.spotify.music', lang: 'en', country: 'us' });
console.log('App title:', app.title);

const results = await gplay.search({ term: 'spotify', num: 5 });
console.log('Search results:', results.map((r) => r.appId));
