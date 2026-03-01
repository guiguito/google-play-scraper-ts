import type { AppListItem } from './appList';

interface HydrationOptions {
  lang: string;
  country: string;
}

type DetailFetcher = (args: {
  appId: string;
  lang: string;
  country: string;
}) => Promise<unknown>;

export async function hydrateMissingSummaries(
  apps: AppListItem[],
  opts: HydrationOptions,
  fetchDetails: DetailFetcher
): Promise<AppListItem[]> {
  return Promise.all(
    apps.map(async (item) => {
      if (typeof item.summary === 'string' && item.summary.trim().length > 0) return item;
      if (!item.appId) return item;
      try {
        const details = await fetchDetails({ appId: item.appId, lang: opts.lang, country: opts.country });
        const detailSummary = (details as { summary?: unknown }).summary;
        if (typeof detailSummary === 'string' && detailSummary.trim().length > 0) {
          return { ...item, summary: detailSummary };
        }
      } catch {
        // Keep partial list result when detail fetch fails.
      }
      return item;
    })
  );
}

export default { hydrateMissingSummaries };
