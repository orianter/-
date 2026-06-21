const PLATFORM_LABELS = {
  tiktok: 'TikTok',
  reels: 'Instagram Reels',
  both: 'TikTok ו-Reels',
};

const CATEGORY_LABELS = {
  hook: 'פתיחה (Hook)',
  pacing: 'קצב ועריכה',
  message: 'מסר ו-CTA',
  visual: 'ויזואל',
  audio: 'אודיו',
  platformFit: 'התאמה לפלטפורמה',
};

const CATEGORY_KEYS = ['hook', 'pacing', 'message', 'visual', 'audio', 'platformFit'];

function clampScore(value, fallback = 5) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const normalized = n > 10 ? n / 10 : n;
  return Math.min(10, Math.max(1, Math.round(normalized)));
}

function asText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asArray(value, max = 10) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, max);
}

function normalizeCategoryDetails(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const result = {};
  for (const key of CATEGORY_KEYS) {
    const c = raw[key];
    if (c && typeof c === 'object') {
      const detail = {
        whatWeSaw: asText(c.whatWeSaw),
        whyItMatters: asText(c.whyItMatters),
        exactFix: asText(c.exactFix),
      };
      if (detail.whatWeSaw || detail.whyItMatters || detail.exactFix) {
        result[key] = detail;
      }
    }
  }
  return Object.keys(result).length ? result : null;
}

function normalizeDetailedFindings(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      area: asText(item.area, 'כללי'),
      finding: asText(item.finding),
      evidence: asText(item.evidence),
      impact: asText(item.impact),
      fix: asText(item.fix),
    }))
    .filter((item) => item.finding)
    .slice(0, 12);
}

