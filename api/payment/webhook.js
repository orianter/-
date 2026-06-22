import { verifyPayment } from '../lib/cardcom.js';
import {
  fulfillPaidOrder,
  getPaymentOrder,
  updatePaymentOrder,
} from '../lib/credits.js';

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
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = parseBody(req);
    const lowProfileId = body.LowProfileId || body.lowProfileId || body.LowProfileID;
    const returnValue = body.ReturnValue || body.returnValue;

    let order = returnValue ? await getPaymentOrder(String(returnValue)) : null;

    if (lowProfileId) {
      const verified = await verifyPayment(String(lowProfileId));
      if (verified.orderId && !order) {
        order = await getPaymentOrder(String(verified.orderId));
      }
      if (order && verified.ok) {
        await updatePaymentOrder(order.id, {
          transaction_id: verified.transactionId ? String(verified.transactionId) : null,
        });
        order = await fulfillPaidOrder(order);
        sendJson(res, 200, { ok: true, orderId: order?.id, status: order?.status });
        return;
      }
    }

    if (order?.status === 'paid') {
      sendJson(res, 200, { ok: true, orderId: order.id, status: 'paid' });
      return;
    }

    sendJson(res, 400, { ok: false, error: 'לא ניתן לאמת תשלום' });
  } catch (err) {
    console.error('[payment/webhook]', err);
    sendJson(res, 500, { error: err instanceof Error ? err.message : 'Webhook error' });
  }
}
