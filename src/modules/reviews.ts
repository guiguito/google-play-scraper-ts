import { BASE_URL, constants } from '../constants';
import { request } from '../http/client';
import * as scriptData from '../utils/scriptData';
import type { JsonValue } from '../types';

const REQUEST_TYPE = { initial: 'initial', paginated: 'paginated' } as const;

type RequestTypeKey = keyof typeof REQUEST_TYPE;

type ReviewEntry = {
  id?: JsonValue;
  userName?: JsonValue;
  userImage?: JsonValue;
  date?: string | null;
  score?: JsonValue;
  scoreText?: JsonValue;
  url?: JsonValue;
  title?: JsonValue;
  text?: JsonValue;
  replyDate?: string | null;
  replyText?: string | null;
  version?: string | null;
  thumbsUp?: JsonValue;
  criterias?: Array<{ criteria: JsonValue; rating: JsonValue }>;
};

function getBodyForRequests({ appId, sort, numberOfReviewsPerRequest = 150, withToken = '%token%', requestType = REQUEST_TYPE.initial }: {
  appId: string;
  sort: number;
  numberOfReviewsPerRequest?: number;
  withToken?: string;
  requestType?: RequestTypeKey;
}) {
  const forms = {
    initial: `f.req=%5B%5B%5B%22UsvDTd%22%2C%22%5Bnull%2Cnull%2C%5B2%2C${sort}%2C%5B${numberOfReviewsPerRequest}%2Cnull%2Cnull%5D%2Cnull%2C%5B%5D%5D%2C%5B%5C%22${appId}%5C%22%2C7%5D%5D%22%2Cnull%2C%22generic%22%5D%5D%5D`,
    paginated: `f.req=%5B%5B%5B%22UsvDTd%22%2C%22%5Bnull%2Cnull%2C%5B2%2C${sort}%2C%5B${numberOfReviewsPerRequest}%2Cnull%2C%5C%22${withToken}%5C%22%5D%2Cnull%2C%5B%5D%5D%2C%5B%5C%22${appId}%5C%22%2C7%5D%5D%22%2Cnull%2C%22generic%22%5D%5D%5D`,
  } as const;
  return forms[requestType];
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

function normalizeReview(raw: Record<string, JsonValue | undefined>): ReviewEntry {
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
  return {
    id: raw.id,
    userName: raw.userName,
    userImage: raw.userImage,
    date: typeof raw.date === 'string' ? raw.date : null,
    score: raw.score,
    scoreText: raw.scoreText,
    url: raw.url,
    title: raw.title,
    text: raw.text,
    replyDate: typeof raw.replyDate === 'string' ? raw.replyDate : null,
    replyText: typeof raw.replyText === 'string' ? raw.replyText : null,
    version: typeof raw.version === 'string' ? raw.version : null,
    thumbsUp: raw.thumbsUp,
    criterias,
  };
}

function extract(root: ReadonlyArray<string | number>, data: JsonValue, appId: string) {
  const input = scriptData.getPathValue(data, root);
  if (!Array.isArray(input)) return [] as ReviewEntry[];
  const mappings = getReviewsMappings(appId);
  const mapReview = scriptData.extractor<Record<string, JsonValue | undefined>>(mappings);
  return input.map((entry) => normalizeReview(mapReview(entry)));
}

function formatReviewsResponse({ reviews, num, token = null }: { reviews: ReviewEntry[]; num: number; token?: string | null }) {
  const reviewsToResponse = reviews.length >= num ? reviews.slice(0, num) : reviews;
  return { data: reviewsToResponse, nextPaginationToken: token };
}

async function processReviewsAndGetNextPage(
  html: JsonValue,
  opts: { appId: string; num: number; paginate?: boolean; lang: string; country: string; sort: ReviewSort; requestType: RequestTypeKey },
  savedReviews: ReviewEntry[]
): Promise<{ data: ReviewEntry[]; nextPaginationToken: string | null }> {
  const parsed = typeof html === 'string' ? scriptData.parse(html) : html;
  const reviews = extract(REQUEST_MAPPINGS.reviews, parsed, opts.appId);
  const tokenValue = scriptData.getPathValue(parsed, REQUEST_MAPPINGS.token);
  const token = typeof tokenValue === 'string'
    ? tokenValue
    : Array.isArray(tokenValue) && typeof tokenValue[0] === 'string'
      ? tokenValue[0]
      : null;
  const reviewsAccumulator = [...savedReviews, ...reviews];
  return !opts.paginate && token && reviewsAccumulator.length < opts.num
    ? makeReviewsRequest({ ...opts, requestType: REQUEST_TYPE.paginated }, reviewsAccumulator, token)
    : formatReviewsResponse({ reviews: reviewsAccumulator, token, num: opts.num });
}

function makeReviewsRequest(
  opts: { appId: string; sort: ReviewSort; lang: string; country: string; num: number; requestType: RequestTypeKey; paginate?: boolean },
  savedReviews: ReviewEntry[],
  nextToken: string
): Promise<{ data: ReviewEntry[]; nextPaginationToken: string | null }> {
  const body = getBodyForRequests({ appId: opts.appId, sort: opts.sort, withToken: nextToken, requestType: opts.requestType });
  const url = `${BASE_URL}/_/PlayStoreUi/data/batchexecute?rpcids=qnKhOb&f.sid=-697906427155521722&bl=boq_playuiserver_20190903.08_p0&hl=${opts.lang}&gl=${opts.country}&authuser&soc-app=121&soc-platform=1&soc-device=1&_reqid=1065213`;
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };
  return request({ url, method: 'POST', body, headers }).then((html) => {
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
}

type ReviewSort = (typeof constants.sort)[keyof typeof constants.sort];

export async function reviews(opts: ReviewsOptions) {
  if (!opts || !opts.appId) throw new Error('appId missing');
  const validSorts = Object.values(constants.sort) as ReviewSort[];
  if (opts.sort && !validSorts.includes(opts.sort as ReviewSort)) throw new Error('Invalid sort ' + opts.sort);
  const fullOptions = Object.assign({ sort: constants.sort.NEWEST, lang: 'en', country: 'us', num: 150, paginate: false, nextPaginationToken: null }, opts) as ReviewsOptions & { sort: ReviewSort; lang: string; country: string; num: number };
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
    },
    [],
    token
  );
}

export default reviews;
