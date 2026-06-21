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
  const normalized = n > 10 ? n / 10 : n;
  return Math.min(10, Math.max(1, Math.round(normalized)));
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

function formatFrameMetrics(frames: unknown) {
  if (!Array.isArray(frames) || !frames.length) {
    return 'לא התקבלו דגימות פריימים — הניתוח הוויזואלי מוגבל.';
  }

  const lines = frames.map((raw) => {
    const f = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const second = Number(f.second);
    const brightness = Number(f.brightness);
    const contrast = Number(f.contrast);
    const sharpness = Number(f.sharpness);
    const colorfulness = Number(f.colorfulness);
    const sceneChange = Number(f.sceneChange);
    const darkRatio = Number(f.darkRatio);
    const brightRatio = Number(f.brightRatio);

    const flags: string[] = [];
    if (Number.isFinite(second) && second <= 3) flags.push('אזור Hook');
    if (brightness < 70) flags.push('חשוך');
    if (brightness > 195) flags.push('בהיר מדי');
    if (sharpness < 10) flags.push('מטושטש');
    if (sceneChange < 6) flags.push('סטטי');
    if (sceneChange > 40) flags.push('קפיצה חדה');
    if (darkRatio > 35) flags.push('הרבה אזורים כהים');
    if (brightRatio > 20) flags.push('הרבה אזורים שרופים');

    return `- ${Number.isFinite(second) ? second.toFixed(1) : '?'} שנ': בהירות ${Math.round(brightness)}, קונטרסט ${Math.round(contrast)}, חדות ${Math.round(sharpness)}, צבע ${Math.round(colorfulness)}, שינוי סצנה ${Math.round(sceneChange)}%${flags.length ? ` [${flags.join(', ')}]` : ''}`;
  });

  const hookFrames = frames.filter((f) => Number((f as Record<string, unknown>)?.second) <= 3);
  const avgHookChange = hookFrames.length > 1
    ? hookFrames.slice(1).reduce((sum, f) => sum + Number((f as Record<string, unknown>).sceneChange || 0), 0) / (hookFrames.length - 1)
    : null;

  let summary = `\nסיכום מדדים: ${frames.length} פריימים נדגמו מהסרטון האמיתי.`;
  if (avgHookChange !== null && avgHookChange < 7) {
    summary += ' ב-3 השניות הראשונות יש מעט שינוי ויזואלי — סיכון גבוה לגלילה.';
  }

  return lines.join('\n') + summary;
}

function formatAudioMetrics(audio: unknown) {
  const a = audio && typeof audio === 'object' ? audio as Record<string, unknown> : null;
  if (!a?.analyzed) return 'לא ניתן לנתח אודיו מהקובץ — אל תניח מה נאמר, רק המלץ מה לבדוק.';

  const lines = [
    `- יש אודיו: ${a.hasAudio ? 'כן' : 'כמעט לא / שקט'}`,
    `- עוצמה ממוצעת: ${Number(a.avgVolume) || 0}`,
    `- עוצמה ב-3 שניות ראשונות: ${Number(a.hookVolume) || 0}`,
    `- אחוז חלונות שקטים: ${Number(a.silentRatio) || 0}%`,
    `- שקט בפתיחה (0-3 שנ'): ${Number(a.hookSilentRatio) || 0}%`,
  ];
  if (a.openingWeak) lines.push('- ⚠️ האודיו בפתיחה חלש יותר מהממוצע — עלול לפגוע ב-Hook');
  if (a.mostlySilent) lines.push('- ⚠️ הסרטון שקט לרוב — ודא שיש מוזיקה/דיבור/כתוביות');
  if (Number.isFinite(Number(a.loudestAtSec))) lines.push(`- השיא בעוצמה סביב ${Number(a.loudestAtSec)} שניות`);
  return lines.join('\n');
}

function formatAnalysisDigest(digest: unknown) {
  const d = digest && typeof digest === 'object' ? digest as Record<string, unknown> : null;
  if (!d) return '';

  const findings = Array.isArray(d.findings)
    ? d.findings.filter((item) => typeof item === 'string' && item.trim()).join('\n- ')
    : '';

  return [
    `דגימות: ${Number(d.frameCount) || 0} פריימים · אורך ${Number(d.durationSec) || '?'} שנ'`,
    d.aspectRatio ? `יחס גובה/רוחב: ${d.aspectRatio}${d.isVertical916 ? ' (9:16 ✓)' : ''}` : '',
    d.hookSceneChange !== null && d.hookSceneChange !== undefined ? `שינוי ויזואלי ב-Hook: ${d.hookSceneChange}%` : '',
    d.avgSceneChange !== null && d.avgSceneChange !== undefined ? `שינוי ויזואלי ממוצע: ${d.avgSceneChange}%` : '',
    findings ? `ממצאים מחושבים מראש:\n- ${findings}` : '',
  ].filter(Boolean).join('\n');
}

