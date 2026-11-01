import { NotFoundError } from '../errors';
import type { AppDetails } from '../types';
import type { AppOptions } from './app';

export interface AvailabilityOptions {
  appId: string;
  /** Storefront country codes to check, e.g. ['us', 'fr', 'jp']. */
  countries: string[];
  lang?: string;
  /** Extra HTTP headers for every request this call makes. */
  requestOptions?: { headers?: Record<string, string> };
}

/**
 * Whether `appId` is offered in each storefront, keyed by lowercased country code. Reads the listing's
 * own `available` flag: Play answers 200 for most countries an app isn't published in (Venmo with
 * `gl=fr`), so the HTTP status alone can't tell. A 404 (unknown or removed app) counts as unavailable.
 */
export async function availability(
  appFetcher: (args: AppOptions) => Promise<AppDetails>,
  opts: AvailabilityOptions
): Promise<Record<string, boolean>> {
  if (!opts || !opts.appId) throw new Error('appId missing');
  if (!opts.countries?.length) throw new Error('countries missing');
  const entries = await Promise.all(
    opts.countries.map(async (code) => {
      const country = code.toLowerCase();
      const args: AppOptions = { appId: opts.appId, lang: opts.lang, country };
      if (opts.requestOptions) args.requestOptions = opts.requestOptions;
      try {
        return [country, (await appFetcher(args)).available] as const;
      } catch (error) {
        if (error instanceof NotFoundError) return [country, false] as const;
        throw error;
      }
    })
  );
  return Object.fromEntries(entries);
}

export default availability;
