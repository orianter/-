import { isAllowedVideoHost } from './videoProxyToken.js';

export const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

export const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const DESKTOP_UA = CHROME_UA;

const SHARE_HOSTS = {
  tiktok: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
  instagram: ['instagram.com', 'instagr.am'],
  youtube: ['youtube.com', 'youtu.be'],
};

const URL_IN_TEXT_RE =
  /https?:\/\/(?:www\.)?(?:tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com|instagram\.com|instagr\.am)[^\s<>"']+/gi;

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
  const urls = candidates.filter(Boolean).map(unescapeVideoUrl).filter(Boolean);
  const allowed = urls.filter(isAllowedVideoHost);
  const pool = allowed.length ? allowed : urls.filter((u) => /^https:\/\/.+\.(mp4|webm)(\?|$)/i.test(u));
  return pool.find((url) => url.includes('.mp4')) || pool[0] || '';
}

function extractUrlsFromHtml(html) {
  if (!html) return [];
  const found = [];
  const patterns = [
    /href="(https:[^"]+\.mp4[^"]*)"/gi,
    /"playAddr":"(https:[^"]+)"/g,
    /"downloadAddr":"(https:[^"]+)"/g,
    /"play":"(https:[^"]+)"/g,
    /"hdplay":"(https:[^"]+)"/g,
    /"wmplay":"(https:[^"]+)"/g,
    /"video_url":"(https:[^"]+)"/g,
    /property="og:video(?::secure_url)?" content="([^"]+)"/gi,
    /"contentUrl":"(https:[^"]+\.mp4[^"]*)"/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      found.push(unescapeVideoUrl(match[1]));
    }
  }
  return found;
}

function walkJsonForVideoUrls(value, out = [], depth = 0) {
  if (depth > 16 || value == null) return out;
  if (typeof value === 'string') {
    const decoded = unescapeVideoUrl(value);
    if (
      /^https:\/\/.+/i.test(decoded)
      && (
        decoded.includes('.mp4')
        || decoded.includes('mime_type=video')
        || decoded.includes('video/tos')
        || decoded.includes('mime_type=video_mp4')
        || /\/video\//i.test(decoded)
      )
    ) {
      out.push(decoded);
    }
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => walkJsonForVideoUrls(item, out, depth + 1));
    return out;
  }
  if (typeof value === 'object') {
    for (const key of [
      'playAddr', 'downloadAddr', 'play', 'hdplay', 'wmplay', 'video_url', 'contentUrl', 'url',
      'playApi', 'downloadApi', 'noWatermark', 'watermark', 'video', 'videoUrl', 'src',
    ]) {
      if (value[key]) walkJsonForVideoUrls(value[key], out, depth + 1);
    }
    if (Array.isArray(value.UrlList)) walkJsonForVideoUrls(value.UrlList, out, depth + 1);
    if (Array.isArray(value.url_list)) walkJsonForVideoUrls(value.url_list, out, depth + 1);
    if (Array.isArray(value.bitrateInfo)) {
      value.bitrateInfo.forEach((b) => walkJsonForVideoUrls(b?.PlayAddr?.UrlList, out, depth + 1));
    }
    if (value.PlayAddrStruct) walkJsonForVideoUrls(value.PlayAddrStruct, out, depth + 1);
    Object.values(value).forEach((v) => walkJsonForVideoUrls(v, out, depth + 1));
  }
  return out;
}

export function extractShareUrlFromText(input) {
  const text = String(input || '').trim();
  if (!text) return '';
  const matches = text.match(URL_IN_TEXT_RE);
  if (matches?.length) return matches[0].replace(/[.,;:!?)]+$/, '');
  return text.split(/\s+/).find((part) => /^https?:\/\//i.test(part))?.replace(/[.,;:!?)]+$/, '') || text;
}

export function detectSharePlatform(input) {
  try {
    const { hostname } = new URL(extractShareUrlFromText(input).trim());
    const host = hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
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
  let url = extractShareUrlFromText(input);
  if (!url) throw new Error('יש להדביק קישור');
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('קישור לא תקין');
  return parsed.toString();
}

async function fetchText(url, { referer, userAgent = DESKTOP_UA, accept } = {}) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      Accept: accept || 'text/html,application/json;q=0.9,*/*;q=0.8',
      ...(referer ? { Referer: referer } : {}),
    },
    redirect: 'follow',
  });
  const text = await response.text();
  return { text, finalUrl: response.url, response, ok: response.ok, status: response.status };
}

