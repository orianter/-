import { hashEmail } from './freeUsage.js';
import { getPlanCredits, getPlanLabel } from './plans.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://hgfyokwxcvuufzskvloi.supabase.co').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

async function supabaseFetch(path, options = {}) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  }
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...(options.headers || {}),
    },
  });
}

export async function getCreditsBalance(emailHash) {
  if (!SUPABASE_SERVICE_ROLE_KEY || !emailHash) return 0;
  try {
    const res = await supabaseFetch(
      `analysis_credits?email_hash=eq.${encodeURIComponent(emailHash)}&select=credits_balance&limit=1`,
      { method: 'GET' },
    );
    if (res.status === 404 || !res.ok) return 0;
    const rows = await res.json();
    const balance = Number(rows?.[0]?.credits_balance);
    return Number.isFinite(balance) && balance > 0 ? balance : 0;
  } catch (err) {
    console.warn('[credits] balance lookup failed:', err instanceof Error ? err.message : err);
    return 0;
  }
}

export async function grantCredits(emailHash, credits, planId) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  }
  const add = Math.max(0, Math.floor(Number(credits) || 0));
  if (!emailHash || !add) return 0;

  const current = await getCreditsBalance(emailHash);
  const next = current + add;
  const payload = {
    email_hash: emailHash,
    credits_balance: next,
    plan_id: planId || null,
    updated_at: new Date().toISOString(),
  };

  const res = await supabaseFetch('analysis_credits', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([payload]),
  });

  if (!res.ok) {
    const patchRes = await supabaseFetch(
      `analysis_credits?email_hash=eq.${encodeURIComponent(emailHash)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({
          credits_balance: next,
          plan_id: planId || null,
          updated_at: payload.updated_at,
        }),
      },
    );
    if (!patchRes.ok) {
      const text = await patchRes.text();
      throw new Error(`grantCredits failed: ${patchRes.status} ${text.slice(0, 120)}`);
    }
  }

  return next;
}

export async function deductCredit(emailHash) {
  if (!SUPABASE_SERVICE_ROLE_KEY || !emailHash) {
    throw new Error('Cannot deduct credits');
  }
  const balance = await getCreditsBalance(emailHash);
  if (balance < 1) {
    throw new Error('אין יתרת ניתוחים');
  }
  const next = balance - 1;
  const res = await supabaseFetch(
    `analysis_credits?email_hash=eq.${encodeURIComponent(emailHash)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        credits_balance: next,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`deductCredit failed: ${res.status} ${text.slice(0, 120)}`);
  }
  return next;
}

export async function createPaymentOrder({ orderId, emailHash, planId, amountIls }) {
  const res = await supabaseFetch('payment_orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify([{
      id: orderId,
      email_hash: emailHash,
      plan_id: planId,
      amount_ils: amountIls,
      status: 'pending',
      created_at: new Date().toISOString(),
    }]),
  });
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    throw new Error(`createPaymentOrder failed: ${res.status} ${text.slice(0, 120)}`);
  }
}

export async function updatePaymentOrder(orderId, patch) {
  const res = await supabaseFetch(
    `payment_orders?id=eq.${encodeURIComponent(orderId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`updatePaymentOrder failed: ${res.status} ${text.slice(0, 120)}`);
  }
  const rows = await res.json();
  return rows?.[0] || null;
}

export async function getPaymentOrder(orderId) {
  const res = await supabaseFetch(
    `payment_orders?id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`,
    { method: 'GET' },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] || null;
}

export async function fulfillPaidOrder(order) {
  if (!order || order.status === 'paid') return order;
  const credits = getPlanCredits(order.plan_id);
  if (!credits) throw new Error('Invalid plan on order');
  const balance = await grantCredits(order.email_hash, credits, order.plan_id);
  return updatePaymentOrder(order.id, {
    status: 'paid',
    paid_at: new Date().toISOString(),
    credits_granted: credits,
  });
}

export { hashEmail, getPlanLabel };
