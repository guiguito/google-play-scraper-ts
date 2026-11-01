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

  it('lists a permission once in the short list when several groups share it', async () => {
    const data = [];
    data[constants.permission.COMMON] = [
      ['Identity', null, [['x', 'find accounts on the device']]],
      ['Contacts', null, [['x', 'find accounts on the device'], ['y', 'read your contacts']]],
    ];
    const body = ")]}'\n" + JSON.stringify([[null, null, JSON.stringify(data)]]);
    const scope = nock(BASE_URL).post(/\/batchexecute/).reply(200, body);
    const res = await permissions({ appId: 'com.test', short: true });
    expect(res).to.deep.equal(['find accounts on the device', 'read your contacts']);
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

  it('sends the appId as JSON in the request body', async () => {
    let fReq;
    const scope = nock(BASE_URL).post(/\/batchexecute/, (b) => { fReq = b['f.req']; return true; }).reply(200, ")]}'\n[]");
    await permissions({ appId: 'com.test' });
    expect(JSON.parse(JSON.parse(fReq)[0][0][1])).to.deep.equal([[null, ['com.test', 7], []]]);
    scope.done();
  });
});
