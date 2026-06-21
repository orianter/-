import { isAllowedVideoHost } from './videoProxyToken.js';

export const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const SHARE_HOSTS = {
  tiktok: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
  instagram: ['instagram.com', 'instagr.am'],
  youtube: ['youtube.com', 'youtu.be'],
};

function decodeJsonString(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`);
  } catch {
    return value.replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/\\"/g, '"');
  }
}

function unescapeVideoUrl(raw) {
  if (!raw) return '';
  return decodeJsonString(raw).replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
}

function pickBestVideoUrl(candidates) {
  const urls = candidates.filter(Boolean).map(unescapeVideoUrl).filter(isAllowedVideoHost);
  return urls.find((url) => url.includes('.mp4')) || urls[0] || '';
}

export function detectSharePlatform(input) {
  try {
    const { hostname } = new URL(input.trim());
    const host = hostname.toLowerCase().replace(/^www\./, '');
    for (const [platform, hosts] of Object.entries(SHARE_HOSTS)) {
      if (hosts.some((h) => host === h || host.endsWith(`.${h}`))) return platform;
    }
    if (/\.(mp4|webm|mov)(\?|$)/i.test(input)) return 'direct';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export function normalizeShareUrl(input) {
  let url = String(input || '').trim();
  if (!url) throw new Error('יש להדביק קישור');
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('קישור לא תקין');
  return parsed.toString();
}

async function fetchText(url, { referer } = {}) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': MOBILE_UA,
      Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      ...(referer ? { Referer: referer } : {}),
    },
    redirect: 'follow',
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`לא ניתן לטעון את הקישור (${response.status})`);
  return { text, finalUrl: response.url, response };
}

function extractTikTokFromHtml(html) {
  const sigiMatch = html.match(/<script id="SIGI_STATE" type="application\/json">([^<]+)<\/script>/);
  if (sigiMatch) {
    try {
      const data = JSON.parse(sigiMatch[1]);
      const itemModule = data?.ItemModule;
      const item = itemModule ? Object.values(itemModule)[0] : null;
      const video = item?.video || item?.image?.video || null;
      const url = pickBestVideoUrl([
        video?.downloadAddr,
        video?.playAddr,
        video?.playApi,
        ...(Array.isArray(video?.PlayAddrStruct?.UrlList) ? video.PlayAddrStruct.UrlList : []),
      ]);
      if (url) return { directUrl: url, title: item?.desc || '' };
    } catch {
      /* fall through */
    }
  }

  const universalMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([^<]+)<\/script>/);
  if (universalMatch) {
    try {
      const data = JSON.parse(universalMatch[1]);
      const detail =
        data?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct
        || data?.__DEFAULT_SCOPE__?.['webapp.reflow.video.detail']?.itemInfo?.itemStruct;
      const video = detail?.video;
      const url = pickBestVideoUrl([
        video?.downloadAddr,
        video?.playAddr,
        ...(video?.bitrateInfo || []).map((b) => b?.PlayAddr?.UrlList?.[0]),
      ]);
      if (url) return { directUrl: url, title: detail?.desc || '' };
    } catch {
      /* fall through */
    }
  }

  const playMatch = html.match(/"playAddr":"(https:[^"]+)"/) || html.match(/"downloadAddr":"(https:[^"]+)"/);
  if (playMatch) {
    return { directUrl: unescapeVideoUrl(playMatch[1]), title: '' };
  }

  return null;
}

async function resolveTikTok(url) {
  const { text, finalUrl } = await fetchText(url);
  const parsed = extractTikTokFromHtml(text);
  if (!parsed?.directUrl) throw new Error('לא הצלחנו לחלץ את הסרטון מ-TikTok. נסה להוריד ולהעלות את הקובץ.');
  return {
    directUrl: parsed.directUrl,
    fileName: 'tiktok-video.mp4',
    contentType: 'video/mp4',
    platformHint: 'tiktok',
    title: parsed.title || '',
    sourceUrl: finalUrl,
  };
}

function extractInstagramFromHtml(html) {
  const ogVideo =
    html.match(/property="og:video:secure_url" content="([^"]+)"/i)
    || html.match(/property="og:video" content="([^"]+)"/i);
  if (ogVideo?.[1]) {
    return { directUrl: ogVideo[1].replace(/&amp;/g, '&'), title: '' };
  }

  const sharedMatch = html.match(/"video_url":"(https:[^"]+)"/);
  if (sharedMatch?.[1]) {
    return { directUrl: unescapeVideoUrl(sharedMatch[1]), title: '' };
  }

  const jsonLdMatch = html.match(/"contentUrl":"(https:[^"]+\.mp4[^"]*)"/i);
  if (jsonLdMatch?.[1]) {
    return { directUrl: unescapeVideoUrl(jsonLdMatch[1]), title: '' };
  }

  return null;
}

async function resolveInstagram(url) {
  const normalized = url.replace(/\/reels\//i, '/reel/');
  const { text, finalUrl } = await fetchText(normalized, { referer: 'https://www.instagram.com/' });
  let parsed = extractInstagramFromHtml(text);

  if (!parsed?.directUrl) {
    const embedUrl = normalized.replace(/\/?$/, '/embed/captioned/');
    const embed = await fetchText(embedUrl, { referer: 'https://www.instagram.com/' });
    parsed = extractInstagramFromHtml(embed.text);
  }

  if (!parsed?.directUrl || !isAllowedVideoHost(parsed.directUrl)) {
    throw new Error('לא הצלחנו לחלץ את הסרטון מ-Instagram. נסה להוריד ולהעלות את הקובץ.');
  }

  return {
    directUrl: parsed.directUrl,
    fileName: 'reels-video.mp4',
    contentType: 'video/mp4',
    platformHint: 'reels',
    title: parsed.title || '',
    sourceUrl: finalUrl,
  };
}

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  if (host === '::1' || host.startsWith('fe80:')) return true;
  return false;
}

async function resolveDirect(url) {
  const parsed = new URL(url);
  if (isPrivateHost(parsed.hostname)) throw new Error('קישור לא תקין');

  const head = await fetch(url, {
    method: 'HEAD',
    headers: { 'User-Agent': MOBILE_UA },
    redirect: 'follow',
  });
  const finalUrl = head.url || url;
  const contentType = head.headers.get('content-type') || '';
  const looksLikeVideo =
    contentType.startsWith('video/')
    || /\.(mp4|webm|mov)(\?|$)/i.test(finalUrl);

  if (!looksLikeVideo) throw new Error('הקישור לא מוביל לקובץ וידאו');

  if (!isAllowedVideoHost(finalUrl) && !/\.(mp4|webm|mov)(\?|$)/i.test(finalUrl)) {
    throw new Error('כתובת וידאו לא נתמכת');
  }

  return {
    directUrl: finalUrl,
    fileName: 'shared-video.mp4',
    contentType: contentType.startsWith('video/') ? contentType.split(';')[0] : 'video/mp4',
    platformHint: null,
    title: '',
    sourceUrl: url,
  };
}

export async function resolveShareUrl(input) {
  const url = normalizeShareUrl(input);
  const platform = detectSharePlatform(url);

  if (platform === 'tiktok') return resolveTikTok(url);
  if (platform === 'instagram') return resolveInstagram(url);
  if (platform === 'direct') return resolveDirect(url);

  throw new Error('קישור לא נתמך. הדבק קישור TikTok, Instagram Reels, או קובץ MP4 ישיר.');
}