export async function followShareUrl(url) {
  const { finalUrl } = await fetchText(url, { userAgent: DESKTOP_UA });
  return finalUrl || url;
}

function extractTikTokItemId(url) {
  return url.match(/video\/(\d+)/)?.[1] || url.match(/\/v\/(\d+)/)?.[1] || null;
}

function extractInstagramShortcode(url) {
  return url.match(/\/(?:reel|reels|p|tv)\/([^/?#]+)/i)?.[1] || null;
}

function tikTokMobileUrl(itemId) {
  return itemId ? `https://m.tiktok.com/v/${itemId}.html` : null;
}

async function resolveViaTobyg74(url) {
  try {
    const mod = await import('@tobyg74/tiktok-api-dl');
    const Tiktok = mod.default || mod;
    for (const version of ['v2', 'v1', 'v3']) {
      const result = await Tiktok.Downloader(url, { version });
      if (!result || result.status === 'error') continue;
      const data = result.result || result.data || result;
      const video = data?.video || data;
      const direct = pickBestVideoUrl([
        video?.playAddr,
        video?.downloadAddr,
        video?.play,
        video?.hdplay,
        video?.noWatermark,
        video?.watermark,
        video?.wmplay,
        ...(Array.isArray(video?.playAddr?.urlList) ? video.playAddr.urlList : []),
        ...(Array.isArray(video?.downloadAddr?.urlList) ? video.downloadAddr.urlList : []),
      ]);
      if (direct) {
        return { directUrl: direct, title: data?.desc || data?.title || video?.title || '' };
      }
      const urls = walkJsonForVideoUrls(result);
      const fromWalk = pickBestVideoUrl(urls);
      if (fromWalk) return { directUrl: fromWalk, title: data?.desc || '' };
    }
  } catch {
    /* try next resolver */
  }
  return null;
}

async function resolveViaMusicaldown(url) {
  const home = await fetchText('https://musicaldown.com/en', { userAgent: CHROME_UA });
  const token = home.text.match(/name="token" value="([^"]+)"/)?.[1];
  const res = await fetch('https://musicaldown.com/download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': CHROME_UA,
      Origin: 'https://musicaldown.com',
      Referer: 'https://musicaldown.com/en',
    },
    body: `link=${encodeURIComponent(url)}${token ? `&verify=${encodeURIComponent(token)}` : ''}`,
    redirect: 'follow',
  });
  const html = await res.text();
  const direct = pickBestVideoUrl(extractUrlsFromHtml(html));
  if (!direct) return null;
  return { directUrl: direct, title: '' };
}

