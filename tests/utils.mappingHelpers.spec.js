const { expect } = require('chai');
const helpers = require('../dist/cjs/utils/mappingHelpers.js').default;

describe('utils/mappingHelpers', () => {
  it('converts description HTML to text and preserves line breaks', () => {
    const html = '<b>Hello</b><br>world';
    const text = helpers.descriptionText(html);
    expect(text).to.contain('Hello');
    expect(text).to.match(/world/);
  });

  it('normalizes android version', () => {
    expect(helpers.normalizeAndroidVersion('4.1 and up')).to.equal('4.1');
    expect(helpers.normalizeAndroidVersion(undefined)).to.equal('VARY');
    expect(helpers.normalizeAndroidVersion('Varies with device')).to.equal('VARY');
  });

  it('builds rating histogram with defaults', () => {
    const container = [];
    container[1] = [null, 10];
    container[2] = [null, 20];
    container[3] = [null, 30];
    container[4] = [null, 40];
    container[5] = [null, 50];
    const hist = helpers.buildHistogram(container);
    expect(hist[1]).to.equal(10);
    expect(hist[5]).to.equal(50);
  });

  it('extracts description localization fallback', () => {
    const data = [];
    data[12] = [];
    data[12][0] = [];
    data[12][0][0] = [];
    data[12][0][0][1] = 'Translated description';
    const fallback = [];
    fallback[72] = [];
    fallback[72][0] = [];
    fallback[72][0][1] = 'Original description';
    expect(helpers.descriptionHtmlLocalized(data)).to.equal('Translated description');
    expect(helpers.descriptionHtmlLocalized(fallback)).to.equal('Original description');
  });

  it('returns default price text when missing', () => {
    expect(helpers.priceText(undefined)).to.equal('Free');
    expect(helpers.priceText('$1.99')).to.equal('$1.99');
  });

  it('extracts comments when author, version, and date exist', () => {
    const entry = [];
    entry[1] = [];
    entry[1][0] = 'Author';
    entry[10] = '1.0';
    entry[5] = [];
    entry[5][0] = Date.now();
    entry[4] = 'Great app';
    const data = { 'ds:8': [[entry]] };
    const comments = helpers.extractComments(data);
    expect(comments).to.deep.equal(['Great app']);
  });

  it('extracts feature titles and descriptions', () => {
    const feature = [];
    feature[0] = 'Feature';
    feature[1] = [];
    feature[1][0] = [];
    feature[1][0][0] = [];
    feature[1][0][0][1] = 'Feature description';
    const features = [null, null, [feature]];
    const result = helpers.extractFeatures(features);
    expect(result).to.deep.equal([{ title: 'Feature', description: 'Feature description' }]);
  });

  it('recursively extracts categories', () => {
    const nested = ['Category A', null, 'CAT_A'];
    const data = [null, [nested]];
    const categories = helpers.extractCategories(data);
    expect(categories).to.deep.equal([{ name: 'Category A', id: 'CAT_A' }]);
  });
});
