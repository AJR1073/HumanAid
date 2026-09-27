const { EventEmitter } = require('node:events');
const { Readable, PassThrough } = require('node:stream');
const zlib = require('node:zlib');
const { createSafeHtmlFetcher, ScanUrlError } = require('../services/safe-url-fetch');

const PUBLIC = { address: '93.184.216.34', family: 4 };
const PUBLIC_V6 = { address: '2606:4700:4700::1111', family: 6 };
const HTML = '<html><head><title>Community Food Pantry</title></head><body>Open Monday</body></html>';

// No real DNS, sockets, HTTP servers or databases are used in this suite.
function setup(responses = [{}], settings = {}) {
  const requests = [];
  const streams = [];
  const lookup = settings.lookup || jest.fn().mockResolvedValue([PUBLIC]);
  let cursor = 0;
  const request = jest.fn((url, options, callback) => {
    const req = new EventEmitter();
    const fixture = responses[cursor++] || {};
    let response;
    req.setTimeout = jest.fn(() => req);
    req.destroy = jest.fn(error => {
      response?.destroy();
      if (error) queueMicrotask(() => req.emit('error', error));
      return req;
    });
    req.end = jest.fn(() => queueMicrotask(() => {
      if (fixture.error) return req.emit('error', fixture.error);
      if (fixture.stallHeaders) return;
      // Model the transport's DNS callback to ensure it uses the pinned address.
      options.lookup(url.hostname, {}, error => {
        if (error) return req.emit('error', error);
        response = fixture.stream || Readable.from(fixture.chunks || [fixture.body || Buffer.from(HTML)]);
        response.statusCode = fixture.status || 200;
        response.headers = { 'content-type': 'text/html; charset=utf-8', ...fixture.headers };
        streams.push(response);
        callback(response);
      });
    }));
    requests.push(req);
    return req;
  });
  const fetchHtml = createSafeHtmlFetcher({ ...settings, lookup, request });
  return { fetchHtml, lookup, request, requests, streams };
}

