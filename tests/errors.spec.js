const { expect } = require('chai');
const { HttpError, NotFoundError, ParseError } = require('../dist/cjs/errors.js');

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

    const parse = new ParseError();
    expect(parse.name).to.equal('ParseError');
  });
});

