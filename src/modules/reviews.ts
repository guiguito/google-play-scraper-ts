import { BASE_URL, constants } from '../constants';
import { ValidationError } from '../errors';
import { request } from '../http/client';
import * as scriptData from '../utils/scriptData';
import type { JsonValue, Review } from '../types';

const REQUEST_TYPE = { initial: 'initial', paginated: 'paginated' } as const;

type RequestTypeKey = keyof typeof REQUEST_TYPE;


// Play serves an empty payload for larger pages (checked Nov 2026).
const MAX_REVIEWS_PER_REQUEST = 4500;

function getBodyForRequests({ appId, sort, numberOfReviewsPerRequest = 150, withToken, requestType = REQUEST_TYPE.initial, score, device }: {
  appId: string;
  sort: number;
  numberOfReviewsPerRequest?: number;
  withToken?: string;
  requestType?: RequestTypeKey;
  score?: number;
  device?: number;
}) {
  // JSON.stringify + encodeURIComponent: appId and tokens must not be able to break the payload.
  const token = requestType === REQUEST_TYPE.paginated ? withToken ?? null : null;
  // Server-side filters; Play keeps them on every page only if every request repeats them.
  const filters = score || device ? [null, score ?? null, null, null, null, null, null, null, device ?? null] : [];
  const inner = [null, null, [2, sort, [numberOfReviewsPerRequest, null, token], null, filters], [appId, 7]];
  return `f.req=${encodeURIComponent(JSON.stringify([[['UsvDTd', JSON.stringify(inner), null, 'generic']]]))}`;
}

const REQUEST_MAPPINGS = { reviews: [0], token: [1, 1] } as const;

function buildCriteria(criteriaEntry: JsonValue | undefined): { criteria: JsonValue; rating: JsonValue } {
  if (!Array.isArray(criteriaEntry)) return { criteria: null, rating: null };
  const criteria = scriptData.getPathValue(criteriaEntry, [0]) ?? null;
  const rating = scriptData.getPathValue(criteriaEntry, [1, 0]) ?? null;
  return { criteria, rating };
}

function generateDate(dateArray?: JsonValue): string | null {
  if (!Array.isArray(dateArray)) return null;
  const millisecondsLastDigits = String(dateArray[1] ?? '000');
  const millisecondsTotal = `${dateArray[0]}${millisecondsLastDigits.substring(0, 3)}`;
  const date = new Date(Number(millisecondsTotal));
  return Number.isNaN(date.getTime()) ? null : date.toJSON();
}

function getReviewsMappings(appId: string) {
  return {
    id: [0],
    userName: [1, 0],
    userImage: [1, 1, 3, 2],
    date: { path: [5], fun: (value?: JsonValue) => generateDate(value) },
    score: [2],
    scoreText: { path: [2], fun: (score: JsonValue | undefined) => (typeof score === 'number' ? String(score) : null) },
    url: { path: [0], fun: (reviewId: JsonValue | undefined) => (typeof reviewId === 'string' ? `${BASE_URL}/store/apps/details?id=${appId}&reviewId=${reviewId}` : undefined) },
    title: { path: [0], fun: () => null },
    text: [4],
    replyDate: { path: [7, 2], fun: (value?: JsonValue) => generateDate(value) },
    replyText: { path: [7, 1], fun: (text?: JsonValue) => (typeof text === 'string' ? text : null) },
    version: { path: [10], fun: (version?: JsonValue) => (typeof version === 'string' ? version : null) },
    thumbsUp: [6],
    criterias: { path: [12, 0], fun: (criterias?: JsonValue) => (Array.isArray(criterias) ? criterias.map(buildCriteria) : []) },
  } satisfies scriptData.GenericMappings;
}

function normalizeReview(raw: Record<string, JsonValue | undefined>): Review {
  const criteriasValue = raw.criterias;
  const criterias = Array.isArray(criteriasValue)
    ? criteriasValue.map((entry) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
          return { criteria: null, rating: null };
        }
        const obj = entry as { [key: string]: JsonValue };
        return { criteria: obj.criteria ?? null, rating: obj.rating ?? null };
      })
    : undefined;
  const str = (v: JsonValue | undefined) => (typeof v === 'string' ? v : undefined);
  const num = (v: JsonValue | undefined) => (typeof v === 'number' ? v : undefined);
  return {
    id: str(raw.id),
    userName: str(raw.userName),
    userImage: str(raw.userImage),
    date: typeof raw.date === 'string' ? raw.date : null,
    score: num(raw.score),
    scoreText: typeof raw.scoreText === 'string' ? raw.scoreText : null,
    url: str(raw.url),
    title: null,
    text: str(raw.text),
    replyDate: typeof raw.replyDate === 'string' ? raw.replyDate : null,
    replyText: typeof raw.replyText === 'string' ? raw.replyText : null,
    version: typeof raw.version === 'string' ? raw.version : null,
    thumbsUp: num(raw.thumbsUp),
    criterias,
  };
}

function extract(root: ReadonlyArray<string | number>, data: JsonValue, appId: string) {
  const input = scriptData.getPathValue(data, root);
  if (!Array.isArray(input)) return [] as Review[];
  const mappings = getReviewsMappings(appId);
  const mapReview = scriptData.extractor<Record<string, JsonValue | undefined>>(mappings);
  return input.map((entry) => normalizeReview(mapReview(entry)));
}

function formatReviewsResponse({ reviews, num, token = null }: { reviews: Review[]; num: number; token?: string | null }) {
  const reviewsToResponse = reviews.length >= num ? reviews.slice(0, num) : reviews;
  return { data: reviewsToResponse, nextPaginationToken: token };
}

