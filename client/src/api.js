// בפיתוח: ריק = משתמש ב-proxy של Vite (/api → localhost:3001)
// בפרודקשן: כתובת השרת מ-Render (VITE_API_URL או ברירת מחדל)
const PROD_API = 'https://reel-analyzer-9ggt.onrender.com';
const base = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? PROD_API : '')).replace(/\/$/, '');

export function apiUrl(path) {
  return `${base}${path}`;
}
