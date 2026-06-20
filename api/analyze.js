const SUPABASE_URL = 'https://hgfyokwxcvuufzskvloi.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhnZnlva3d4Y3Z1dWZ6c2t2bG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NTQ3NjIsImV4cCI6MjA5NzUzMDc2Mn0.UfJBN82yipuLKfFkxNSbRRj2nvSpwzPILuB5sj_WDCU';

const functionUrl = `${SUPABASE_URL}/functions/v1/analyze`;

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(body));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (!['GET', 'POST'].includes(req.method)) {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const upstream = await fetch(functionUrl, {
      method: req.method,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        ...(req.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      body: req.method === 'POST' ? JSON.stringify(req.body || {}) : undefined,
    });

    const text = await upstream.text();
    res.status(upstream.status).setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : 'Proxy error' });
  }
}
