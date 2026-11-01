export class HttpError extends Error {
  status?: number;
  body?: string;
  /** Delay requested by the server's Retry-After header, if any. */
  retryAfterMs?: number;
  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

/** Thrown for 404 responses, e.g. an unknown appId; still an HttpError. */
export class NotFoundError extends HttpError {
  constructor(message = 'Not found (404)', body?: string) {
    super(message, 404, body);
    this.name = 'NotFoundError';
  }
}

/** Play kept answering 429 after the retries; still an HttpError. Slow down or spread requests over IPs. */
export class RateLimitError extends HttpError {
  constructor(message = 'Rate limited (429)', body?: string) {
    super(message, 429, body);
    this.name = 'RateLimitError';
  }
}

/**
 * Google redirected to its captcha page (google.com/sorry): too many requests from this IP. Retried like
 * a 429; thrown when the retries don't clear it. Rotate proxies or slow down. `status` is the redirect's.
 */
export class BlockedError extends HttpError {
  constructor(message: string, status: number, body?: string) {
    super(message, status, body);
    this.name = 'BlockedError';
  }
}

/** Invalid options (missing appId, num out of range, unknown constant, …), thrown before any request. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