type ReviewRequestOptions = {
  appId: string;
  sort: ReviewSort;
  lang: string;
  country: string;
  num: number;
  requestType: RequestTypeKey;
  paginate?: boolean;
  score?: number;
  device?: number;
  requestOptions?: ReviewsOptions['requestOptions'];
};

async function processReviewsAndGetNextPage(
  html: JsonValue,
  opts: ReviewRequestOptions,
  savedReviews: Review[]
): Promise<{ data: Review[]; nextPaginationToken: string | null }> {
  const parsed = typeof html === 'string' ? scriptData.parse(html) : html;
  const reviews = extract(REQUEST_MAPPINGS.reviews, parsed, opts.appId);
  const tokenValue = scriptData.getPathValue(parsed, REQUEST_MAPPINGS.token);
  const token = typeof tokenValue === 'string'
    ? tokenValue
    : Array.isArray(tokenValue) && typeof tokenValue[0] === 'string'
      ? tokenValue[0]
      : null;
  const reviewsAccumulator = [...savedReviews, ...reviews];
  // reviews.length guard: an empty page that still carries a token would otherwise loop forever.
  return !opts.paginate && token && reviews.length > 0 && reviewsAccumulator.length < opts.num
    ? makeReviewsRequest({ ...opts, requestType: REQUEST_TYPE.paginated }, reviewsAccumulator, token)
    : formatReviewsResponse({ reviews: reviewsAccumulator, token, num: opts.num });
}

function makeReviewsRequest(
  opts: ReviewRequestOptions,
  savedReviews: Review[],
  nextToken: string
): Promise<{ data: Review[]; nextPaginationToken: string | null }> {
  // Never ask for more than still needed: the returned token points past the whole page, so any surplus sliced off would be lost.
  const numberOfReviewsPerRequest = Math.min(opts.num - savedReviews.length, MAX_REVIEWS_PER_REQUEST);
  const body = getBodyForRequests({
    appId: opts.appId,
    sort: opts.sort,
    numberOfReviewsPerRequest,
    withToken: nextToken,
    requestType: opts.requestType,
    score: opts.score,
    device: opts.device,
  });
  const url = `${BASE_URL}/_/PlayStoreUi/data/batchexecute?rpcids=qnKhOb&f.sid=-697906427155521722&bl=boq_playuiserver_20190903.08_p0&hl=${encodeURIComponent(opts.lang)}&gl=${encodeURIComponent(opts.country)}&authuser&soc-app=121&soc-platform=1&soc-device=1&_reqid=1065213`;
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', ...opts.requestOptions?.headers };
  return request({ url, method: 'POST', body, headers, country: opts.country }).then((html) => {
    const input = JSON.parse(html.substring(5)) as JsonValue;
    const raw = Array.isArray(input) && Array.isArray(input[0]) ? input[0][2] : undefined;
    const data = typeof raw === 'string' ? (JSON.parse(raw) as JsonValue | null) : null;
    return data === null ? formatReviewsResponse({ reviews: savedReviews, token: null, num: opts.num }) : processReviewsAndGetNextPage(data, opts, savedReviews);
  });
}

export interface ReviewsOptions {
  appId: string;
  sort?: number;
  lang?: string;
  country?: string;
  num?: number;
  paginate?: boolean;
  nextPaginationToken?: string | null;
  /** Only reviews with this star rating (filtered by Play). */
  score?: 1 | 2 | 3 | 4 | 5;
  /** Only reviews written on this form factor (filtered by Play): `constants.device.TABLET`, `.WATCH`, … */
  device?: ReviewDevice;
  /** Extra HTTP headers for every request this call makes (including app() fan-outs). */
  requestOptions?: { headers?: Record<string, string> };
}

type ReviewSort = (typeof constants.sort)[keyof typeof constants.sort];
type ReviewDevice = (typeof constants.device)[keyof typeof constants.device];

export async function reviews(opts: ReviewsOptions) {
  if (!opts || !opts.appId) throw new ValidationError('appId missing');
  const validSorts = Object.values(constants.sort) as ReviewSort[];
  if (opts.sort && !validSorts.includes(opts.sort as ReviewSort)) throw new ValidationError('Invalid sort ' + opts.sort);
  if (opts.score !== undefined && ![1, 2, 3, 4, 5].includes(opts.score)) throw new ValidationError('Invalid score ' + opts.score);
  if (opts.device !== undefined && !(Object.values(constants.device) as number[]).includes(opts.device)) {
    throw new ValidationError('Invalid device ' + opts.device);
  }
  // `??` rather than Object.assign: an explicit `undefined` must not override a default.
  const fullOptions = {
    ...opts,
    sort: (opts.sort ?? constants.sort.NEWEST) as ReviewSort,
    lang: opts.lang ?? 'en',
    country: opts.country ?? 'us',
    num: opts.num ?? 150,
    paginate: opts.paginate ?? false,
  };
  const requestType = !fullOptions.nextPaginationToken ? REQUEST_TYPE.initial : REQUEST_TYPE.paginated;
  const token = fullOptions.nextPaginationToken || '%token%';
  return makeReviewsRequest(
    {
      appId: fullOptions.appId,
      sort: fullOptions.sort,
      lang: fullOptions.lang,
      country: fullOptions.country,
      num: fullOptions.num,
      requestType,
      paginate: fullOptions.paginate,
      score: fullOptions.score,
      device: fullOptions.device,
      requestOptions: fullOptions.requestOptions,
    },
    [],
    token
  );
}

export default reviews;
