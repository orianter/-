import { analyzeFunctionUrl, analyzeHeaders } from '../api';

const STORAGE_KEY = 'reel_free_analysis_used';
const PAYMENT_SUCCESS_KEY = 'reel_payment_success';

export function markFreeAnalysisUsed() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* private mode */
  }
}

export function hasUsedFreeAnalysis() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Keep local flag in sync with server usage when available. */
export function syncFreeAnalysisFromApi(apiReady) {
  if (!apiReady || apiReady.demoMode) return;
  if ((apiReady.analysisCredits || 0) > 0) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  if (apiReady.freeRemaining === 0) {
    markFreeAnalysisUsed();
  }
}

export function getAnalysisCredits(apiReady) {
  return Number(apiReady?.analysisCredits) || 0;
}

export function canRunFullAnalysis(apiReady) {
  return getAnalysisCredits(apiReady) > 0;
}

export function isAnalysisBlocked(apiReady) {
  if (!apiReady || apiReady.demoMode) return false;
  if (canRunFullAnalysis(apiReady)) return false;
  if (apiReady.freeRemaining === 1) return false;
  if (apiReady.requiresEmailAuth) return false;
  return apiReady.freeRemaining === 0;
}

export async function fetchAnalysisAccess() {
  const headers = await analyzeHeaders();
  const res = await fetch(analyzeFunctionUrl(), {
    headers,
    credentials: 'include',
  });
  return res.json();
}

export function setPaymentSuccessNotice(credits) {
  try {
    sessionStorage.setItem(PAYMENT_SUCCESS_KEY, JSON.stringify({ credits, at: Date.now() }));
  } catch {
    /* private mode */
  }
}

export function consumePaymentSuccessNotice() {
  try {
    const raw = sessionStorage.getItem(PAYMENT_SUCCESS_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PAYMENT_SUCCESS_KEY);
    const parsed = JSON.parse(raw);
    if (!parsed?.credits) return null;
    if (Date.now() - (parsed.at || 0) > 10 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}
