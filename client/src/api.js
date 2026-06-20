const DEFAULT_SUPABASE_URL = 'https://hgfyokwxcvuufzskvloi.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhnZnlva3d4Y3Z1dWZ6c2t2bG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NTQ3NjIsImV4cCI6MjA5NzUzMDc2Mn0.UfJBN82yipuLKfFkxNSbRRj2nvSpwzPILuB5sj_WDCU';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export function analyzeFunctionUrl() {
  return supabaseUrl ? `${supabaseUrl}/functions/v1/analyze` : '';
}

export function supabaseHeaders(extra = {}) {
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    ...extra,
  };
}