function normalizeFrameImages(images: unknown) {
  if (!Array.isArray(images)) return [];
  return images
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const img = item as Record<string, unknown>;
      const base64 = asText(img.base64);
      if (!base64 || base64.length > 200_000) return null;
      return {
        second: Number(img.second) || 0,
        label: asText(img.label, 'פריים'),
        isHook: Boolean(img.isHook) || Number(img.second) <= 1,
        base64,
      };
    })
    .filter(Boolean)
    .slice(0, 5) as Array<{ second: number; label: string; isHook: boolean; base64: string }>;
}

function buildPrompt(input: Record<string, unknown>, hasVision: boolean) {
  const platform = normalizePlatform(input.platform);
  const platformLabel = PLATFORM_LABELS[platform] || PLATFORM_LABELS.tiktok;
  const goal = asText(input.goal, 'לא צוין').slice(0, 300);
  const problem = asText(input.problem, 'לא צוין').slice(0, 500);
  const audience = asText(input.audience, 'לא צוין').slice(0, 200);
  const contentBrief = asText(input.contentBrief, 'לא צוין').slice(0, 1200);
  const fileName = asText(input.fileName, 'לא צוין');
  const fileType = asText(input.fileType, 'לא צוין');
  const fileSizeMb = Number(input.fileSizeMb);
  const durationSec = Number(input.durationSec);
  const width = Number(input.width);
  const height = Number(input.height);
  const isVertical = Number.isFinite(width) && Number.isFinite(height) ? height > width : null;
  const frameBlock = formatFrameMetrics(input.frameMetrics);
  const audioBlock = formatAudioMetrics(input.audioMetrics);
  const digestBlock = formatAnalysisDigest(input.analysisDigest);

  return `אתה אנליסט בכיר לתוכן ויראלי קצר (${platformLabel}) עם ניסיון של אלפי רילסים.
תפקידך: ניתוח מדויק, ספציפי ופרקטי — לא משפטים גנריים.

## כללי דיוק (חובה)
- התבסס רק על הנתונים, הפריימים והתיאור שקיבלת
- ציין שניות ספציפיות כשאתה מתייחס לבעיה
- אל תמציא תמלול או טקסט — אלא אם רואים בפריים או כתוב ב-contentBrief
- אם חסר מידע — כתוב "לא ניתן לבדוק X"

## מה יש לך
${hasVision
    ? '- יש לך גם תמונות פריים אמיתיות מהסרטון (מצורפות). השתמש בהן לניתוח ויזואלי, Hook, קומפozיציה, טקסט על המסך, תאורה, ופנים/מוצר.'
    : '- אין תמונות, אבל יש מדדי פריימים אמיתיים שנדגמו מהסרטון בדפדפן.'}
- אין לך תמלול אודיו — אל תמציא מה נאמר. אם יש contentBrief, השתמש בו לניתוח מסר.

## הקשר מהיוצר
- פלטפורמה: ${platformLabel}
- קהל יעד: ${audience}
- מטרה: ${goal}
- מה לא עבד (לדעת היוצר): ${problem}
- תיאור התוכן/מה נאמר: ${contentBrief}

## מטא-דאטה טכני
- שם: ${fileName} · סוג: ${fileType}
- גודל: ${Number.isFinite(fileSizeMb) ? fileSizeMb.toFixed(1) + 'MB' : 'לא זוהה'}
- אורך: ${Number.isFinite(durationSec) ? durationSec.toFixed(1) + ' שניות' : 'לא זוהה'}
- מידות: ${Number.isFinite(width) && Number.isFinite(height) ? `${width}×${height}` : 'לא זוהה'}${isVertical === true ? ' (אנכי ✓)' : isVertical === false ? ' (לא אנכי — בעיה לרילס/טיקטוק)' : ''}

## סיכום מדידה אוטומטי
${digestBlock || 'לא התקבל.'}

## מדדי פריימים
${frameBlock}

## מדדי אודיו
${audioBlock}

## כללי ניתוח
1. Hook (0-3 שנ'): האם יש מתח, הבטחה, שאלה, או ניגוד? האם יש שינוי ויזואלי מספיק לפי המדדים?
2. קצב: לפי שינויי סצנה בין פריימים — האם הסרטון סטטי מדי?
3. מסר: לפי contentBrief — האם יש הבטחה ברורה, ערך, ו-CTA אחד?
4. ויזואל: בהירות, חדות, קונטרסט, פורמט אנכי
5. אודיו: לפי מדדי האודיו — שקט/חלש בפתיחה = בעיה
6. התאמה לפלטפורמה: ${platformLabel} — hook מהיר, טקסט בטוח, אורך אידיאלי

## פלט נדרש
- כל המלצה חייבת להיות ספציפית לנתונים שקיבלת
- priorityFixes: 3-5 תיקונים מדורגים לפי השפעה
- hookSuggestion: פתיחה חלופית מותאמת לקהל "${audience !== 'לא צוין' ? audience : 'קהל היעד'}"
- scriptSuggestion: outline מלא לפי ${Number.isFinite(durationSec) ? durationSec.toFixed(0) : '60'} שניות
- timeline: נקודות זמן ספציפיות לפי הפריימים שנדגמו

החזר JSON בלבד, בלי markdown:
{
  "score": <1-10>,
  "verdict": "<משפט אחד חד>",
  "summary": "<2-4 משפטים שמסכמים את הממצאים העיקריים>",
  "categories": {
    "hook": { "score": <1-10>, "label": "פתיחה (Hook)", "note": "<משפט ספציפי>" },
    "pacing": { "score": <1-10>, "label": "קצב ועריכה", "note": "<משפט>" },
    "message": { "score": <1-10>, "label": "מסר ו-CTA", "note": "<משפט>" },
    "visual": { "score": <1-10>, "label": "ויזואל", "note": "<משפט>" },
    "audio": { "score": <1-10>, "label": "אודיו", "note": "<משפט>" },
    "platformFit": { "score": <1-10>, "label": "התאמה לפלטפורמה", "note": "<משפט>" }
  },
  "priorityFixes": ["<#1>", "<#2>", "<#3>"],
  "whyItFailed": ["<סיבה>"],
  "whatToChange": ["<שינוי>"],
  "howToImprove": ["<המלצה>"],
  "hookSuggestion": "<פתיחה חלופית>",
  "scriptSuggestion": "<תסריט/outline>",
  "platformTips": ["<טיפ>"],
  "timeline": [{ "second": <number>, "note": "<מה לשנות>" }]
}`;
}

