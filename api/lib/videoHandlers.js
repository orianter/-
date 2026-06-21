import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createProxyToken, verifyProxyToken, buildProxyUrl } from './videoProxyToken.js';
import { resolveShareUrl, MOBILE_UA, detectSharePlatform } from './resolveVideoUrl.js';

const MAX_BYTES = 100 * 1024 * 1024;

export function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(body));
}

export async function handleResolveVideoPost(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const shareUrl = req.body?.url;
    const platform = detectSharePlatform(String(shareUrl || ''));
    const resolved = await resolveShareUrl(shareUrl);
    const token = createProxyToken(resolved.directUrl);
    sendJson(res, 200, {
      ok: true,
      proxyUrl: buildProxyUrl(token, req),
      fileName: resolved.fileName,
      contentType: resolved.contentType,
      platformHint: resolved.platformHint,
      title: resolved.title,
      sourceUrl: resolved.sourceUrl,
      platform,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'שגיאה בטעינת הקישור';
    sendJson(res, 400, {
      error: message,
      fallback: 'upload',
      platform: detectSharePlatform(String(req.body?.url || '')),
    });
  }
}

function upstreamReferer(directUrl) {
  if (/instagram|cdninstagram|fbcdn/i.test(directUrl)) return 'https://www.instagram.com/';
  if (/tiktok|muscdn|byteoversea/i.test(directUrl)) return 'https://www.tiktok.com/';
  return undefined;
}

export async function handleVideoProxyGet(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const token = req.query?.token;
    const directUrl = verifyProxyToken(token);
    const referer = upstreamReferer(directUrl);

    const headers = {
      'User-Agent': MOBILE_UA,
      Accept: 'video/*,*/*',
      ...(referer ? { Referer: referer } : {}),
    };
    if (req.headers.range) headers.Range = req.headers.range;

    const upstream = await fetch(directUrl, { headers, redirect: 'follow' });
    if (!upstream.ok && upstream.status !== 206) {
      sendJson(res, 502, { error: 'לא ניתן להוריד את הסרטון מהמקור — נסה להעלות קובץ מהמכשיר' });
      return;
    }

    const contentLength = Number(upstream.headers.get('content-length') || 0);
    if (contentLength > MAX_BYTES) {
      sendJson(res, 413, { error: 'הסרטון גדול מדי (מקסימום 100MB)' });
      return;
    }

    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=600');

    const range = upstream.headers.get('content-range');
    if (range) res.setHeader('Content-Range', range);
    const len = upstream.headers.get('content-length');
    if (len) res.setHeader('Content-Length', len);

    if (upstream.body && typeof Readable.fromWeb === 'function') {
      await pipeline(Readable.fromWeb(upstream.body), res);
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      sendJson(res, 413, { error: 'הסרטון גדול מדי (מקסימום 100MB)' });
      return;
    }
    res.send(buffer);
  } catch (err) {
    sendJson(res, 400, { error: err instanceof Error ? err.message : 'שגיאה בהורדת הסרטון' });
  }
}
