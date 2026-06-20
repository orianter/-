const SUPABASE_URL = 'https://hgfyokwxcvuufzskvloi.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhnZnlva3d4Y3Z1dWZ6c2t2bG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NTQ3NjIsImV4cCI6MjA5NzUzMDc2Mn0.UfJBN82yipuLKfFkxNSbRRj2nvSpwzPILuB5sj_WDCU';

const functionUrl = `${SUPABASE_URL}/functions/v1/analyze`;

const CATEGORY_LABELS = {
  hook: 'פתיחה (Hook)',
  pacing: 'קצב ועריכה',
  message: 'מסר ו-CTA',
  visual: 'ויזואל',
  audio: 'אודיו',
  platformFit: 'התאמה לפלטפורמה',
};

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(body));
}

function clampScore(value, fallback = 6) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const normalized = n > 10 ? n / 10 : n;
  return Math.min(10, Math.max(1, Math.round(normalized)));
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function normalizeTimeline(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      second: Math.max(0, Math.round(Number(item.second ?? item.atSec) || 0)),
      note: String(item.note ?? item.text ?? '').trim(),
    }))
    .filter((item) => item.note)
    .slice(0, 12);
}

function buildCategories(score, sourceCategories) {
  const sourceText = asArray(sourceCategories).join(', ');
  return Object.fromEntries(
    Object.entries(CATEGORY_LABELS).map(([key, label]) => [
      key,
      {
        score,
        label,
        note: sourceText
          ? `הניתוח הדגיש את התחומים: ${sourceText}.`
          : 'נדרש לבדוק את הסרטון בפועל ולחדד את החלק הזה.',
      },
    ]),
  );
}

function normalizeUpstream(data, input) {
  const upperScore = data?.SCORE;
  if (upperScore === undefined && data?.analysis && data.analysis.score > 0) {
    return data;
  }

  const score = clampScore(upperScore ?? data?.analysis?.score);
  const whyItFailed = asArray(data?.['WHY IT FAILED'] ?? data?.analysis?.whyItFailed);
  const whatToChange = asArray(data?.['WHAT TO CHANGE'] ?? data?.analysis?.whatToChange);
  const howToImprove = asArray(data?.['HOW TO IMPROVE'] ?? data?.analysis?.howToImprove);

  return {
    demo: false,
    simplified: true,
    durationSec: Number(input?.durationSec) || Number(data?.durationSec) || 60,
    platform: input?.platform || data?.platform || 'tiktok',
    videoMeta: {
      fileName: input?.fileName || data?.videoMeta?.fileName || '',
      fileType: input?.fileType || data?.videoMeta?.fileType || '',
      fileSizeMb: Number(input?.fileSizeMb) || data?.videoMeta?.fileSizeMb || null,
      width: Number(input?.width) || data?.videoMeta?.width || null,
      height: Number(input?.height) || data?.videoMeta?.height || null,
      isVertical: Number(input?.height) > Number(input?.width),
    },
    transcript: '',
    frameTimestamps: [],
    analysis: {
      score,
      verdict: String(data?.VERDICT || data?.analysis?.verdict || 'הניתוח הושלם.'),
      summary: String(
        data?.analysis?.summary ||
          [...whyItFailed, ...whatToChange].slice(0, 2).join(' ') ||
          'הניתוח הסתיים ומחזיר המלצות בסיסיות לשיפור הסרטון.',
      ),
      categories: buildCategories(score, data?.CATEGORIES ?? data?.analysis?.categories),
      priorityFixes: asArray(data?.['PRIORITY FIXES'] ?? data?.analysis?.priorityFixes).slice(0, 5),
      whyItFailed,
      whatToChange,
      howToImprove,
      hookSuggestion: String(data?.['HOOK SUGGESTION'] || data?.analysis?.hookSuggestion || ''),
      scriptSuggestion: String(data?.['SCRIPT SUGGESTION'] || data?.analysis?.scriptSuggestion || ''),
      platformTips: asArray(data?.['PLATFORM TIPS'] ?? data?.analysis?.platformTips),
      timeline: normalizeTimeline(data?.TIMELINE ?? data?.analysis?.timeline),
    },
  };
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
    if (upstream.ok && req.method === 'POST') {
      const parsed = JSON.parse(text);
      sendJson(res, upstream.status, normalizeUpstream(parsed, req.body || {}));
      return;
    }

    res.status(upstream.status).setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : 'Proxy error' });
  }
}
