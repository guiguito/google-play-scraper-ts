import gplay from '../src';

async function main() {
  const app = await gplay.app({ appId: 'com.spotify.music', lang: 'en', country: 'us' });
  console.log('App title:', app.title);

  const results = await gplay.search({ term: 'spotify', num: 5 });
  console.log('Search results:', results.map((r: any) => r.appId));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