async function resolveViaTikwmGet(url) {
  const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`, {
    headers: { 'User-Agent': CHROME_UA, Accept: 'application/json' },
  });
  const data = await res.json().catch(() => null);
  if (!data || data.code !== 0 || !data.data) return null;
  const direct = pickBestVideoUrl([data.data.hdplay, data.data.play, data.data.wmplay]);
  if (!direct) return null;
  return { directUrl: direct, title: data.data.title || '' };
}

async function resolveViaLovetik(url) {
  const res = await fetch('https://lovetik.app/api/ajaxSearch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': DESKTOP_UA,
      Origin: 'https://lovetik.app',
      Referer: 'https://lovetik.app/',
    },
    body: `q=${encodeURIComponent(url)}&lang=en`,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (data.statusCode && Number(data.statusCode) !== 200) return null;
  const html = data.data || data.result || '';
  const direct = pickBestVideoUrl(extractUrlsFromHtml(html));
  if (!direct) return null;
  return { directUrl: direct, title: '' };
}

async function resolveViaTikwm(url) {
  const res = await fetch('https://www.tikwm.com/api/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': DESKTOP_UA,
    },
    body: `url=${encodeURIComponent(url)}&hd=1`,
  });
  const data = await res.json().catch(() => null);
  if (!data || data.code !== 0 || !data.data) return null;
  const direct = pickBestVideoUrl([data.data.hdplay, data.data.play, data.data.wmplay]);
  if (!direct) return null;
  return { directUrl: direct, title: data.data.title || '' };
}

async function resolveViaSsstik(url) {
  const home = await fetchText('https://ssstik.io/en', { userAgent: DESKTOP_UA });
  const tt = home.text.match(/name="tt" value="([^"]+)"/)?.[1] || 'YWJj';
  const res = await fetch('https://ssstik.io/abc?url=dl', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': DESKTOP_UA,
      Origin: 'https://ssstik.io',
      Referer: 'https://ssstik.io/en',
    },
    body: `id=${encodeURIComponent(url)}&locale=en&tt=${encodeURIComponent(tt)}`,
  });
  const html = await res.text();
  if (html.includes('panel critical') || html.includes('Something went wrong')) return null;
  const without = html.match(/href="(https:\/\/ssstik\.io\/abc\?url=dl[^"]+)"/i)?.[1]
    || html.match(/href="(https:\/\/tikcdn\.io[^"]+)"/i)?.[1];
  const directFromHtml = pickBestVideoUrl(extractUrlsFromHtml(html));
  if (directFromHtml) return { directUrl: directFromHtml, title: '' };
  if (!without) return null;
  const followed = await fetch(without, { redirect: 'follow', headers: { 'User-Agent': DESKTOP_UA } });
  const final = followed.url;
  if (isAllowedVideoHost(final) || /\.mp4(\?|$)/i.test(final)) {
    return { directUrl: final, title: '' };
  }
  const buf = await followed.arrayBuffer();
  if (buf.byteLength > 1000 && buf.byteLength < 100 * 1024 * 1024) {
    return { directUrl: final, title: '' };
  }
  return null;
}

async function resolveViaTdown(url) {
  const res = await fetch(`https://tdownv4.sl-bjs.workers.dev/?down=${encodeURIComponent(url)}`, {
    headers: { Accept: 'application/json', 'User-Agent': DESKTOP_UA },
  });
  const data = await res.json().catch(() => null);
  const direct = pickBestVideoUrl([data?.download_url, data?.url, data?.video_url]);
  if (!direct) return null;
  return { directUrl: direct, title: data?.title || '' };
}

async function resolveViaRapidApi(url) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return null;
  const hosts = [
    { host: 'tiktok-scraper7.p.rapidapi.com', path: `/?url=${encodeURIComponent(url)}&hd=1` },
    { host: 'tiktok-video-no-watermark2.p.rapidapi.com', path: `/?url=${encodeURIComponent(url)}&hd=1` },
  ];
  for (const { host, path } of hosts) {
    const res = await fetch(`https://${host}${path}`, {
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': host },
    });
    const data = await res.json().catch(() => null);
    const direct = pickBestVideoUrl([
      data?.data?.play,
      data?.data?.hdplay,
      data?.data?.download_addr,
      data?.video?.play_addr?.url_list?.[0],
      data?.play,
      data?.hdplay,
    ]);
    if (direct) return { directUrl: direct, title: data?.data?.title || data?.title || '' };
  }
  return null;
}

async function resolveTikTokViaItemApi(itemId, referer) {
  const home = await fetch('https://www.tiktok.com/', { headers: { 'User-Agent': DESKTOP_UA }, redirect: 'follow' });
  const cookies = (home.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  const apiUrl = `https://www.tiktok.com/api/item/detail/?itemId=${itemId}&aid=1988&app_name=tiktok_web&device_platform=web_pc&referer=${encodeURIComponent(referer)}`;
  const res = await fetch(apiUrl, {
    headers: {
      'User-Agent': DESKTOP_UA,
      Accept: 'application/json',
      Referer: referer,
      ...(cookies ? { Cookie: cookies } : {}),
    },
  });
  const text = await res.text();
  if (!text) return null;
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    const direct = pickBestVideoUrl(extractUrlsFromHtml(text));
    return direct ? { directUrl: direct, title: '' } : null;
  }
  const urls = walkJsonForVideoUrls(json);
  const direct = pickBestVideoUrl(urls);
  if (!direct) return null;
  return { directUrl: direct, title: json?.itemInfo?.itemStruct?.desc || '' };
}