function parseModelJson(content) {
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

function normalizePlatform(platform) {
  return ['tiktok', 'reels', 'both'].includes(String(platform)) ? String(platform) : 'tiktok';
}

function normalizeAnalysis(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const rawCategories = a.categories && typeof a.categories === 'object' ? a.categories : {};
  const categories = {};

  for (const key of CATEGORY_KEYS) {
    const c = rawCategories[key] && typeof rawCategories[key] === 'object' ? rawCategories[key] : {};
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
      .map((item) => ({
        second: Math.max(0, Math.round(Number(item.second) || 0)),
        note: asText(item.note),
      }))
      .filter((item) => item.note)
      .slice(0, 12)
    : [];

  return {
    score: clampScore(a.score, averageScore),
    verdict: asText(a.verdict),
    summary: asText(a.summary, 'הניתוח הושלם.'),
    categories,
    categoryDetails: normalizeCategoryDetails(a.categoryDetails),
    detailedFindings: normalizeDetailedFindings(a.detailedFindings),
    priorityFixes: asArray(a.priorityFixes, 6),
    whyItFailed: asArray(a.whyItFailed, 8),
    whatToChange: asArray(a.whatToChange, 8),
    howToImprove: asArray(a.howToImprove, 8),
    hookSuggestion: asText(a.hookSuggestion),
    scriptSuggestion: asText(a.scriptSuggestion),
    platformTips: asArray(a.platformTips, 6),
    timeline,
  };
}

function formatFrameMetrics(frames) {
  if (!Array.isArray(frames) || !frames.length) {
    return 'לא התקבלו דגימות פריימים — הניתוח הוויזואלי מוגבל.';
  }

  const lines = frames.map((f) => {
    const second = Number(f.second);
    const brightness = Number(f.brightness);
    const contrast = Number(f.contrast);
    const sharpness = Number(f.sharpness);
    const colorfulness = Number(f.colorfulness);
    const sceneChange = Number(f.sceneChange);
    const darkRatio = Number(f.darkRatio);
    const brightRatio = Number(f.brightRatio);
    const flags = [];
    if (Number.isFinite(second) && second <= 3) flags.push('אזור Hook');
    if (brightness < 70) flags.push('חשוך');
    if (brightness > 195) flags.push('בהיר מדי');
    if (sharpness < 10) flags.push('מטושטש');
    if (sceneChange < 6) flags.push('סטטי');
    if (darkRatio > 35) flags.push('הרבה אזורים כהים');
    if (brightRatio > 20) flags.push('הרבה אזורים שרופים');
    return `- ${Number.isFinite(second) ? second.toFixed(1) : '?'} שנ': בהירות ${Math.round(brightness)}, קונטרסט ${Math.round(contrast)}, חדות ${Math.round(sharpness)}, צבע ${Math.round(colorfulness)}, שינוי סצנה ${Math.round(sceneChange)}%${flags.length ? ` [${flags.join(', ')}]` : ''}`;
  });

  const hookFrames = frames.filter((f) => Number(f.second) <= 3);
  const avgHookChange = hookFrames.length > 1
    ? hookFrames.slice(1).reduce((sum, f) => sum + Number(f.sceneChange || 0), 0) / (hookFrames.length - 1)
    : null;

  let summary = `\nסיכום מדדים: ${frames.length} פריימים נדגמו מהסרטון האמיתי.`;
  if (avgHookChange !== null && avgHookChange < 7) {
    summary += ' ב-3 השניות הראשונות יש מעט שינוי ויזואלי — סיכון גבוה לגלילה.';
  }
  return lines.join('\n') + summary;
}

function formatAudioMetrics(audio) {
  const a = audio && typeof audio === 'object' ? audio : null;
  if (!a?.analyzed) return 'לא ניתן לנתח אודיו מהקובץ — אל תניח מה נאמר, רק המלץ מה לבדוק.';
  const lines = [
    `- יש אודיו: ${a.hasAudio ? 'כן' : 'כמעט לא / שקט'}`,
    `- עוצמה ממוצעת: ${Number(a.avgVolume) || 0}`,
    `- עוצמה ב-3 שניות ראשונות: ${Number(a.hookVolume) || 0}`,
    `- אחוז חלונות שקטים: ${Number(a.silentRatio) || 0}%`,
    `- שקט בפתיחה (0-3 שנ'): ${Number(a.hookSilentRatio) || 0}%`,
  ];
  if (a.openingWeak) lines.push('- האודיו בפתיחה חלש יותר מהממוצע');
  if (a.mostlySilent) lines.push('- הסרטון שקט לרוב');
  return lines.join('\n');
}

function formatAnalysisDigest(digest) {
  const d = digest && typeof digest === 'object' ? digest : null;
  if (!d) return '';
  const findings = Array.isArray(d.findings)
    ? d.findings.filter((item) => typeof item === 'string' && item.trim()).join('\n- ')
    : '';
  return [
    `דגימות: ${Number(d.frameCount) || 0} פריימים · אורך ${Number(d.durationSec) || '?'} שנ'`,
    d.aspectRatio ? `יחס גובה/רוחב: ${d.aspectRatio}${d.isVertical916 ? ' (9:16 ✓)' : ''}` : '',
    d.hookSceneChange != null ? `שינוי ויזואלי ב-Hook: ${d.hookSceneChange}%` : '',
    d.avgSceneChange != null ? `שינוי ויזואלי ממוצע: ${d.avgSceneChange}%` : '',
    d.avgBrightness != null ? `בהירות ממוצעת: ${d.avgBrightness}` : '',
    d.avgSharpness != null ? `חדות ממוצעת: ${d.avgSharpness}` : '',
    findings ? `ממצאים מחושבים מראש:\n- ${findings}` : '',
  ].filter(Boolean).join('\n');
}

function normalizeFrameImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const base64 = asText(item.base64);
      if (!base64 || base64.length > 200_000) return null;
      return {
        second: Number(item.second) || 0,
        label: asText(item.label, 'פריים'),
        isHook: Boolean(item.isHook) || Number(item.second) <= 1,
        base64,
      };
    })
    .filter(Boolean)
    .slice(0, 5);
}

