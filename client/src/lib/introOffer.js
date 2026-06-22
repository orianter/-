const STORAGE_KEY = 'reel_intro_offer_expires';
const OFFER_DURATION_MS = 48 * 60 * 60 * 1000;

export const INTRO_OFFER = {
  discountPercent: 30,
  planId: 'monthly',
  durationMs: OFFER_DURATION_MS,
};

export function activateIntroOffer() {
  const expiresAt = Date.now() + OFFER_DURATION_MS;
  try {
    localStorage.setItem(STORAGE_KEY, String(expiresAt));
  } catch {
    /* private mode */
  }
  return expiresAt;
}

export function getIntroOffer() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const expiresAt = Number(raw);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { ...INTRO_OFFER, expiresAt, active: true };
  } catch {
    return null;
  }
}

export function getDiscountedPrice(originalPrice, discountPercent = INTRO_OFFER.discountPercent) {
  return Math.round(originalPrice * (1 - discountPercent / 100));
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatOfferCountdown(expiresAt) {
  return formatOfferCountdownLive(expiresAt);
}

/** Live countdown with seconds — updates every second in UI. */
export function formatOfferCountdownLive(expiresAt) {
  const ms = Math.max(0, expiresAt - Date.now());
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((ms % (60 * 1000)) / 1000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days} ימים, ${pad2(remHours)}:${pad2(minutes)}:${pad2(seconds)}`;
  }
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}
