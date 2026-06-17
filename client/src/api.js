// בפיתוח: ריק = משתמש ב-proxy של Vite (/api → localhost:3001)
// בפרודקשן: כתובת השרת מ-Render, למשל https://reel-analyzer-xxxx.onrender.com
const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function apiUrl(path) {
  return `${base}${path}`;
}
