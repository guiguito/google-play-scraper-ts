const { expect } = require('chai');
const nock = require('nock');
const { BASE_URL, constants } = require('../dist/cjs/constants.js');
const permissions = require('../dist/cjs/modules/permissions.js').default;

describe('modules/permissions', () => {
  afterEach(() => nock.cleanAll());

  it('returns short permissions list', async () => {
    const data = [];
    data[constants.permission.COMMON] = [
      ['COMMON', null, [['x', 'CAMERA'], ['y', 'LOCATION']]],
    ];
    const input = [[null, null, JSON.stringify(data)]];
    const body = ")]}'\n" + JSON.stringify(input);

    const scope = nock(BASE_URL).post(/\/batchexecute/).reply(200, body);
    const res = await permissions({ appId: 'com.test', short: true });
    expect(Array.isArray(res)).to.equal(true);
    scope.done();
  });

  it('returns detailed permissions list', async () => {
    const data = [];
    data[constants.permission.COMMON] = [
      ['COMMON', null, [['x', 'CAMERA'], ['y', 'LOCATION']]],
    ];
    const input = [[null, null, JSON.stringify(data)]];
    const body = ")]}'\n" + JSON.stringify(input);
    const scope = nock(BASE_URL).post(/\/batchexecute/).reply(200, body);
    const res = await permissions({ appId: 'com.test', short: false });
    expect(Array.isArray(res)).to.equal(true);
    scope.done();
  });
});