function buildPrompt(input, hasVision) {
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

  return `אתה אנליסט בכיר לתוכן ויראלי קצר (${platformLabel}) עם ניסיון של אלפי רילסים.
תפקידך: ניתוח מקיף, מדויק ומפורט — כל משפט חייב להיות מבוסס על נתון, שניה או פריים ספציפי.

## כללי דיוק (חובה מוחלטת)
1. כל טענה חייבת לכלול ראיה: מספר מדד, שניה, או מה שרואים בפריים/ב-contentBrief
2. ציין שניות מדויקות (למשל "בשנייה 0.5", "ב-3 השניות הראשונות")
3. אל תמציא דיבור/טקסט — רק contentBrief ומה שרואים בפריימים
4. אם חסר מידע — כתוב במפורש "לא ניתן לבדוק X כי Y"
5. אל תכתוב משפטים גנריים כמו "שפר את ה-Hook" — תגיד בדיוק מה לשנות ולמה

## מה יש לך
${hasVision
    ? '- תמונות פריים אמיתיות מהסרטון (מצורפות) — תאר מה רואים: פנים, טקסט, תאורה, קומפozיציה, מוצר'
    : '- אין תמונות — הסתמך על מדדי פריימים שנדגמו מהסרטון בדפדפן'}
- מדדי אודיו אמיתיים מהקובץ (אין תמלול מילולי)

## הקשר מהיוצר
- פלטפורמה: ${platformLabel}
- קהל יעד: ${audience}
- מטרה: ${goal}
- מה לא עבד (לדעת היוצר): ${problem}
- תיאור התוכן/מה נאמר: ${contentBrief}

## מטא-דאטה
- ${fileName} · ${fileType}
- אורך: ${Number.isFinite(durationSec) ? durationSec.toFixed(1) + ' שניות' : 'לא זוהה'}
- מידות: ${Number.isFinite(width) && Number.isFinite(height) ? `${width}×${height}` : 'לא זוהה'}${isVertical === true ? ' (אנכי ✓)' : isVertical === false ? ' (לא אנכי — בעיה לרילס/טיקטוק)' : ''}

## סיכום מדידה אוטומטי
${formatAnalysisDigest(input.analysisDigest) || 'לא התקבל.'}

## מדדי פריימים (כל שורה = דגימה אמיתית)
${formatFrameMetrics(input.frameMetrics)}

## מדדי אודיו
${formatAudioMetrics(input.audioMetrics)}

## מה לנתח בכל קטגוריה
1. Hook (0-3 שנ'): מתח, הבטחה, שינוי ויזואלי, אודיו בפתיחה
2. קצב: שינויי סצנה בין פריימים — האם סטטי?
3. מסר: הבטחה, ערך, CTA — לפי contentBrief
4. ויזואל: בהירות, חדות, קונטרסט, פורמט
5. אודיו: עוצמה, שקט בפתיחה, מוזיקה/דיבור
6. התאמה ל-${platformLabel}: hook מהיר, אורך, פורמát אנכי

## דרישות פלט
- summary: 3-5 משפטים עם מספרים/שניות
- categories.note: 2-3 משפטים לכל קטגוריה עם ראיה
- categoryDetails: לכל קטגוריה — מה ראינו, למה זה משנה, תיקון מדויק
- detailedFindings: 6-10 ממצאים עם area, finding, evidence, impact, fix
- priorityFixes: 4-6 תיקונים מדורגים
- whyItFailed: 4-6 סיבות עם ראיה
- whatToChange: 4-6 שינויים קונקרטיים
- howToImprove: 4-6 המלצות מעשיות
- timeline: נקודה לכל פריים שנדגם + המלצה ספציפית
- hookSuggestion: פתיחה חלופית מותאמת ל-"${audience !== 'לא צוין' ? audience : 'קהל היעד'}"
- scriptSuggestion: outline מלא ל-${Number.isFinite(durationSec) ? durationSec.toFixed(0) : '60'} שניות עם שניות

החזר JSON בלבד, בלי markdown:
{
  "score": <1-10>,
  "verdict": "<משפט אחד חד>",
  "summary": "<3-5 משפטים>",
  "categories": {
    "hook": { "score": <1-10>, "label": "פתיחה (Hook)", "note": "<2-3 משפטים עם ראיה>" },
    "pacing": { "score": <1-10>, "label": "קצב ועריכה", "note": "<2-3 משפטים>" },
    "message": { "score": <1-10>, "label": "מסר ו-CTA", "note": "<2-3 משפטים>" },
    "visual": { "score": <1-10>, "label": "ויזואל", "note": "<2-3 משפטים>" },
    "audio": { "score": <1-10>, "label": "אודיו", "note": "<2-3 משפטים>" },
    "platformFit": { "score": <1-10>, "label": "התאמה לפלטפורמה", "note": "<2-3 משפטים>" }
  },
  "categoryDetails": {
    "hook": { "whatWeSaw": "<מה נמדד/נראה>", "whyItMatters": "<השפעה על retention>", "exactFix": "<מה לעשות בדיוק>" },
    "pacing": { "whatWeSaw": "...", "whyItMatters": "...", "exactFix": "..." },
    "message": { "whatWeSaw": "...", "whyItMatters": "...", "exactFix": "..." },
    "visual": { "whatWeSaw": "...", "whyItMatters": "...", "exactFix": "..." },
    "audio": { "whatWeSaw": "...", "whyItMatters": "...", "exactFix": "..." },
    "platformFit": { "whatWeSaw": "...", "whyItMatters": "...", "exactFix": "..." }
  },
  "detailedFindings": [
    { "area": "Hook", "finding": "<מה הבעיה>", "evidence": "<מספר/שניה>", "impact": "<למה זה פוגע>", "fix": "<מה לעשות>" }
  ],
  "priorityFixes": ["<#1>", "<#2>", "<#3>", "<#4>"],
  "whyItFailed": ["<סיבה + ראיה>"],
  "whatToChange": ["<שינוי + איך>"],
  "howToImprove": ["<המלצה + למה>"],
  "hookSuggestion": "<פתיחה חלופית>",
  "scriptSuggestion": "<תסריט עם שניות>",
  "platformTips": ["<טיפ>"],
  "timeline": [{ "second": <number>, "note": "<מה רואים + מה לשנות>" }]
}`;
}

