import api, { constants } from '../../dist/esm/index.js';

type AppOptions = Parameters<typeof api.app>[0];
type AppResult = Awaited<ReturnType<typeof api.app>>;

declare function preview(options: AppOptions): Promise<AppResult>;

const opts: AppOptions = { appId: 'com.example.app' };

async function run() {
  const memo = api.memoized({ maxAge: 1000 });
  const appResult = await preview(opts);
  await memo.app(opts);
  await memo.list({ collection: constants.collection.TOP_FREE });
  return appResult;
}

void run;

export {};
