const { expect } = require('chai');
const { parse, extractor, getPathValue } = require('../dist/cjs/utils/scriptData.js');

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

  // Play's JSPB serializer may move trailing fields into a final object keyed by field number (= index + 1).
  it('reads array indexes that Play moved into a trailing sparse object', () => {
    expect(getPathValue([null, { 138: ['x'] }], [137, 0])).to.equal('x');
    expect(getPathValue([null, { 138: ['x'] }], [99])).to.equal(undefined);
  });

  it('keeps reading in-range elements of arrays that end with an object', () => {
    expect(getPathValue([{ a: 1 }, { b: 2 }], [1])).to.deep.equal({ b: 2 });
  });
});

