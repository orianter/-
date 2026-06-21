const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://hgfyokwxcvuufzskvloi.supabase.co').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

export function extractBearerToken(req) {
  const auth = req?.headers?.authorization || req?.headers?.Authorization;
  if (typeof auth !== 'string') return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function getVerifiedEmailFromRequest(req) {
  const token = extractBearerToken(req);
  if (!token || !SUPABASE_SERVICE_ROLE_KEY) return null;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;

  const user = await res.json().catch(() => null);
  const email = user?.email?.trim().toLowerCase();
  return email && email.includes('@') ? email : null;
}
