const nock = require('nock');

if (process.env.LIVE === '1') {
  nock.enableNetConnect();
} else {
  nock.disableNetConnect();
  nock.enableNetConnect('127.0.0.1');
  nock.enableNetConnect('::1');
  if (typeof after === 'function') {
    after(() => {
      nock.enableNetConnect();
    });
  } else {
    process.on('exit', () => nock.enableNetConnect());
  }
}
