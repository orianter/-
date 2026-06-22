import { isCardcomConfigured, verifyPayment } from '../lib/cardcom.js';
import {
  fulfillPaidOrder,
  getCreditsBalance,
  getPaymentOrder,
} from '../lib/credits.js';
import { getVerifiedEmailFromRequest } from '../lib/supabaseAuth.js';
import { hashEmail } from '../lib/freeUsage.js';

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(body));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const orderId = String(req.query?.order || '').trim();
    const email = await getVerifiedEmailFromRequest(req);
    const emailHash = email ? hashEmail(email) : null;

    let order = orderId ? await getPaymentOrder(orderId) : null;

    if (order && emailHash && order.email_hash !== emailHash) {
      sendJson(res, 403, { error: 'הזמנה לא שייכת למשתמש המחובר' });
      return;
    }

    if (order?.status === 'pending' && order.low_profile_id && isCardcomConfigured()) {
      const verified = await verifyPayment(String(order.low_profile_id));
      if (verified.ok && verified.orderId === order.id) {
        order = await fulfillPaidOrder(order);
      }
    }

    const credits = emailHash ? await getCreditsBalance(emailHash) : 0;

    sendJson(res, 200, {
      ok: true,
      orderId: order?.id || orderId || null,
      status: order?.status || 'unknown',
      creditsGranted: order?.credits_granted || null,
      analysisCredits: credits,
      paymentConfigured: isCardcomConfigured(),
    });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : 'Status error' });
  }
}
