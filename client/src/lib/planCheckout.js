import { analyzeHeaders } from '../api';
import { getIntroOffer, getDiscountedPrice } from './introOffer';
import { CONTACT, PRICING_PLANS } from '../data/content';

export function getPlanById(planId) {
  return PRICING_PLANS.find((p) => p.id === planId);
}

export function getPlanDisplayPrice(plan, introOffer) {
  if (introOffer?.active && plan.id === introOffer.planId) {
    return getDiscountedPrice(plan.price, introOffer.discountPercent);
  }
  return plan.price;
}

export function buildContactMessage(plan, displayPrice, introOffer) {
  const discountNote =
    introOffer?.active && plan.id === introOffer.planId
      ? ` (הנחת מבוא ${introOffer.discountPercent}%)`
      : '';
  return `שלום, אני רוצה להירשם ל"${plan.name}" — ₪${displayPrice}${discountNote}.`;
}

export function openContactFallback(plan, displayPrice, introOffer) {
  const message = buildContactMessage(plan, displayPrice, introOffer);
  const subject = encodeURIComponent(`Reel Analyzer — ${plan.name}`);
  const body = encodeURIComponent(message);

  if (CONTACT?.whatsapp) {
    window.open(
      `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    );
    return;
  }
  if (CONTACT?.email) {
    window.location.href = `mailto:${CONTACT.email}?subject=${subject}&body=${body}`;
    return;
  }
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

export async function startOnlineCheckout(planId) {
  const headers = await analyzeHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch('/api/payment/create', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ planId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'שגיאה ביצירת תשלום');
  }
  if (!data.paymentUrl) {
    throw new Error('לא התקבל קישור תשלום');
  }
  return data;
}

export async function startCheckout(planId, { introOffer, openModal } = {}) {
  const plan = getPlanById(planId);
  if (!plan) return;

  const offer = introOffer ?? getIntroOffer();
  const displayPrice = getPlanDisplayPrice(plan, offer);

  if (openModal) {
    openModal({ plan, displayPrice, introOffer: offer });
    return;
  }

  try {
    const payment = await startOnlineCheckout(plan.id);
    window.location.href = payment.paymentUrl;
  } catch {
    openContactFallback(plan, displayPrice, offer);
  }
}

export function shouldShowFreeCta(options = {}) {
  const freeUsed = options.freeUsed ?? false;
  const paywall = options.paywall ?? false;
  const hasCredits = (options.analysisCredits || 0) > 0;
  return !freeUsed && !paywall && !hasCredits;
}

export function getPlanCta(plan, options = {}) {
  const freeUsed = options.freeUsed ?? false;
  const paywall = options.paywall ?? false;
  const hasCredits = (options.analysisCredits || 0) > 0;
  const introOffer = options.introOffer ?? getIntroOffer();
  const hasDiscount = introOffer?.active && plan.id === introOffer.planId;
  const displayPrice = getPlanDisplayPrice(plan, introOffer);

  if (!freeUsed && !paywall && !hasCredits && plan.billing === 'once') {
    return { type: 'free', label: 'תצוגה מקדימה ←', href: '/analyze' };
  }

  if (hasDiscount) {
    return { type: 'checkout', label: `קבל את ההנחה — ₪${displayPrice} ←`, planId: plan.id };
  }

  return { type: 'checkout', label: 'התחל עכשיו ←', planId: plan.id };
}
