/** True when user landed from paywall / upgrade redirect. */
export function isPaywallLanding() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('pricing') === '1' || params.get('paywall') === '1';
}
