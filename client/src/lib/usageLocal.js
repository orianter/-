const STORAGE_KEY = 'reel_free_analysis_used';

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
  if (apiReady?.freeRemaining === 0 && !apiReady?.demoMode) {
    markFreeAnalysisUsed();
  }
}
