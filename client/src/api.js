import { getDeviceFingerprint } from './lib/deviceFingerprint';
import { getAccessToken } from './lib/supabaseClient';

const DEFAULT_SUPABASE_URL = 'https://hgfyokwxcvuufzskvloi.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhnZnlva3d4Y3Z1dWZ6c2t2bG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NTQ3NjIsImV4cCI6MjA5NzUzMDc2Mn0.UfJBN82yipuLKfFkxNSbRRj2nvSpwzPILuB5sj_WDCU';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export function analyzeFunctionUrl() {
  return import.meta.env.PROD ? '/api/analyze' : `${supabaseUrl}/functions/v1/analyze`;
}

export async function analyzeHeaders(extra = {}) {
  const fingerprint = await getDeviceFingerprint();
  const headers = {
    'X-Device-Fingerprint': fingerprint,
    ...extra,
  };

  const accessToken = await getAccessToken();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (import.meta.env.PROD) {
    return headers;
  }

  return {
    apikey: supabaseAnonKey,
    Authorization: headers.Authorization || `Bearer ${supabaseAnonKey}`,
    ...headers,
  };
}

/** @deprecated use analyzeHeaders */
export function supabaseHeaders(extra = {}) {
  return extra;
}
