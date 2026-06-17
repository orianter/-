import { randomBytes } from 'crypto';

const orders = new Map();

const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export function createOrder({ videoPath, platform, goal, problem }) {
  const id = `ord_${Date.now()}_${randomBytes(4).toString('hex')}`;
  const order = {
    id,
    status: 'pending',
    videoPath,
    platform,
    goal,
    problem,
    lowProfileId: null,
    transactionId: null,
    analyzed: false,
    result: null,
    error: null,
    createdAt: Date.now(),
  };
  orders.set(id, order);
  return order;
}

export function getOrder(id) {
  const order = orders.get(id);
  if (!order) return null;
  if (Date.now() - order.createdAt > TTL_MS) {
    orders.delete(id);
    return null;
  }
  return order;
}

export function setLowProfileId(orderId, lowProfileId) {
  const order = orders.get(orderId);
  if (!order) return null;
  order.lowProfileId = lowProfileId;
  return order;
}

export function markOrderPaid(orderId, { lowProfileId, transactionId }) {
  const order = orders.get(orderId);
  if (!order) return null;
  order.status = 'paid';
  order.lowProfileId = lowProfileId || order.lowProfileId;
  order.transactionId = transactionId;
  order.paidAt = Date.now();
  return order;
}

export function setOrderResult(orderId, result) {
  const order = orders.get(orderId);
  if (!order) return null;
  order.analyzed = true;
  order.result = result;
  order.status = 'completed';
  return order;
}

export function setOrderError(orderId, error) {
  const order = orders.get(orderId);
  if (!order) return null;
  order.error = error;
  order.status = 'error';
  return order;
}
