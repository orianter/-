import crypto from 'crypto';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://hgfyokwxcvuufzskvloi.supabase.co').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
const COOKIE_NAME = 'ra_free_used';
const FINGERPRINT_HEADER = 'x-device-fingerprint';
const FREE_LIMIT_MESSAGE = 'הניתוח החינמי כבר נוצל — בחר מסלול';

export { FREE_LIMIT_MESSAGE };

export function isFreeUsageDisabled() {
  return process.env.FREE_USAGE_DISABLED === '1' || process.env.FREE_USAGE_DISABLED === 'true';
}

function getSecret() {
  return (
    process.env.FREE_USAGE_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.OPENAI_API_KEY
    || 'reel-analyzer-free-usage-dev'
  ).slice(0, 64);
}

export function extractClientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req?.headers?.['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  return req?.socket?.remoteAddress || 'unknown';
}

export function normalizeFingerprint(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!/^[a-f0-9-]{16,64}$/.test(value)) return null;
  return value;
}

export function extractFingerprint(req, body) {
  const fromHeader = req?.headers?.[FINGERPRINT_HEADER] || req?.headers?.['X-Device-Fingerprint'];
  const fromBody = body?.deviceFingerprint;
  return normalizeFingerprint(fromHeader || fromBody);
}

export function hashIp(ip) {
  return crypto.createHash('sha256').update(`${getSecret()}|ip|${ip}`).digest('hex');
}

export function buildIdentityHash(fingerprint, ip) {
  const ipHash = hashIp(ip);
  const identityHash = crypto
    .createHash('sha256')
    .update(`${getSecret()}|identity|${fingerprint}|${ipHash}`)
    .digest('hex');
  return { identityHash, ipHash };
}

function signCookiePayload(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyCookieValue(value) {
  if (!value || typeof value !== 'string') return null;
  const [encoded, sig] = value.split('.');
  if (!encoded || !sig) return null;
  const expected = crypto.createHmac('sha256', getSecret()).update(encoded).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload?.h || typeof payload.h !== 'string') return null;
    return payload.h;
  } catch {
    return null;
  }
}

export function readUsageCookie(req) {
  const cookieHeader = req?.headers?.cookie;
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key, rest.join('=')];
    }),
  );
  return verifyCookieValue(cookies[COOKIE_NAME]);
}

export function setUsageCookie(res, identityHash) {
  const token = signCookiePayload({ h: identityHash, v: 1 });
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=31536000',
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

async function supabaseFetch(path, options = {}) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...(options.headers || {}),
    },
  });
  return res;
}

export async function hasStoredUsage(identityHash) {
  if (!SUPABASE_SERVICE_ROLE_KEY) return false;
  const res = await supabaseFetch(
    `free_analysis_usage?identity_hash=eq.${encodeURIComponent(identityHash)}&select=identity_hash&limit=1`,
    { method: 'GET' },
  );
  if (res.status === 404) return false;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase usage lookup failed: ${res.status} ${text.slice(0, 120)}`);
  }
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

export async function storeUsage({ identityHash, fingerprint, ipHash }) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  }
  const res = await supabaseFetch('free_analysis_usage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify([{
      identity_hash: identityHash,
      fingerprint,
      ip_hash: ipHash,
      used_at: new Date().toISOString(),
    }]),
  });
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    throw new Error(`Supabase usage insert failed: ${res.status} ${text.slice(0, 120)}`);
  }
}

export async function resolveFreeUsage(req, body = {}) {
  if (isFreeUsageDisabled()) {
    return {
      allowed: true,
      freeRemaining: 1,
      identityHash: null,
      fingerprint: null,
      ipHash: null,
      enforcement: 'disabled',
    };
  }

  const fingerprint = extractFingerprint(req, body);
  if (!fingerprint) {
    return {
      allowed: false,
      freeRemaining: 0,
      code: 'FINGERPRINT_REQUIRED',
      error: 'לא ניתן לזהות את המכשיר. רענן את הדף ונסה שוב.',
      status: 400,
      enforcement: 'fingerprint',
    };
  }

  const ip = extractClientIp(req);
  const { identityHash, ipHash } = buildIdentityHash(fingerprint, ip);
  const cookieHash = readUsageCookie(req);

  if (cookieHash === identityHash) {
    return {
      allowed: false,
      freeRemaining: 0,
      code: 'FREE_LIMIT_EXCEEDED',
      error: FREE_LIMIT_MESSAGE,
      status: 402,
      identityHash,
      fingerprint,
      ipHash,
      enforcement: 'cookie',
    };
  }

  if (SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const used = await hasStoredUsage(identityHash);
      if (used) {
        return {
          allowed: false,
          freeRemaining: 0,
          code: 'FREE_LIMIT_EXCEEDED',
          error: FREE_LIMIT_MESSAGE,
          status: 402,
          identityHash,
          fingerprint,
          ipHash,
          enforcement: 'supabase',
        };
      }
    } catch (err) {
      console.error('[freeUsage] lookup failed:', err instanceof Error ? err.message : err);
    }
  } else {
    console.warn('[freeUsage] SUPABASE_SERVICE_ROLE_KEY not set — server-side persistence disabled');
  }

  return {
    allowed: true,
    freeRemaining: 1,
    identityHash,
    fingerprint,
    ipHash,
    enforcement: SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'cookie-only',
  };
}

export async function markFreeUsageUsed(req, res, usage) {
  if (isFreeUsageDisabled() || !usage?.identityHash) return;

  setUsageCookie(res, usage.identityHash);

  if (!SUPABASE_SERVICE_ROLE_KEY) return;

  try {
    await storeUsage({
      identityHash: usage.identityHash,
      fingerprint: usage.fingerprint,
      ipHash: usage.ipHash,
    });
  } catch (err) {
    console.error('[freeUsage] store failed:', err instanceof Error ? err.message : err);
  }
}

export function freeLimitResponse(usage) {
  return {
    error: usage.error || FREE_LIMIT_MESSAGE,
    code: usage.code || 'FREE_LIMIT_EXCEEDED',
    freeRemaining: 0,
  };
}
