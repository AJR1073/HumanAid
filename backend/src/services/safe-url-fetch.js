'use strict';

const dns = require('node:dns').promises;
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const { Transform, Writable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const zlib = require('node:zlib');

class ScanUrlError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ScanUrlError';
    this.status = status;
    this.code = code;
  }
}

const blocked = () => new ScanUrlError('URL must point to a public website.', 400, 'BLOCKED_URL');
const timeout = () => new ScanUrlError('Website scan timed out.', 504, 'SCAN_TIMEOUT');
const tooLarge = () => new ScanUrlError('Website response is too large to scan.', 413, 'RESPONSE_TOO_LARGE');
const failed = () => new ScanUrlError('Unable to fetch this website.', 502, 'SCAN_FAILED');

function ipv4Number(address) {
  return address.split('.').reduce((value, octet) => (value << 8n) | BigInt(octet), 0n);
}

function ipv6Number(address) {
  if (address.includes('.')) {
    const end = address.lastIndexOf(':');
    const value = ipv4Number(address.slice(end + 1));
    address = `${address.slice(0, end + 1)}${(value >> 16n).toString(16)}:${(value & 65535n).toString(16)}`;
  }
  const halves = address.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const groups = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group}`), 0n);
}

function within(value, base, prefix, bits) {
  const shift = BigInt(bits - prefix);
  return value >> shift === base >> shift;
}

// Reject non-public/special-purpose ranges, including cloud platform virtual IPs.
const blockedV4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4], ['168.63.129.16', 32]
].map(([address, prefix]) => [ipv4Number(address), prefix]);
const blockedV6 = [
  ['2001::', 23], // Protocol assignments, Teredo, benchmarking and ORCHID.
  ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20] // Documentation and 6to4.
].map(([address, prefix]) => [ipv6Number(address), prefix]);

function isPublicAddress(address) {
  if (typeof address !== 'string' || address.includes('%')) return false;
  const family = net.isIP(address);
  if (family === 4) {
    const value = ipv4Number(address);
    return !blockedV4.some(([base, prefix]) => within(value, base, prefix, 32));
  }
  if (family === 6) {
    const value = ipv6Number(address);
    // Only ordinary global unicast is allowed. This also rejects mapped IPv4,
    // NAT64, compatible IPv4, local, link-local, multicast and unspecified IPv6.
    return within(value, ipv6Number('2000::'), 3, 128) &&
      !blockedV6.some(([base, prefix]) => within(value, base, prefix, 128));
  }
  return false;
}

function validateUrl(input, base) {
  if (typeof input !== 'string' || !input.trim() || input.length > 4096) {
    throw new ScanUrlError('A valid website URL is required.', 400, 'INVALID_URL');
  }
  let url;
  try { url = new URL(input, base); } catch { throw new ScanUrlError('A valid website URL is required.', 400, 'INVALID_URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      /^(?:https?:)?\/\/[^/?#]*@/i.test(input.trim())) throw blocked();
  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (net.isIP(hostname)) {
    if (!isPublicAddress(hostname)) throw blocked();
  } else {
    if (hostname.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(hostname) ||
        /(?:^|\.)(?:localhost|localdomain|local|internal|intranet|lan|home|corp|test|invalid|example|onion|arpa)$/.test(hostname)) {
      throw blocked();
    }
  }
  url.hash = '';
  return { url, hostname };
}

function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

function createSafeHtmlFetcher({
  lookup = (hostname, options) => dns.lookup(hostname, options),
  request = (url, options, callback) => (url.protocol === 'https:' ? https : http).request(url, options, callback),
  timeoutMs = 10000,
  maxBytes = 2 * 1024 * 1024,
  maxRedirects = 3
} = {}) {
  for (const [name, value, minimum] of [['timeoutMs', timeoutMs, 1], ['maxBytes', maxBytes, 1], ['maxRedirects', maxRedirects, 0]]) {
    if (!Number.isSafeInteger(value) || value < minimum) throw new TypeError(`Invalid ${name}`);
  }

  async function resolvePublic(hostname, signal) {
    const family = net.isIP(hostname);
    const addresses = family ? [{ address: hostname, family }] :
      await abortable(lookup(hostname, { all: true, verbatim: true }), signal);
    if (signal.aborted) throw signal.reason;
    if (!Array.isArray(addresses) || !addresses.length || addresses.some(record =>
      !record || !isPublicAddress(record.address) || net.isIP(record.address) !== record.family)) throw blocked();
    return addresses[0];
  }

  function getResponse(url, hostname, address, signal) {
    return new Promise((resolve, reject) => {
      let req;
      const cleanup = () => signal.removeEventListener('abort', abort);
      const abort = () => { req?.destroy(signal.reason); cleanup(); reject(signal.reason); };
      signal.addEventListener('abort', abort, { once: true });
      try {
        req = request(url, {
          method: 'GET',
          agent: false, // Never reuse a socket resolved for an earlier request.
          family: address.family,
          autoSelectFamily: false,
          rejectUnauthorized: true,
          signal,
          headers: {
            'User-Agent': 'HumanAid-Bot/1.0',
            Accept: 'text/html, application/xhtml+xml',
            'Accept-Encoding': 'gzip, deflate, br'
          },
          // Preserve the URL host for Host/TLS validation while pinning the TCP
          // connection to the address already validated. No second DNS lookup.
          lookup: (requestedHost, options, callback) => {
            if (typeof options === 'function') { callback = options; options = {}; }
            if (requestedHost.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase() !== hostname) return callback(blocked());
            if (options.all) callback(null, [{ ...address }]);
            else callback(null, address.address, address.family);
          }
        }, response => {
          cleanup();
          if (signal.aborted) { response.destroy(); reject(signal.reason); }
          else resolve(response);
        });
        req.once('error', error => { cleanup(); reject(error); });
        req.setTimeout(timeoutMs, () => req.destroy(timeout()));
        if (signal.aborted) abort();
        else req.end();
      } catch (error) { cleanup(); req?.destroy(); reject(error); }
    });
  }

  async function readHtml(response, signal) {
    const type = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!['text/html', 'application/xhtml+xml'].includes(type)) {
      throw new ScanUrlError('Website must return an HTML page.', 415, 'UNSUPPORTED_CONTENT_TYPE');
    }
    const length = response.headers['content-length'];
    if (length !== undefined && (!/^\d+$/.test(String(length)) || Number(length) > maxBytes)) throw tooLarge();
    const encoding = String(response.headers['content-encoding'] || 'identity').trim().toLowerCase();
    const decoders = { gzip: zlib.createGunzip, deflate: zlib.createInflate, br: zlib.createBrotliDecompress };
    if (encoding !== 'identity' && !Object.hasOwn(decoders, encoding)) {
      throw new ScanUrlError('Website response encoding is not supported.', 415, 'UNSUPPORTED_ENCODING');
    }
    let wireBytes = 0;
    let decodedBytes = 0;
    const chunks = [];
    const wireLimit = new Transform({
      transform(chunk, _, callback) {
        wireBytes += chunk.length;
        callback(wireBytes > maxBytes ? tooLarge() : null, chunk);
      }
    });
    const collector = new Writable({
      write(chunk, _, callback) {
        decodedBytes += chunk.length;
        if (decodedBytes > maxBytes) return callback(tooLarge());
        chunks.push(Buffer.from(chunk));
        callback();
      }
    });
    const streams = [response, wireLimit];
    if (encoding !== 'identity') streams.push(decoders[encoding]());
    await pipeline(...streams, collector, { signal });
    return Buffer.concat(chunks, decodedBytes).toString('utf8');
  }

  return async function fetchPublicHtml(input) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(timeout()), timeoutMs);
    try {
      let target = validateUrl(input);
      for (let redirects = 0; ; redirects++) {
        const address = await resolvePublic(target.hostname, controller.signal);
        const response = await getResponse(target.url, target.hostname, address, controller.signal);
        try {
          if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
            if (redirects >= maxRedirects) throw new ScanUrlError('Website redirects too many times.', 502, 'TOO_MANY_REDIRECTS');
            target = validateUrl(response.headers.location, target.url);
            continue;
          }
          if (!Number.isInteger(response.statusCode) || response.statusCode < 200 || response.statusCode >= 300) throw failed();
          return await readHtml(response, controller.signal);
        } finally { response.destroy(); }
      }
    } catch (error) {
      if (controller.signal.aborted) throw controller.signal.reason;
      if (error instanceof ScanUrlError) throw error;
      throw failed(); // Never expose internal addresses, DNS errors, or URL credentials.
    } finally { clearTimeout(timer); }
  };
}

module.exports = { ScanUrlError, createSafeHtmlFetcher, fetchPublicHtml: createSafeHtmlFetcher() };
