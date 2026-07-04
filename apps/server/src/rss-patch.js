import dns from 'node:dns/promises';
import net from 'node:net';
import Parser from 'rss-parser';

const MAX_REDIRECTS = 5;
const MAX_FEED_BYTES = 5 * 1024 * 1024;
const FEED_TIMEOUT_MS = 15_000;

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb') ||
      normalized.startsWith('::ffff:127.') ||
      normalized.startsWith('::ffff:10.') ||
      normalized.startsWith('::ffff:192.168.')
    );
  }

  return true;
}

async function assertPublicFeedUrl(value) {
  let url;
  try {
    url = new URL(String(value || '').trim());
  } catch {
    throw new Error('Enter a valid RSS or Atom feed URL');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('RSS URL must use http or https');
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Local network RSS URLs are not allowed');
  }

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error('RSS host could not be resolved');
  }

  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error('Private network RSS URLs are not allowed');
  }

  return url;
}

async function fetchFeedText(initialUrl) {
  let currentUrl = await assertPublicFeedUrl(initialUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.5',
        'User-Agent': 'VerdantChat/1.0 (+https://chat.evaonline.ir)',
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('RSS server returned an invalid redirect');
      if (redirectCount === MAX_REDIRECTS) throw new Error('RSS feed has too many redirects');
      currentUrl = await assertPublicFeedUrl(new URL(location, currentUrl).toString());
      continue;
    }

    if (!response.ok) {
      throw new Error(`RSS server returned HTTP ${response.status}`);
    }

    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_FEED_BYTES) {
      throw new Error('RSS feed is too large');
    }

    const text = await response.text();
    if (!text.trim()) throw new Error('RSS feed is empty');
    if (Buffer.byteLength(text, 'utf8') > MAX_FEED_BYTES) {
      throw new Error('RSS feed is too large');
    }

    return text;
  }

  throw new Error('RSS feed could not be loaded');
}

Parser.prototype.parseURL = async function parseUrlWithFetch(url) {
  const xml = await fetchFeedText(url);
  try {
    return await this.parseString(xml);
  } catch {
    throw new Error('The URL did not return a valid RSS or Atom feed');
  }
};
