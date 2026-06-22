/** Plan IDs must match client/src/data/content.js PRICING_PLANS */

export const PLAN_PRICES_ILS = {
  single: 9,
  monthly: 79,
  pro: 179,
  'monthly-annual': 690,
  'pro-annual': 1590,
};

export const PLAN_CREDITS = {
  single: 1,
  monthly: 30,
  pro: 200,
  'monthly-annual': 360,
  'pro-annual': 2400,
};

export const PLAN_LABELS = {
  single: 'ניתוח בודד',
  monthly: 'מסלול חודשי',
  pro: 'PRO',
  'monthly-annual': 'מסלול חודשי שנתי',
  'pro-annual': 'PRO שנתי',
};

export function normalizePlanId(planId) {
  const id = String(planId || '').trim();
  return PLAN_PRICES_ILS[id] != null ? id : null;
}

export function getPlanPrice(planId) {
  const id = normalizePlanId(planId);
  if (!id) return null;
  return PLAN_PRICES_ILS[id];
}

export function getPlanCredits(planId) {
  const id = normalizePlanId(planId);
  if (!id) return null;
  return PLAN_CREDITS[id];
}

export function getPlanLabel(planId) {
  const id = normalizePlanId(planId);
  return id ? (PLAN_LABELS[id] || id) : 'Reel Analyzer';
}
