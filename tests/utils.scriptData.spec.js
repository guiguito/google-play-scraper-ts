const { expect } = require('chai');
const { parse, extractor } = require('../dist/cjs/utils/scriptData.js');

describe('utils/scriptData', () => {
  it('parses AF_initDataCallback blocks and extracts values', () => {
    const html = `
    <html><head></head><body>
    <script>AF_initDataCallback({key: 'ds:5', data: [0,1,2,3], sideChannel: {}});</script>
    <script>AF_initDataCallback({key: 'ds:1', data: [[1],[2]], sideChannel: {}});</script>
    </body></html>`;
    const data = parse(html);
    expect(data['ds:5']).to.be.an('array');
    expect(data['ds:1']).to.be.an('array');

    const mappings = { value: ['ds:5', 2] };
    const res = extractor(mappings)(data);
    expect(res.value).to.equal(2);
  });
});

