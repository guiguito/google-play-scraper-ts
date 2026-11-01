const { expect } = require('chai');
const { HttpError, NotFoundError, RateLimitError } = require('../dist/cjs/errors.js');

describe('errors', () => {
  it('preserves status and body on HttpError', () => {
    const error = new HttpError('failure', 418, 'teapot');
    expect(error.status).to.equal(418);
    expect(error.body).to.equal('teapot');
    expect(error.name).to.equal('HttpError');
  });

  it('creates specialised errors with defaults', () => {
    const notFound = new NotFoundError();
    expect(notFound.status).to.equal(404);
    expect(notFound.message).to.include('404');
    expect(notFound).to.be.instanceOf(HttpError);
    const limited = new RateLimitError();
    expect([limited.status, limited.name]).to.deep.equal([429, 'RateLimitError']);
    expect(limited).to.be.instanceOf(HttpError);
  });
});

