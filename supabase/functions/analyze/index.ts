import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  reels: 'Instagram Reels',
  both: 'TikTok ו-Reels',
};

const CATEGORY_LABELS: Record<string, string> = {
  hook: 'פתיחה (Hook)',
  pacing: 'קצב ועריכה',
  message: 'מסר ו-CTA',
  visual: 'ויזואל',
  audio: 'אודיו',
  platformFit: 'התאמה לפלטפורמה',
};

const CATEGORY_KEYS = ['hook', 'pacing', 'message', 'visual', 'audio', 'platformFit'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function clampScore(value: unknown, fallback = 5) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(10, Math.max(1, Math.round(n)));
}

function asText(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asArray(value: unknown, max = 8) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim())
    .slice(0, max);
}

function parseModelJson(content: string) {
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

function normalizePlatform(platform: unknown) {
  return ['tiktok', 'reels', 'both'].includes(String(platform)) ? String(platform) : 'tiktok';
}

function normalizeAnalysis(raw: unknown) {
  const a = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const rawCategories = a.categories && typeof a.categories === 'object'
    ? a.categories as Record<string, unknown>
    : {};

  const categories: Record<string, { score: number; label: string; note: string }> = {};
  for (const key of CATEGORY_KEYS) {
    const c = rawCategories[key] && typeof rawCategories[key] === 'object'
      ? rawCategories[key] as Record<string, unknown>
      : {};
    categories[key] = {
      score: clampScore(c.score),
      label: asText(c.label, CATEGORY_LABELS[key]),
      note: asText(c.note, '—'),
    };
  }

  const averageScore = Math.round(
    CATEGORY_KEYS.reduce((sum, key) => sum + categories[key].score, 0) / CATEGORY_KEYS.length,
  );

  const timeline = Array.isArray(a.timeline)
    ? a.timeline
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const t = item as Record<string, unknown>;
        return {
          second: Math.max(0, Math.round(Number(t.second) || 0)),
          note: asText(t.note),
        };
      })
      .filter((item) => item.note)
      .slice(0, 12)
    : [];

  return {
    score: clampScore(a.score, averageScore),
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

function buildPrompt(input: Record<string, unknown>) {
  const platform = normalizePlatform(input.platform);
  const platformLabel = PLATFORM_LABELS[platform] || PLATFORM_LABELS.tiktok;
  const goal = asText(input.goal, 'לא צוין').slice(0, 300);
  const problem = asText(input.problem, 'לא צוין').slice(0, 500);
  const fileName = asText(input.fileName, 'לא צוין');
  const fileType = asText(input.fileType, 'לא צוין');
  const fileSizeMb = Number(input.fileSizeMb);
  const durationSec = Number(input.durationSec);
  const width = Number(input.width);
  const height = Number(input.height);

  return `אתה מומחה בכיר לתוכן ויראלי קצר ב-${platformLabel}.
נתח את הסרטון לפי הפרטים שהמשתמש הזין. אין לך גישה לפריימים או לתמלול, לכן אל תמציא פרטים ויזואליים ספציפיים שלא נמסרו.
תן משוב בעברית, ביקורתי אך בונה, ספציפי ופרקטי.

## פרטים זמינים
- פלטפורמה: ${platformLabel}
- מטרת היוצר: ${goal}
- מה לא עבד לדעת היוצר: ${problem}
- שם קובץ: ${fileName}
- סוג קובץ: ${fileType}
- גודל קובץ: ${Number.isFinite(fileSizeMb) ? fileSizeMb.toFixed(1) + 'MB' : 'לא זוהה'}
- אורך משוער: ${Number.isFinite(durationSec) ? durationSec.toFixed(1) + ' שניות' : 'לא זוהה'}
- מידות: ${Number.isFinite(width) && Number.isFinite(height) ? `${width}×${height}` : 'לא זוהה'}

## הנחיות
- אם חסר מידע, ציין מה כדאי לבדוק בסרטון במקום להמציא.
- התמקד ב-Hook, מסר, CTA, קצב, התאמה לפלטפורמה, והצעות שיפור.
- החזר JSON בלבד, בלי markdown.

מבנה JSON מדויק:
{
  "score": <1-10>,
  "verdict": "<משפט אחד>",
  "summary": "<2-3 משפטים>",
  "categories": {
    "hook": { "score": <1-10>, "label": "פתיחה (Hook)", "note": "<משפט>" },
    "pacing": { "score": <1-10>, "label": "קצב ועריכה", "note": "<משפט>" },
    "message": { "score": <1-10>, "label": "מסר ו-CTA", "note": "<משפט>" },
    "visual": { "score": <1-10>, "label": "ויזואל", "note": "<משפט>" },
    "audio": { "score": <1-10>, "label": "אודיו", "note": "<משפט>" },
    "platformFit": { "score": <1-10>, "label": "התאמה לפלטפורמה", "note": "<משפט>" }
  },
  "priorityFixes": ["<#1>", "<#2>", "<#3>"],
  "whyItFailed": ["<סיבה אפשרית>"],
  "whatToChange": ["<שינוי קונקרטי>"],
  "howToImprove": ["<המלצה>"],
  "hookSuggestion": "<פתיחה חלופית>",
  "scriptSuggestion": "<תסריט/outline משופר>",
  "platformTips": ["<טיפ>"],
  "timeline": [{ "second": <number>, "note": "<מה לבדוק/לשנות ברגע הזה>" }]
}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY')?.trim();

  if (req.method === 'GET') {
    return json({
      ok: true,
      hasApiKey: Boolean(apiKey),
      demoMode: false,
      maxDurationSec: 60,
      maxFileMb: 100,
      service: 'supabase-edge-analyze',
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!apiKey) {
    return json({ error: 'OPENAI_API_KEY לא מוגדר ב-Supabase Secrets' }, 500);
  }

  try {
    const input = await req.json();
    const platform = normalizePlatform(input.platform);
    const durationSec = Math.round((Number(input.durationSec) || 60) * 10) / 10;
    if (durationSec > 65) {
      return json({ error: 'הסרטון ארוך מדי. המקסימום הוא דקה אחת.' }, 400);
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'אתה אנליסט תוכן ויראלי מקצועי. עונה תמיד בעברית. החזר JSON תקין בלבד.',
          },
          { role: 'user', content: buildPrompt(input) },
        ],
        max_tokens: 2500,
        temperature: 0.4,
      }),
    });

    const openaiJson = await openaiResponse.json();
    if (!openaiResponse.ok) {
      throw new Error(openaiJson?.error?.message || 'שגיאה בקריאה ל-OpenAI');
    }

    const content = openaiJson.choices?.[0]?.message?.content;
    if (!content) throw new Error('לא התקבלה תשובה מ-OpenAI');

    return json({
      demo: false,
      simplified: true,
      durationSec,
      platform,
      videoMeta: {
        fileName: asText(input.fileName),
        fileType: asText(input.fileType),
        fileSizeMb: Number(input.fileSizeMb) || null,
        width: Number(input.width) || null,
        height: Number(input.height) || null,
        isVertical: Number(input.height) > Number(input.width),
      },
      transcript: '',
      frameTimestamps: [],
      analysis: normalizeAnalysis(parseModelJson(content)),
    });
  } catch (err) {
    console.error('Analyze function error:', err);
    return json({ error: err instanceof Error ? err.message : 'שגיאה בניתוח' }, 500);
  }
});
