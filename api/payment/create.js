import crypto from 'crypto';
import { isCardcomConfigured, createPaymentPage } from '../lib/cardcom.js';
import {
  createPaymentOrder,
  hashEmail,
  updatePaymentOrder,
} from '../lib/credits.js';
import { getPlanLabel, getPlanPrice, normalizePlanId } from '../lib/plans.js';
import { getVerifiedEmailFromRequest } from '../lib/supabaseAuth.js';

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(body));
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (!isCardcomConfigured()) {
    sendJson(res, 503, {
      error: 'תשלום אונליין לא מוגדר עדיין — צור קשר להשלמת הרשמה',
      code: 'PAYMENT_NOT_CONFIGURED',
    });
    return;
  }

  try {
    const email = await getVerifiedEmailFromRequest(req);
    if (!email) {
      sendJson(res, 401, { error: 'יש להתחבר עם Google לפני התשלום', code: 'EMAIL_AUTH_REQUIRED' });
      return;
    }

    const body = parseBody(req);
    const planId = normalizePlanId(body.planId);
    const price = getPlanPrice(planId);
    if (!planId || price == null) {
      sendJson(res, 400, { error: 'מסלול לא תקין' });
      return;
    }

    const emailHash = hashEmail(email);
    const orderId = `ord_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    await createPaymentOrder({
      orderId,
      emailHash,
      planId,
      amountIls: price,
    });

    const { paymentUrl, lowProfileId } = await createPaymentPage({
      orderId,
      amountIls: price,
      productName: getPlanLabel(planId),
    });

    await updatePaymentOrder(orderId, { low_profile_id: String(lowProfileId) });

    sendJson(res, 200, {
      ok: true,
      orderId,
      paymentUrl,
      planId,
      amountIls: price,
    });
  } catch (err) {
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : 'שגיאה ביצירת תשלום',
    });
  }
}