describe('safe public website scanning', () => {
  afterEach(() => jest.useRealTimers());

  test.each([
    'http://localhost/', 'http://localhost./', 'http://sub.localhost/',
    'http://metadata.google.internal/', 'http://instance-data.ec2.internal/',
    'http://intranet/', 'http://printer.local/', 'http://app.lan/', 'http://app.home/',
    'http://app.corp/', 'http://app.localdomain/', 'http://app.invalid/', 'http://app.test/',
    'http://127.0.0.1/', 'http://%31%32%37.0.0.1/', 'http://127.1/', 'http://2130706433/', 'http://0x7f000001/',
    'http://0177.0.0.1/', 'http://0.0.0.0/', 'http://10.1.2.3/', 'http://172.16.0.1/',
    'http://172.31.255.255/', 'http://192.168.1.1/', 'http://169.254.169.254/',
    'http://100.100.100.200/', 'http://168.63.129.16/', 'http://192.0.0.1/',
    'http://192.0.2.1/', 'http://198.18.0.1/', 'http://198.51.100.1/', 'http://203.0.113.1/',
    'http://224.0.0.1/', 'http://255.255.255.255/', 'http://[::]/', 'http://[::1]/',
    'http://[fd00::1]/', 'http://[fe80::1]/', 'http://[ff02::1]/',
    'http://[::ffff:127.0.0.1]/', 'http://[::ffff:93.184.216.34]/', 'http://[::127.0.0.1]/',
    'http://[64:ff9b::7f00:1]/', 'http://[2001:db8::1]/', 'http://[2002:7f00:1::]/',
    'http://[2001::1]/', 'http://[3fff::1]/',
    'file:///etc/passwd', 'ftp://public.example.org/', 'gopher://public.example.org/',
    'data:text/html,hello', 'https://user:placeholder@public.example.org/', 'https://@public.example.org/'
  ])('blocks disallowed target %s before any DNS or HTTP access', async url => {
    const env = setup();
    await expect(env.fetchHtml(url)).rejects.toMatchObject({ status: 400 });
    expect(env.lookup).not.toHaveBeenCalled();
    expect(env.request).not.toHaveBeenCalled();
  });

  test.each([null, 3, {}, [], '', 'not a URL', '/relative', 'x'.repeat(4097)])('rejects malformed URL %#', async input => {
    const env = setup();
    await expect(env.fetchHtml(input)).rejects.toMatchObject({ code: 'INVALID_URL' });
    expect(env.request).not.toHaveBeenCalled();
  });

  test.each([
    [{ address: '10.0.0.1', family: 4 }],
    [PUBLIC, { address: '127.0.0.1', family: 4 }],
    [PUBLIC, { address: 'fd00::1', family: 6 }],
    [PUBLIC, { address: '::ffff:169.254.169.254', family: 6 }],
    [{ address: '93.184.216.34', family: 6 }], [], [{ address: 'not-an-ip', family: 4 }]
  ].map(addresses => [addresses]))('rejects any unsafe or invalid DNS result %#', async addresses => {
    const env = setup([], { lookup: jest.fn().mockResolvedValue(addresses) });
    await expect(env.fetchHtml('https://public.example.org/')).rejects.toMatchObject({ code: 'BLOCKED_URL' });
    expect(env.request).not.toHaveBeenCalled();
  });

  test('scans public HTML and pins every connection lookup without resolving again', async () => {
    const lookup = jest.fn().mockResolvedValueOnce([PUBLIC, PUBLIC_V6])
      .mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);
    const env = setup([{}], { lookup });
    await expect(env.fetchHtml('https://public.example.org/page#section')).resolves.toBe(HTML);
    expect(lookup).toHaveBeenCalledWith('public.example.org', { all: true, verbatim: true });
    expect(lookup).toHaveBeenCalledTimes(1);
    const [url, options] = env.request.mock.calls[0];
    expect(url.href).toBe('https://public.example.org/page');
    expect(options).toMatchObject({ agent: false, autoSelectFamily: false, family: 4, method: 'GET' });
    expect(options.rejectUnauthorized).toBe(true);
    const callback = jest.fn();
    options.lookup('public.example.org', { all: true }, callback);
    expect(callback).toHaveBeenCalledWith(null, [PUBLIC]);
    options.lookup('public.example.org', {}, callback);
    expect(callback).toHaveBeenLastCalledWith(null, PUBLIC.address, 4);
    options.lookup('another.example.org', {}, callback);
    expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ code: 'BLOCKED_URL' }));
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(env.requests[0].setTimeout).toHaveBeenCalledWith(10000, expect.any(Function));
  });

  test.each(['http://93.184.216.34/', 'https://[2606:4700:4700::1111]/'])('allows public IP literal %s without DNS', async url => {
    const env = setup();
    await expect(env.fetchHtml(url)).resolves.toBe(HTML);
    expect(env.lookup).not.toHaveBeenCalled();
  });

  test('normalizes case and trailing-dot DNS while preserving the HTTP host', async () => {
    const env = setup();
    await expect(env.fetchHtml('https://PUBLIC.example.org./')).resolves.toBe(HTML);
    expect(env.lookup).toHaveBeenCalledWith('public.example.org', { all: true, verbatim: true });
    expect(env.request.mock.calls[0][0].hostname).toBe('public.example.org.');
  });

  test('supports public IPv6 DNS answers', async () => {
    const env = setup([{}], { lookup: jest.fn().mockResolvedValue([PUBLIC_V6]) });
    await expect(env.fetchHtml('https://public.example.org/')).resolves.toBe(HTML);
    expect(env.request.mock.calls[0][1].family).toBe(6);
  });

  test('follows relative and cross-host public redirects with fresh DNS validation', async () => {
    const env = setup([
      { status: 302, headers: { location: '/about' } },
      { status: 307, headers: { location: 'https://other.example.org/info' } }, {}
    ]);
    await expect(env.fetchHtml('http://public.example.org/')).resolves.toBe(HTML);
    expect(env.lookup.mock.calls.map(call => call[0])).toEqual(['public.example.org', 'public.example.org', 'other.example.org']);
    expect(env.request.mock.calls.map(call => call[0].href)).toEqual([
      'http://public.example.org/', 'http://public.example.org/about', 'https://other.example.org/info'
    ]);
    expect(env.streams.every(stream => stream.destroyed)).toBe(true);
  });

  test.each(['http://127.0.0.1/', 'http://169.254.169.254/', 'http://metadata.google.internal/',
    'http://[::ffff:10.0.0.1]/', 'file:///etc/passwd', '//user:placeholder@public.example.org/'])
  ('blocks redirect to %s', async location => {
    const env = setup([{ status: 301, headers: { location } }]);
    await expect(env.fetchHtml('https://public.example.org/')).rejects.toMatchObject({ code: 'BLOCKED_URL' });
    expect(env.request).toHaveBeenCalledTimes(1);
    expect(env.streams[0].destroyed).toBe(true);
  });

  test('rechecks DNS even for a same-host redirect, preventing rebinding', async () => {
    const lookup = jest.fn().mockResolvedValueOnce([PUBLIC]).mockResolvedValueOnce([{ address: '10.0.0.1', family: 4 }]);
    const env = setup([{ status: 302, headers: { location: '/next' } }], { lookup });
    await expect(env.fetchHtml('https://public.example.org/')).rejects.toMatchObject({ code: 'BLOCKED_URL' });
    expect(env.request).toHaveBeenCalledTimes(1);
  });

  test('limits redirect chains', async () => {
    const env = setup(Array(4).fill({ status: 302, headers: { location: '/loop' } }), { maxRedirects: 2 });
    await expect(env.fetchHtml('https://public.example.org/')).rejects.toMatchObject({ code: 'TOO_MANY_REDIRECTS' });
    expect(env.request).toHaveBeenCalledTimes(3);
  });

  test.each(['application/json', 'text/plain', 'image/png', ''])('rejects non-HTML response %s', async type => {
    const env = setup([{ headers: { 'content-type': type } }]);
    await expect(env.fetchHtml('https://public.example.org/')).rejects.toMatchObject({ status: 415 });
    expect(env.streams[0].destroyed).toBe(true);
  });

  test('accepts XHTML with a charset', async () => {
    const env = setup([{ headers: { 'content-type': 'application/xhtml+xml; charset=UTF-8' } }]);
    await expect(env.fetchHtml('https://public.example.org/')).resolves.toBe(HTML);
  });

  test('rejects excessive advertised size and chunked bodies exceeding the cap', async () => {
    for (const fixture of [
      { headers: { 'content-length': '513' } },
      { chunks: [Buffer.alloc(300), Buffer.alloc(300)] }
    ]) {
      const env = setup([fixture], { maxBytes: 512 });
      await expect(env.fetchHtml('https://public.example.org/')).rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
      expect(env.streams[0].destroyed).toBe(true);
    }
  });

  test.each([
    ['gzip', zlib.gzipSync], ['deflate', zlib.deflateSync], ['br', zlib.brotliCompressSync]
  ])('decodes bounded %s but rejects decompression expansion past the limit', async (encoding, compress) => {
    const good = setup([{ body: compress(Buffer.from(HTML)), headers: { 'content-encoding': encoding } }]);
    await expect(good.fetchHtml('https://public.example.org/')).resolves.toBe(HTML);
    const expanded = setup([{ body: compress(Buffer.alloc(10000, 65)), headers: { 'content-encoding': encoding } }], { maxBytes: 512 });
    await expect(expanded.fetchHtml('https://public.example.org/')).rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
    expect(expanded.streams[0].destroyed).toBe(true);
  });

  test('caps compressed wire bytes even when decoded content would fit', async () => {
    const compressed = zlib.gzipSync(Buffer.from('abc'));
    const env = setup([{ body: compressed, headers: { 'content-encoding': 'gzip' } }], { maxBytes: 10 });
    await expect(env.fetchHtml('https://public.example.org/')).rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
  });

  test.each(['compress', 'gzip, br'])('rejects unsupported or stacked encoding %s', async encoding => {
    const env = setup([{ headers: { 'content-encoding': encoding } }]);
    await expect(env.fetchHtml('https://public.example.org/')).rejects.toMatchObject({ code: 'UNSUPPORTED_ENCODING' });
  });

  test('bounds stalled DNS, then ignores late results without opening a connection', async () => {
    jest.useFakeTimers();
    let finishLookup;
    const env = setup([], { timeoutMs: 100, lookup: jest.fn(() => new Promise(resolve => { finishLookup = resolve; })) });
    const result = env.fetchHtml('https://public.example.org/');
    const assertion = expect(result).rejects.toMatchObject({ code: 'SCAN_TIMEOUT', status: 504 });
    await jest.advanceTimersByTimeAsync(100);
    await assertion;
    finishLookup([PUBLIC]);
    await Promise.resolve();
    expect(env.request).not.toHaveBeenCalled();
  });

  test('aborts stalled response headers', async () => {
    const env = setup([{ stallHeaders: true }], { timeoutMs: 20 });
    await expect(env.fetchHtml('https://public.example.org/')).rejects.toMatchObject({ code: 'SCAN_TIMEOUT' });
    expect(env.requests[0].destroy).toHaveBeenCalled();
  });

  test('ends a response body that never completes within the total deadline', async () => {
    const stream = new PassThrough();
    stream.write('<html>');
    const env = setup([{ stream }], { timeoutMs: 20 });
    await expect(env.fetchHtml('https://public.example.org/')).rejects.toMatchObject({ code: 'SCAN_TIMEOUT' });
    expect(stream.destroyed).toBe(true);
  });

  test('shares the deadline across redirect DNS lookups', async () => {
    jest.useFakeTimers();
    const lookup = jest.fn(() => new Promise(resolve => setTimeout(() => resolve([PUBLIC]), 60)));
    const env = setup([{ status: 302, headers: { location: '/next' } }], { timeoutMs: 100, lookup });
    const assertion = expect(env.fetchHtml('https://public.example.org/')).rejects.toMatchObject({ code: 'SCAN_TIMEOUT' });
    await jest.advanceTimersByTimeAsync(100);
    await assertion;
    expect(env.request).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(100);
  });

  test('returns generic errors without leaking resolver or transport details', async () => {
    for (const env of [
      setup([], { lookup: jest.fn().mockRejectedValue(new Error('resolver private-detail')) }),
      setup([{ error: new Error('transport private-detail') }]),
      setup([{ status: 503 }]),
      setup([{ body: Buffer.from('invalid compressed data'), headers: { 'content-encoding': 'gzip' } }])
    ]) {
      const error = await env.fetchHtml('https://public.example.org/').catch(value => value);
      expect(error).toBeInstanceOf(ScanUrlError);
      expect(error).toMatchObject({ status: 502, message: 'Unable to fetch this website.' });
    }
  });
});