function buildMessages(input: Record<string, unknown>) {
  const frameImages = normalizeFrameImages(input.frameImages);
  const hasVision = frameImages.length > 0;
  const prompt = buildPrompt(input, hasVision);

  if (!hasVision) {
    return [
      {
        role: 'system',
        content: 'אתה אנליסט תוכן ויראלי מקצועי ברמה הגבוהה ביותר. עונה תמיד בעברית. החזר JSON תקין בלבד.',
      },
      { role: 'user', content: prompt },
    ];
  }

  const content: Array<Record<string, unknown>> = [
    { type: 'text', text: prompt },
    ...frameImages.flatMap((img) => [
      {
        type: 'text',
        text: `[פריים ב-${img.second.toFixed(1)} שניות — ${img.label}]`,
      },
      {
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${img.base64}`,
          detail: img.isHook ? 'high' : 'low',
        },
      },
    ]),
  ];

  return [
    {
      role: 'system',
      content: 'אתה אנליסט תוכן ויראלי מקצועי עם יכולת ראייה. נתח את הפריימים האמיתיים מהסרטון. עונה בעברית. JSON בלבד.',
    },
    { role: 'user', content },
  ];
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
      model: 'gpt-4o',
      vision: true,
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

    const frameImages = normalizeFrameImages(input.frameImages);
    const hasRichInput = frameImages.length > 0 || Array.isArray(input.frameMetrics) && input.frameMetrics.length > 0;
    const model = frameImages.length > 0 ? 'gpt-4o' : hasRichInput ? 'gpt-4o-mini' : 'gpt-4o-mini';

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: buildMessages(input),
        max_tokens: 4500,
        temperature: 0.2,
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
      frameTimestamps: Array.isArray(input.frameMetrics)
        ? input.frameMetrics.map((f: Record<string, unknown>) => Number(f.second)).filter(Number.isFinite)
        : [],
      analysis: normalizeAnalysis(parseModelJson(content)),
    });
  } catch (err) {
    console.error('Analyze function error:', err);
    return json({ error: err instanceof Error ? err.message : 'שגיאה בניתוח' }, 500);
  }
});
