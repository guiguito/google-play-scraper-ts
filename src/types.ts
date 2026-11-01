export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type { AppListItem as AppSummary } from './utils/appList';
import type { AppListItem } from './utils/appList';

/** Full listing returned by `app()` and by list-style methods when `fullDetail` is true. */
export interface AppDetails {
  appId: string;
  url: string;
  title?: string;
  summary?: string;
  description: string;
  descriptionHTML: string;
  genre?: string;
  genreId?: string;
  categories: Array<{ name: string; id: string }>;
  installs?: string;
  minInstalls?: number;
  maxInstalls?: number;
  score?: number;
  scoreText?: string;
  ratings?: number;
  reviews?: number;
  histogram: Record<1 | 2 | 3 | 4 | 5, number>;
  free: boolean;
  price: number;
  originalPrice?: number;
  discountEndDate?: number;
  currency?: string;
  priceText: string;
  offersIAP: boolean;
  IAPRange?: string;
  isAvailableInPlayPass: boolean;
  icon?: string;
  headerImage?: string;
  screenshots: string[];
  video?: string;
  videoImage?: string;
  previewVideo?: string;
  comments: string[];
  recentChanges?: string;
  developer?: string;
  developerId?: string;
  developerInternalID?: string;
  developerEmail?: string;
  developerWebsite?: string;
  developerAddress?: string;
  developerLegalName?: string;
  developerLegalEmail?: string;
  developerLegalAddress?: string;
  developerLegalPhoneNumber?: string;
  privacyPolicy?: string;
  released?: string;
  updated?: number;
  version: string;
  androidVersion: string;
  androidVersionText: string;
  androidMaxVersion: string;
  contentRating?: string;
  contentRatingDescription?: string;
  adSupported: boolean;
  available: boolean;
  preregister: boolean;
  earlyAccessEnabled: boolean;
}

export interface Review {
  id?: string;
  userName?: string;
  userImage?: string;
  date: string | null;
  score?: number;
  scoreText: string | null;
  url?: string;
  title: null;
  text?: string;
  replyDate: string | null;
  replyText: string | null;
  version: string | null;
  thumbsUp?: number;
  criterias?: Array<{ criteria: JsonValue; rating: JsonValue }>;
}

export interface PermissionItem {
  permission: string;
  /** Permission group label from Play (e.g. 'Location'). */
  type?: string;
}

export interface DataSafetyItem {
  data?: string;
  optional: boolean | null;
  purpose: string | null;
  type?: string;
}

export interface DataSafety {
  sharedData: DataSafetyItem[];
  collectedData: DataSafetyItem[];
  securityPractices: Array<{ practice?: string; description?: string }>;
  privacyPolicyUrl?: string;
}

/** Overloads for methods whose result shape depends on `fullDetail`. */
export interface FullDetailFn<O> {
  (opts: O & { fullDetail: true }): Promise<AppDetails[]>;
  (opts: O & { fullDetail?: false }): Promise<AppListItem[]>;
  (opts: O): Promise<AppListItem[] | AppDetails[]>;
}
