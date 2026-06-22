import { getCreditsBalance } from './credits.js';
import {
  EMAIL_AUTH_REQUIRED_MESSAGE,
  EMAIL_LIMIT_MESSAGE,
  EMAIL_SERVICE_MESSAGE,
  FREE_LIMIT_MESSAGE,
  hasEmailUsage,
  hashEmail,
  isFreeUsageDisabled,
} from './freeUsage.js';
import { getVerifiedEmailFromRequest } from './supabaseAuth.js';

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

export async function resolveAnalysisAccess(req, { requireAuth = false } = {}) {
  if (isFreeUsageDisabled()) {
    return {
      allowed: true,
      mode: 'full',
      credits: 999,
      freeRemaining: 0,
      teaserAvailable: false,
      enforcement: 'disabled',
    };
  }

  const email = await getVerifiedEmailFromRequest(req);
  if (!email) {
    if (!requireAuth) {
      return {
        allowed: false,
        mode: 'auth_required',
        credits: 0,
        freeRemaining: 0,
        teaserAvailable: false,
        requiresEmailAuth: true,
        code: 'EMAIL_AUTH_REQUIRED',
        enforcement: 'email',
      };
    }
    return {
      allowed: false,
      mode: 'auth_required',
      credits: 0,
      freeRemaining: 0,
      teaserAvailable: false,
      requiresEmailAuth: true,
      code: 'EMAIL_AUTH_REQUIRED',
      error: EMAIL_AUTH_REQUIRED_MESSAGE,
      status: 401,
      enforcement: 'email',
    };
  }

  const emailHash = hashEmail(email);

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    if (requireAuth) {
      return {
        allowed: false,
        mode: 'service_error',
        credits: 0,
        freeRemaining: 0,
        teaserAvailable: false,
        code: 'SERVICE_CONFIG',
        error: EMAIL_SERVICE_MESSAGE,
        status: 503,
        email,
        emailHash,
        enforcement: 'email',
      };
    }
    return {
      allowed: true,
      mode: 'teaser',
      isTeaser: true,
      credits: 0,
      freeRemaining: 1,
      teaserAvailable: true,
      email,
      emailHash,
      enforcement: 'email-untracked',
    };
  }

  let credits = 0;
  try {
    credits = await getCreditsBalance(emailHash);
  } catch (err) {
    console.error('[access] credits lookup failed:', err instanceof Error ? err.message : err);
    if (requireAuth) {
      return {
        allowed: false,
        mode: 'service_error',
        credits: 0,
        freeRemaining: 0,
        teaserAvailable: false,
        code: 'SERVICE_ERROR',
        error: EMAIL_SERVICE_MESSAGE,
        status: 503,
        email,
        emailHash,
        enforcement: 'email',
      };
    }
  }

  if (credits > 0) {
    return {
      allowed: true,
      mode: 'full',
      isTeaser: false,
      credits,
      freeRemaining: 0,
      teaserAvailable: false,
      email,
      emailHash,
      enforcement: 'credits',
    };
  }

  try {
    const teaserUsed = await hasEmailUsage(emailHash);
    if (!teaserUsed) {
      return {
        allowed: true,
        mode: 'teaser',
        isTeaser: true,
        credits: 0,
        freeRemaining: 1,
        teaserAvailable: true,
        email,
        emailHash,
        enforcement: 'email',
      };
    }
  } catch (err) {
    console.error('[access] teaser lookup failed:', err instanceof Error ? err.message : err);
    if (requireAuth) {
      return {
        allowed: false,
        mode: 'service_error',
        credits: 0,
        freeRemaining: 0,
        teaserAvailable: false,
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
    allowed: false,
    mode: 'paywall',
    isTeaser: false,
    credits: 0,
    freeRemaining: 0,
    teaserAvailable: false,
    code: 'EMAIL_LIMIT_EXCEEDED',
    error: EMAIL_LIMIT_MESSAGE,
    status: 402,
    email,
    emailHash,
    enforcement: 'email',
  };
}

export function accessLimitResponse(access) {
  return {
    error: access.error || FREE_LIMIT_MESSAGE,
    code: access.code || 'FREE_LIMIT_EXCEEDED',
    freeRemaining: 0,
    analysisCredits: access.credits || 0,
    requiresEmailAuth: Boolean(access.requiresEmailAuth),
  };
}

export function accessHealthExtras(access) {
  return {
    freeRemaining: access.teaserAvailable ? 1 : 0,
    analysisCredits: access.credits || 0,
    canAnalyzeFull: (access.credits || 0) > 0,
    teaserAvailable: Boolean(access.teaserAvailable),
    requiresEmailAuth: Boolean(access.requiresEmailAuth),
    ...(access.email ? { verifiedEmail: true } : {}),
  };
}
