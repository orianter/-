import crypto from 'crypto';
import { getVerifiedEmailFromRequest } from './supabaseAuth.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://hgfyokwxcvuufzskvloi.supabase.co').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
const COOKIE_NAME = 'ra_free_used';
const FINGERPRINT_HEADER = 'x-device-fingerprint';
const FREE_LIMIT_MESSAGE = 'הניתוח החינמי כבר נוצל — בחר מסלול';
const EMAIL_LIMIT_MESSAGE = 'כבר ניצלת את הניתוח החינמי עם כתובת האימייל הזו — בחר מסלול';
const EMAIL_AUTH_REQUIRED_MESSAGE = 'יש לאמת אימייל לפני הניתוח החינמי';
const EMAIL_SERVICE_MESSAGE = 'שירות האימות לא מוגדר — נסה שוב מאוחר יותר';

export {
  FREE_LIMIT_MESSAGE,
  EMAIL_LIMIT_MESSAGE,
  EMAIL_AUTH_REQUIRED_MESSAGE,
  EMAIL_SERVICE_MESSAGE,
};

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

export function hashEmail(email) {
  return crypto.createHash('sha256').update(`${getSecret()}|email|${email.toLowerCase().trim()}`).digest('hex');
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

export async function hasEmailUsage(emailHash) {
  if (!SUPABASE_SERVICE_ROLE_KEY) return false;
  const res = await supabaseFetch(
    `free_analysis_email_usage?email_hash=eq.${encodeURIComponent(emailHash)}&select=email_hash&limit=1`,
    { method: 'GET' },
  );
  if (res.status === 404) return false;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase email usage lookup failed: ${res.status} ${text.slice(0, 120)}`);
  }
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

export async function storeEmailUsage(emailHash) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  }
  const res = await supabaseFetch('free_analysis_email_usage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify([{
      email_hash: emailHash,
      used_at: new Date().toISOString(),
    }]),
  });
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    throw new Error(`Supabase email usage insert failed: ${res.status} ${text.slice(0, 120)}`);
  }
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

async function resolveEmailUsage(req, { requireAuth = true } = {}) {
  const email = await getVerifiedEmailFromRequest(req);
  if (!email) {
    if (!requireAuth) {
      return {
        allowed: false,
        freeRemaining: 0,
        requiresEmailAuth: true,
        code: 'EMAIL_AUTH_REQUIRED',
        enforcement: 'email',
      };
    }
    return {
      allowed: false,
      freeRemaining: 0,
      requiresEmailAuth: true,
      code: 'EMAIL_AUTH_REQUIRED',
      error: EMAIL_AUTH_REQUIRED_MESSAGE,
      status: 401,
      enforcement: 'email',
    };
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[freeUsage] SUPABASE_SERVICE_ROLE_KEY not set — email usage tracking disabled');
    if (requireAuth) {
      return {
        allowed: false,
        freeRemaining: 0,
        code: 'SERVICE_CONFIG',
        error: EMAIL_SERVICE_MESSAGE,
        status: 503,
        email,
        enforcement: 'email',
      };
    }
    return {
      allowed: true,
      freeRemaining: 1,
      email,
      emailHash: hashEmail(email),
      enforcement: 'email-untracked',
    };
  }

  const emailHash = hashEmail(email);
  try {
    const used = await hasEmailUsage(emailHash);
    if (used) {
      return {
        allowed: false,
        freeRemaining: 0,
        code: 'EMAIL_LIMIT_EXCEEDED',
        error: EMAIL_LIMIT_MESSAGE,
        status: 402,
        email,
        emailHash,
        enforcement: 'email',
      };
    }
  } catch (err) {
    console.error('[freeUsage] email lookup failed:', err instanceof Error ? err.message : err);
    if (requireAuth) {
      return {
        allowed: false,
        freeRemaining: 0,
        code: 'SERVICE_ERROR',
        error: EMAIL_SERVICE_MESSAGE,
        status: 503,
        email,
        emailHash,
        enforcement: 'email',
      };
    }
  }

  return {
    allowed: true,
    freeRemaining: 1,
    email,
    emailHash,
    enforcement: 'email',
  };
}

export async function resolveFreeUsage(req, body = {}, options = {}) {
  const { requireAuth = true } = options;
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

  return resolveEmailUsage(req, { requireAuth });
}

export async function markFreeUsageUsed(req, res, usage) {
  if (isFreeUsageDisabled()) return;
  if (!usage?.emailHash) return;
  if (!SUPABASE_SERVICE_ROLE_KEY) return;

  try {
    await storeEmailUsage(usage.emailHash);
  } catch (err) {
    console.error('[freeUsage] email store failed:', err instanceof Error ? err.message : err);
  }
}

export function freeLimitResponse(usage) {
  return {
    error: usage.error || FREE_LIMIT_MESSAGE,
    code: usage.code || 'FREE_LIMIT_EXCEEDED',
    freeRemaining: 0,
    requiresEmailAuth: Boolean(usage.requiresEmailAuth),
  };
}
