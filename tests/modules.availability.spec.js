const { expect } = require('chai');
const availability = require('../dist/cjs/modules/availability.js').default;
const { NotFoundError, HttpError } = require('../dist/cjs/errors.js');

describe('modules/availability', () => {
  // Live (Nov 2026): Venmo answers 200 with gl=fr, but its listing flags available: false there.
  it('reads each country listing available flag; 404 counts as unavailable', async () => {
    const calls = [];
    const fetcher = async (args) => {
      calls.push(args);
      if (args.country === 'kp') throw new NotFoundError();
      return { available: args.country === 'us' };
    };
    const res = await availability(fetcher, {
      appId: 'com.venmo',
      countries: ['US', 'fr', 'kp'],
      requestOptions: { headers: { 'X-Test': '1' } },
    });
    expect(res).to.deep.equal({ us: true, fr: false, kp: false });
    expect(calls.map((c) => c.country)).to.deep.equal(['us', 'fr', 'kp']);
    expect(calls[0].requestOptions).to.deep.equal({ headers: { 'X-Test': '1' } });
  });

  it('rejects on other errors instead of reporting the app unavailable', async () => {
    const fetcher = async () => {
      throw new HttpError('Request failed: 503', 503);
    };
    let error;
    try {
      await availability(fetcher, { appId: 'com.venmo', countries: ['us'] });
    } catch (e) {
      error = e;
    }
    expect(error).to.be.instanceOf(HttpError);
    expect(error.status).to.equal(503);
  });

  it('requires appId and countries', async () => {
    for (const opts of [{ countries: ['us'] }, { appId: 'x' }, { appId: 'x', countries: [] }]) {
      let threw = false;
      try {
        await availability(async () => ({}), opts);
      } catch {
        threw = true;
      }
      expect(threw, JSON.stringify(opts)).to.equal(true);
    }
  });
});
