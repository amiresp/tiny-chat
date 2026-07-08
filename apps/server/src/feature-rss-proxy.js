import dns from 'node:dns/promises';
import net from 'node:net';
import express from 'express';
import { auth } from './auth.js';
import { route } from './feature-state.js';

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15_000;
const MAX_BYTES = 5 * 1024 * 1024;

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a >= 224;
}

function isPrivateIPv6(ip) {
  const value = ip.toLowerCase();
  return value === '::1'
    || value === '::'
    || value.startsWith('fc')
    || value.startsWith('fd')
    || value.startsWith('fe80')
    || value.startsWith('::ffff:127.')
    || value.startsWith('::ffff:10.')
    || value.startsWith('::ffff:192.168.')
    || /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(value);
}

function isBlockedAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return isPrivateIPv4(address);
  if (family === 6) return isPrivateIPv6(address);
  return true;
}

async function assertPublicUrl(url) {
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('RSS URL must use http or https.');
  }

  const hostname = url.hostname;
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Local RSS addresses are not allowed.');
  }

  const literalFamily = net.isIP(hostname);
  if (literalFamily) {
    if (isBlockedAddress(hostname)) throw new Error('Private RSS addresses are not allowed.');
    return;
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: false });
  if (!records.length || records.some((record) => isBlockedAddress(record.address))) {
    throw new Error('RSS host resolves to a private or invalid address.');
  }
}

async function readLimitedText(response) {
  const reader = response.body?.getReader?.();
  if (!reader) return response.text();

  const decoder = new TextDecoder();
  let total = 0;
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      reader.cancel().catch(() => {});
      throw new Error('RSS feed is too large.');
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
}

async function fetchRss(inputUrl, redirectCount = 0) {
  if (redirectCount > MAX_REDIRECTS) throw new Error('RSS feed redirected too many times.');

  const url = new URL(inputUrl);
  await assertPublicUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.5',
        'User-Agent': 'VerdantChatRSSProxy/1.0 (+https://chat.evaonline.ir)',
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`RSS feed returned redirect ${response.status} without location.`);
      const nextUrl = new URL(location, url).toString();
      return fetchRss(nextUrl, redirectCount + 1);
    }

    if (!response.ok) {
      throw new Error(`RSS server returned HTTP ${response.status}.`);
    }

    const xml = await readLimitedText(response);
    return {
      xml,
      finalUrl: url.toString(),
      contentType: response.headers.get('content-type') || 'application/xml',
    };
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('RSS request timed out.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createRssProxyRouter() {
  const router = express.Router();

  router.get('/rss/proxy', auth, route(async (request, response) => {
    const rawUrl = String(request.query.url || '').trim();
    if (!rawUrl) return response.status(400).json({ error: 'RSS URL is required.' });

    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return response.status(400).json({ error: 'Enter a valid RSS or Atom URL.' });
    }

    const result = await fetchRss(parsed.toString());
    response.setHeader('Cache-Control', 'private, max-age=60');
    return response.json(result);
  }));

  return router;
}
