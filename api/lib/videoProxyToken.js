import crypto from 'crypto';

const TOKEN_TTL_MS = 10 * 60 * 1000;

const ALLOWED_VIDEO_HOSTS = [
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'tiktokcdn-eu.com',
  'tiktokv.com',
  'tiktok.com',
  'muscdn.com',
  'musical.ly',
  'byteoversea.com',
  'byteicdn.com',
  'ibyteimg.com',
  'tiktokv.us',
  'tiktokw.us',
  'tiktokcdn-us.com',
  'cdninstagram.com',
  'fbcdn.net',
  'instagram.com',
  'googlevideo.com',
  'youtube.com',
  'ytimg.com',
  'ssstik.io',
  'tikcdn.io',
  'lovetik.app',
  'lovetik.com',
  'musicaldown.com',
  'snaptik.app',
  'snaptik.io',
  'tikwm.com',
  'tikwm.net',
  'douyin.wtf',
  'tiklydown.eu.org',
  'instadownloader.co',
  'saveig.app',
  'snapinsta.to',
  'sssinstagram.com',
  'ttwstatic.com',
];

function getSecret() {
  return (
    process.env.VIDEO_PROXY_SECRET
    || process.env.OPENAI_API_KEY
    || 'reel-analyzer-dev-secret'
  ).slice(0, 64);
}

export function isAllowedVideoHost(urlString) {
  try {
    const { hostname, protocol } = new URL(urlString);
    if (protocol !== 'https:') return false;
    const host = hostname.toLowerCase();
    return ALLOWED_VIDEO_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

export function createProxyToken(directUrl) {
  if (!isAllowedVideoHost(directUrl)) {
    throw new Error('כתובת וידאו לא מורשית');
  }
  const payload = Buffer.from(JSON.stringify({
    u: directUrl,
    e: Date.now() + TOKEN_TTL_MS,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyProxyToken(token) {
  if (!token || typeof token !== 'string') throw new Error('טוקן חסר');
  const [payload, sig] = token.split('.');
  if (!payload || !sig) throw new Error('טוקן לא תקין');

  const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('טוקן לא תקין');
  }

  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!data?.u || Date.now() > Number(data.e)) throw new Error('הקישור פג תוקף — נסה שוב');

  if (!isAllowedVideoHost(data.u)) throw new Error('כתובת וידאו לא מורשית');
  return data.u;
}

export function buildProxyUrl(token, req) {
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  const proto = req?.headers?.['x-forwarded-proto'] || 'https';
  if (host) return `${proto}://${host}/api/video-proxy?token=${encodeURIComponent(token)}`;
  return `/api/video-proxy?token=${encodeURIComponent(token)}`;
}
