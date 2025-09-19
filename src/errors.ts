export class HttpError extends Error {
  status?: number;
  body?: string;
  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'App not found (404)') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class ParseError extends Error {
  constructor(message = 'Failed to parse response') {
    super(message);
    this.name = 'ParseError';
  }
}

