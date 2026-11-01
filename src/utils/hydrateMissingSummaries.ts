import { NotFoundError } from '../errors';
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

/**
 * fullDetail fan-out: one app() per listed app. A 404 (app removed, or not offered in that
 * country) drops that entry; any other error still rejects the whole call.
 */
export async function fetchFullDetails<T>(
  apps: AppListItem[],
  opts: HydrationOptions,
  fetchDetails: (args: { appId: string; lang: string; country: string }) => Promise<T>
): Promise<T[]> {
  const results = await Promise.all(
    apps
      .filter((item): item is AppListItem & { appId: string } => typeof item.appId === 'string' && item.appId.length > 0)
      .map((item) =>
        fetchDetails({ appId: item.appId, lang: opts.lang, country: opts.country }).catch((err: unknown) => {
          if (err instanceof NotFoundError) return undefined;
          throw err;
        })
      )
  );
  return results.filter((r): r is Awaited<T> => r !== undefined);
}

export default { hydrateMissingSummaries, fetchFullDetails };