function buildMessages(input) {
  const frameImages = normalizeFrameImages(input.frameImages);
  const hasVision = frameImages.length > 0;
  const prompt = buildPrompt(input, hasVision);

  if (!hasVision) {
    return [
      { role: 'system', content: 'אנליסט תוכן ויראלי מקצועי ברמה הגבוהה ביותר. כל טענה חייבת ראיה. ענה בעברית. JSON בלבד.' },
      { role: 'user', content: prompt },
    ];
  }

  const content = [
    { type: 'text', text: prompt },
    ...frameImages.flatMap((img) => [
      { type: 'text', text: `[פריים ב-${img.second.toFixed(1)} שניות — ${img.label}]` },
      {
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${img.base64}`, detail: img.isHook ? 'high' : 'low' },
      },
    ]),
  ];

  return [
    { role: 'system', content: 'אנליסט תוכן ויראלי עם ראייה. תאר בדיוק מה רואים בפריימים. ענה בעברית. JSON בלבד.' },
    { role: 'user', content },
  ];
}

export async function runOpenAiAnalysis(input, apiKey) {
  const platform = normalizePlatform(input.platform);
  const durationSec = Math.round((Number(input.durationSec) || 60) * 10) / 10;
  if (durationSec > 65) throw new Error('הסרטון ארוך מדי. המקסימום הוא דקה אחת.');

  const frameImages = normalizeFrameImages(input.frameImages);
  const hasRichInput = frameImages.length > 0 || (Array.isArray(input.frameMetrics) && input.frameMetrics.length > 0);
  const model = frameImages.length > 0 ? 'gpt-4o' : 'gpt-4o-mini';

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
      max_tokens: 6000,
      temperature: 0.2,
    }),
  });

  const openaiJson = await openaiResponse.json();
  if (!openaiResponse.ok) {
    throw new Error(openaiJson?.error?.message || 'שגיאה בקריאה ל-OpenAI');
  }

  const content = openaiJson.choices?.[0]?.message?.content;
  if (!content) throw new Error('לא התקבלה תשובה מ-OpenAI');

  return {
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
      ? input.frameMetrics.map((f) => Number(f.second)).filter(Number.isFinite)
      : [],
    analysis: normalizeAnalysis(parseModelJson(content)),
  };
}

export function getHealthInfo(apiKey) {
  return {
    ok: true,
    hasApiKey: Boolean(apiKey),
    demoMode: false,
    maxDurationSec: 60,
    maxFileMb: 100,
    service: apiKey ? 'vercel-openai' : 'supabase-proxy',
    model: 'gpt-4o',
    vision: true,
  };
}
