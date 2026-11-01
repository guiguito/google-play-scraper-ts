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