function extractTikTokFromHtml(html) {
  const sigiMatch = html.match(/<script id="SIGI_STATE" type="application\/json">([^<]+)<\/script>/);
  if (sigiMatch) {
    try {
      const data = JSON.parse(sigiMatch[1]);
      const urls = walkJsonForVideoUrls(data);
      const direct = pickBestVideoUrl(urls);
      if (direct) {
        const item = data?.ItemModule ? Object.values(data.ItemModule)[0] : null;
        return { directUrl: direct, title: item?.desc || '' };
      }
    } catch {
      /* fall through */
    }
  }

  const universalMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([^<]+)<\/script>/);
  if (universalMatch) {
    try {
      const data = JSON.parse(universalMatch[1]);
      const urls = walkJsonForVideoUrls(data);
      const direct = pickBestVideoUrl(urls);
      if (direct) {
        const detail =
          data?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct
          || data?.__DEFAULT_SCOPE__?.['webapp.reflow.video.detail']?.itemInfo?.itemStruct;
        return { directUrl: direct, title: detail?.desc || '' };
      }
    } catch {
      /* fall through */
    }
  }

  const direct = pickBestVideoUrl(extractUrlsFromHtml(html));
  return direct ? { directUrl: direct, title: '' } : null;
}

async function resolveTikTokViaHtml(url, userAgent = CHROME_UA) {
  const { text, finalUrl } = await fetchText(url, { userAgent, referer: 'https://www.tiktok.com/' });
  const parsed = extractTikTokFromHtml(text);
  if (!parsed?.directUrl) return null;
  return { ...parsed, sourceUrl: finalUrl };
}

async function resolveTikTokViaHtmlMulti(url) {
  for (const ua of [CHROME_UA, MOBILE_UA]) {
    const parsed = await resolveTikTokViaHtml(url, ua);
    if (parsed?.directUrl) return parsed;
  }
  return null;
}

async function resolveTikTokViaEmbed(itemId) {
  const { text } = await fetchText(`https://www.tiktok.com/embed/v2/${itemId}`, {
    userAgent: DESKTOP_UA,
    referer: 'https://www.tiktok.com/',
  });
  const parsed = extractTikTokFromHtml(text);
  if (!parsed?.directUrl) return null;
  return parsed;
}

async function resolveTikTok(url) {
  const canonical = await followShareUrl(url);
  const itemId = extractTikTokItemId(canonical);
  const candidates = [
    canonical,
    tikTokMobileUrl(itemId),
    itemId ? `https://www.tiktok.com/@_/video/${itemId}` : null,
  ].filter(Boolean);

  const attempts = [];
  for (const candidate of candidates) {
    attempts.push(
      () => resolveViaTobyg74(candidate),
      () => resolveViaRapidApi(candidate),
      () => resolveViaLovetik(candidate),
      () => resolveViaTikwm(candidate),
      () => resolveViaTikwmGet(candidate),
      () => resolveViaSsstik(candidate),
      () => resolveViaTdown(candidate),
      () => resolveViaMusicaldown(candidate),
      () => resolveTikTokViaHtmlMulti(candidate),
    );
    if (itemId) {
      attempts.push(
        () => resolveTikTokViaItemApi(itemId, candidate),
        () => resolveTikTokViaEmbed(itemId),
      );
    }
  }

  for (const attempt of attempts) {
    try {
      const parsed = await attempt();
      if (parsed?.directUrl) {
        return {
          directUrl: parsed.directUrl,
          fileName: 'tiktok-video.mp4',
          contentType: 'video/mp4',
          platformHint: 'tiktok',
          title: parsed.title || '',
          sourceUrl: parsed.sourceUrl || canonical,
        };
      }
    } catch {
      /* try next */
    }
  }

  throw new Error(
    'TikTok חוסם הורדה אוטומטית מהשרת. שמור את הסרטון מהאפליקציה (שיתוף → שמור וידאו / Save video) והעלה את הקובץ MP4 למטה.',
  );
}

async function resolveViaInstadownloader(url) {
  const res = await fetch('https://instadownloader.co/api/ajaxSearch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: 'https://instadownloader.co',
      Referer: 'https://instadownloader.co/',
      'User-Agent': CHROME_UA,
    },
    body: `q=${encodeURIComponent(url)}&t=media&lang=en`,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { data: text };
  }
  const html = data.data || text;
  const direct = pickBestVideoUrl(extractUrlsFromHtml(html));
  if (!direct) return null;
  return { directUrl: direct, title: '' };
}

