// Compiled with --strict against the built .d.ts by `npm run verify:types`; any type regression fails CI.
import api, { constants, HttpError, type AppDetails, type AppSummary, type Review } from '../../dist/esm/index.js';

async function run() {
  const app: AppDetails = await api.app({ appId: 'com.example.app' });
  const title: string | undefined = app.title;
  const histogram: number = app.histogram[5];

  const summaries: AppSummary[] = await api.list({ collection: constants.collection.TOP_FREE, age: constants.age.FIVE_UNDER });
  const details: AppDetails[] = await api.search({ term: 'x', fullDetail: true });
  const devApps: AppSummary[] = await api.developer({ devId: '123' });
  const similar: AppDetails[] = await api.similar({ appId: 'x', fullDetail: true });

  const reviews = await api.reviews({ appId: 'x', score: 1, device: api.device.TABLET });
  // @ts-expect-error score is 1–5
  await api.reviews({ appId: 'x', score: 6 });
  const first: Review | undefined = reviews.data[0];
  const text: string | undefined = first?.text;

  const short: string[] = await api.permissions({ appId: 'x', short: true });
  const safety = await api.datasafety({ appId: 'x' });
  const optional: boolean | null | undefined = safety.sharedData[0]?.optional;

  const memo = api.memoized({ maxAge: 1000 });
  const memoDetails: AppDetails[] = await memo.list({ fullDetail: true });

  // @ts-expect-error age takes the constant values ('AGE_RANGE1'), not the keys
  await api.list({ age: 'FIVE_UNDER' });

  const isHttp = (e: unknown) => e instanceof HttpError && e.status === 404;
  return [title, histogram, summaries, details, devApps, similar, text, short, optional, memoDetails, isHttp];
}

void run;

export {};
