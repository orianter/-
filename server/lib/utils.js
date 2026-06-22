// Pure, dependency-free helpers — safe to unit test and reuse on client/server.

export const PLATFORM_LABELS = {
  tiktok: 'TikTok',
  reels: 'Instagram Reels',
  both: 'TikTok ו-Reels',
};

export const VALID_PLATFORMS = ['tiktok', 'reels', 'both'];

export const MAX_DURATION_SEC = 125;

export const CATEGORY_KEYS = ['hook', 'pacing', 'message', 'visual', 'audio', 'platformFit'];

export const CATEGORY_LABELS = {
  hook: 'פתיחה (Hook)',
  pacing: 'קצב ועריכה',
  message: 'מסר ו-CTA',
  visual: 'ויזואל',
  audio: 'אודיו',
  platformFit: 'התאמה לפלטפורמה',
};

export function normalizePlatform(platform) {
  return VALID_PLATFORMS.includes(platform) ? platform : 'tiktok';
}

export function clampScore(value, fallback = 5) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(10, Math.max(1, Math.round(n)));
}

// Choose which timestamps to sample for visual analysis, weighted toward the hook.
export function buildFrameTimestamps(durationSec) {
  const d = Math.min(Math.max(durationSec || 0, 0), 120);
  const points = new Set([0, 0.5, 1, 2, 3, 5]);

  if (d > 8) points.add(Math.round(d * 0.2));
  if (d > 10) points.add(Math.round(d * 0.4));
  if (d > 14) points.add(Math.round(d * 0.6));
  if (d > 60) points.add(Math.round(d * 0.7));
  if (d > 90) points.add(Math.round(d * 0.85));
  if (d > 4) points.add(Math.max(0, Math.round(d - 2)));

  return [...points]
    .filter((t) => t >= 0 && t <= d)
    .sort((a, b) => a - b)
    .slice(0, 10);
}

export function formatTranscript(transcription) {
  if (!transcription || !transcription.segments?.length) {
    return transcription?.text || '(ללא דיבור מזוהה)';
  }
  return transcription.segments
    .map((s) => `[${Number(s.start).toFixed(1)}s–${Number(s.end).toFixed(1)}s] ${String(s.text).trim()}`)
    .join('\n');
}

export function formatVideoMeta(meta) {
  const parts = [];
  if (meta?.width && meta?.height) {
    parts.push(`${meta.width}×${meta.height}`);
    parts.push(meta.isVertical ? 'אנכי (9:16)' : 'אופקי — לא אידיאלי לרילס');
  }
  return parts.join(' · ') || 'לא זוהה';
}

function asArray(value, max = 8) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim())
    .slice(0, max);
}

function asText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

// Defensive normalization of whatever the model returns, so the UI never crashes.
export function normalizeAnalysis(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};

  const categories = {};
  const rawCats = a.categories && typeof a.categories === 'object' ? a.categories : {};
  for (const key of CATEGORY_KEYS) {
    const c = rawCats[key] && typeof rawCats[key] === 'object' ? rawCats[key] : {};
    categories[key] = {
      score: clampScore(c.score),
      label: asText(c.label, CATEGORY_LABELS[key]),
      note: asText(c.note, '—'),
    };
  }

  const timeline = Array.isArray(a.timeline)
    ? a.timeline
        .filter((t) => t && typeof t === 'object')
        .map((t) => ({
          second: Math.max(0, Math.round(Number(t.second) || 0)),
          note: asText(t.note),
        }))
        .filter((t) => t.note)
        .slice(0, 12)
    : [];

  // Prefer the model's overall score; otherwise average the categories.
  const categoryAvg = Math.round(
    CATEGORY_KEYS.reduce((sum, k) => sum + categories[k].score, 0) / CATEGORY_KEYS.length
  );

  return {
    score: clampScore(a.score, categoryAvg),
    verdict: asText(a.verdict),
    summary: asText(a.summary, 'הניתוח הושלם.'),
    categories,
    priorityFixes: asArray(a.priorityFixes, 5),
    whyItFailed: asArray(a.whyItFailed),
    whatToChange: asArray(a.whatToChange),
    howToImprove: asArray(a.howToImprove),
    hookSuggestion: asText(a.hookSuggestion),
    scriptSuggestion: asText(a.scriptSuggestion),
    platformTips: asArray(a.platformTips),
    timeline,
  };
}

// Tolerant JSON extraction — strips markdown fences / surrounding prose if present.
export function parseModelJson(content) {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('לא התקבלה תשובה מהמודל');
  }
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(content.slice(start, end + 1));
    }
    throw new Error('תשובת המודל אינה JSON תקין');
  }
}