async function resolveViaSssInstagram(url) {
  const res = await fetch('https://sssinstagram.com/api/convert', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://sssinstagram.com',
      Referer: 'https://sssinstagram.com/',
      'User-Agent': DESKTOP_UA,
    },
    body: JSON.stringify({ url }),
  });
  const data = await res.json().catch(() => null);
  const direct = pickBestVideoUrl([
    data?.url,
    data?.video_url,
    data?.data?.url,
    ...(Array.isArray(data?.medias) ? data.medias.map((m) => m.url) : []),
  ]);
  if (direct) return { directUrl: direct, title: data?.title || '' };
  const html = typeof data === 'string' ? data : JSON.stringify(data || {});
  const fromHtml = pickBestVideoUrl(extractUrlsFromHtml(html));
  return fromHtml ? { directUrl: fromHtml, title: '' } : null;
}

async function resolveViaSnapinsta(url) {
  const res = await fetch('https://snapinsta.to/api/ajaxSearch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: 'https://snapinsta.to',
      Referer: 'https://snapinsta.to/',
      'User-Agent': DESKTOP_UA,
    },
    body: `q=${encodeURIComponent(url)}&t=media&lang=en`,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { data: text };
  }
  const html = data.data || text;
  const direct = pickBestVideoUrl(extractUrlsFromHtml(html));
  if (!direct) return null;
  return { directUrl: direct, title: '' };
}

async function resolveInstagramViaGraph(shortcode, referer) {
  const res = await fetch(`https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`, {
    headers: {
      'User-Agent': DESKTOP_UA,
      'X-IG-App-ID': '936619743392459',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: referer,
    },
    redirect: 'follow',
  });
  const text = await res.text();
  if (!text || text.startsWith('<!')) return null;
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const urls = walkJsonForVideoUrls(json);
  const direct = pickBestVideoUrl(urls);
  if (!direct) return null;
  return { directUrl: direct, title: json?.graphql?.shortcode_media?.edge_media_to_caption?.edges?.[0]?.node?.text || '' };
}

function extractInstagramFromHtml(html) {
  const direct = pickBestVideoUrl(extractUrlsFromHtml(html));
  return direct ? { directUrl: direct, title: '' } : null;
}

async function resolveInstagram(url) {
  const normalized = (await followShareUrl(url)).replace(/\/reels\//i, '/reel/');
  const shortcode = extractInstagramShortcode(normalized);

  const attempts = [
    () => resolveViaSssInstagram(normalized),
    () => resolveViaSnapinsta(normalized),
    () => resolveViaInstadownloader(normalized),
    async () => {
      const { text, finalUrl } = await fetchText(normalized, {
        userAgent: CHROME_UA,
        referer: 'https://www.instagram.com/',
      });
      const parsed = extractInstagramFromHtml(text);
      return parsed ? { ...parsed, sourceUrl: finalUrl } : null;
    },
    async () => {
      const { text, finalUrl } = await fetchText(normalized, {
        userAgent: MOBILE_UA,
        referer: 'https://www.instagram.com/',
      });
      const parsed = extractInstagramFromHtml(text);
      return parsed ? { ...parsed, sourceUrl: finalUrl } : null;
    },
    async () => {
      const embedUrl = normalized.replace(/\/?$/, '/embed/captioned/');
      const { text } = await fetchText(embedUrl, { referer: 'https://www.instagram.com/' });
      return extractInstagramFromHtml(text);
    },
    () => (shortcode ? resolveInstagramViaGraph(shortcode, normalized) : null),
  ];

  for (const attempt of attempts) {
    try {
      const parsed = await attempt();
      if (parsed?.directUrl && (isAllowedVideoHost(parsed.directUrl) || parsed.directUrl.includes('.mp4'))) {
        return {
          directUrl: parsed.directUrl,
          fileName: 'reels-video.mp4',
          contentType: 'video/mp4',
          platformHint: 'reels',
          title: parsed.title || '',
          sourceUrl: parsed.sourceUrl || normalized,
        };
      }
    } catch {
      /* try next */
    }
  }

  throw new Error(
    'Instagram חוסם הורדה אוטומטית (ריל פרטי/מוגבל או חסימת שרת). שמור מהאפליקציה (⋯ → שמור) והעלה קובץ MP4 למטה.',
  );
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
