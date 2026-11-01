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
    expect(res).to.deep.equal(['CAMERA', 'LOCATION']);
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
    expect(res).to.deep.equal([
      { permission: 'CAMERA', type: 'COMMON' },
      { permission: 'LOCATION', type: 'COMMON' },
    ]);
    scope.done();
  });

  it('returns an empty list when the response has an unexpected shape', async () => {
    const scope = nock(BASE_URL).post(/\/batchexecute/).reply(200, ")]}'\n[]");
    expect(await permissions({ appId: 'com.test' })).to.deep.equal([]);
    scope.done();
  });
});
