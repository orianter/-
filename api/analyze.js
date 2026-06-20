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

function average(items, key) {
  const values = items.map((item) => Number(item[key])).filter(Number.isFinite);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreFromRange(value, idealMin, idealMax, lowBad, highBad) {
  if (!Number.isFinite(value)) return 6;
  if (value >= idealMin && value <= idealMax) return 9;
  if (value < idealMin) {
    const ratio = Math.max(0, Math.min(1, (value - lowBad) / (idealMin - lowBad)));
    return Math.round(3 + ratio * 5);
  }
  const ratio = Math.max(0, Math.min(1, (highBad - value) / (highBad - idealMax)));
  return Math.round(3 + ratio * 5);
}

function visualEvidence(input) {
  const frames = Array.isArray(input?.frameMetrics) ? input.frameMetrics : [];
  const width = Number(input?.width);
  const height = Number(input?.height);
  const durationSec = Number(input?.durationSec) || 60;
  const isVertical = Number.isFinite(width) && Number.isFinite(height) ? height > width : null;

  if (!frames.length) {
    return {
      hasFrames: false,
      scores: {
        hook: 6,
        pacing: 6,
        visual: isVertical === false ? 5 : 6,
        platformFit: isVertical === false ? 5 : 7,
      },
      notes: ['לא התקבלו דגימות פריימים, לכן הניתוח הוויזואלי מוגבל.'],
      fixes: [],
      timeline: [],
    };
  }

  const avgBrightness = average(frames, 'brightness');
  const avgContrast = average(frames, 'contrast');
  const avgSharpness = average(frames, 'sharpness');
  const avgColorfulness = average(frames, 'colorfulness');
  const avgSceneChange = average(frames.slice(1), 'sceneChange') ?? 0;
  const hookFrames = frames.filter((frame) => Number(frame.second) <= 3);
  const hookChange = average(hookFrames.slice(1), 'sceneChange') ?? avgSceneChange;
  const hookSharpness = average(hookFrames, 'sharpness') ?? avgSharpness;

  const visualScore = Math.round(
    (
      scoreFromRange(avgBrightness, 75, 185, 20, 245) +
      scoreFromRange(avgContrast, 28, 75, 8, 130) +
      scoreFromRange(avgSharpness, 12, 34, 3, 60) +
      scoreFromRange(avgColorfulness, 14, 48, 2, 90)
    ) / 4,
  );
  const pacingScore = scoreFromRange(avgSceneChange, 8, 28, 1, 55);
  const hookScore = Math.round((scoreFromRange(hookChange, 8, 30, 1, 60) + scoreFromRange(hookSharpness, 12, 36, 3, 70)) / 2);
  const platformFitScore = Math.min(10, Math.max(1, Math.round(
    (isVertical ? 8 : 4) +
    (durationSec <= 35 ? 1 : 0) +
    (durationSec > 60 ? -3 : 0),
  )));

  const notes = [
    `נדגמו ${frames.length} פריימים אמיתיים מהסרטון.`,
    `בהירות ממוצעת ${Math.round(avgBrightness)}, קונטרסט ${Math.round(avgContrast)}, חדות ${Math.round(avgSharpness)}, שינויי סצנה ${Math.round(avgSceneChange)}%.`,
  ];
  if (isVertical === false) notes.push('הסרטון לא אנכי, וזה פוגע בהתאמה לרילס/טיקטוק.');
  if (avgBrightness < 70) notes.push('הווידאו נראה חשוך יחסית במספר דגימות.');
  if (avgBrightness > 195) notes.push('יש נטייה לחשיפת יתר/בהירות גבוהה מדי.');
  if (avgSharpness < 10) notes.push('הפריימים נראים רכים או מטושטשים יחסית.');
  if (avgSceneChange < 6) notes.push('יש מעט שינוי ויזואלי בין הפריימים, מה שעלול להרגיש סטטי.');
  if (hookChange < 7) notes.push('בשלוש השניות הראשונות אין מספיק שינוי ויזואלי כדי לעצור גלילה.');

  const fixes = [];
  if (hookScore < 7) fixes.push('חזק את 3 השניות הראשונות: תנועה, טקסט גדול או פתיחה שמציגה קונפליקט מיד.');
  if (visualScore < 7) fixes.push('שפר תאורה/חדות/קונטרסט כדי שהסרטון יראה מקצועי יותר בפיד.');
  if (pacingScore < 7) fixes.push('הוסף חיתוכים או שינויי זווית כל 1-2 שניות כדי לשפר retention.');
  if (platformFitScore < 7) fixes.push('צלם/חתוך לפורמט אנכי 9:16 ושמור על אורך קצר יותר.');

  const timeline = frames.map((frame) => ({
    second: Math.round(Number(frame.second) || 0),
    note: [
      frame.sceneChange < 6 ? 'מעט שינוי ויזואלי' : 'יש שינוי ויזואלי',
      frame.sharpness < 10 ? 'חדות נמוכה' : 'חדות סבירה',
      frame.brightness < 70 ? 'חשוך יחסית' : frame.brightness > 195 ? 'בהיר מדי' : 'בהירות תקינה',
    ].join(' · '),
  }));

  return {
    hasFrames: true,
    scores: {
      hook: hookScore,
      pacing: pacingScore,
      visual: visualScore,
      platformFit: platformFitScore,
    },
    notes,
    fixes,
    timeline,
  };
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
  const evidence = visualEvidence(input);
  const upperScore = data?.SCORE;
  const score = clampScore(upperScore ?? data?.analysis?.score);
  const whyItFailed = asArray(data?.['WHY IT FAILED'] ?? data?.analysis?.whyItFailed);
  const whatToChange = asArray(data?.['WHAT TO CHANGE'] ?? data?.analysis?.whatToChange);
  const howToImprove = asArray(data?.['HOW TO IMPROVE'] ?? data?.analysis?.howToImprove);
  const categories = data?.analysis?.categories && typeof data.analysis.categories === 'object'
    ? data.analysis.categories
    : buildCategories(score, data?.CATEGORIES ?? data?.analysis?.categories);
  const mergedCategories = {
    ...categories,
    hook: {
      ...categories.hook,
      score: evidence.scores.hook,
      note: evidence.hasFrames
        ? `לפי דגימות 0-3 שניות: ${evidence.notes.find((note) => note.includes('שלוש השניות')) || 'הפתיחה נמדדה לפי שינוי ויזואלי וחדות.'}`
        : categories.hook?.note,
    },
    pacing: {
      ...categories.pacing,
      score: evidence.scores.pacing,
      note: evidence.hasFrames
        ? 'הקצב נמדד לפי שינויי סצנה בין פריימים שנדגמו מהסרטון.'
        : categories.pacing?.note,
    },
    visual: {
      ...categories.visual,
      score: evidence.scores.visual,
      note: evidence.hasFrames ? evidence.notes[1] : categories.visual?.note,
    },
    platformFit: {
      ...categories.platformFit,
      score: evidence.scores.platformFit,
      note: Number(input?.height) > Number(input?.width)
        ? 'הפורמט אנכי ומתאים יותר לרילס/טיקטוק.'
        : 'הפורמט אינו אנכי, וזה פוגע בהתאמה לפלטפורמות קצרות.',
    },
  };
  const overallScore = Math.round(
    (score + evidence.scores.hook + evidence.scores.pacing + evidence.scores.visual + evidence.scores.platformFit) / 5,
  );
  const priorityFixes = [
    ...evidence.fixes,
    ...asArray(data?.['PRIORITY FIXES'] ?? data?.analysis?.priorityFixes),
  ].slice(0, 5);

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
    frameTimestamps: (input?.frameMetrics || []).map((frame) => frame.second).filter(Number.isFinite),
    analysis: {
      score: overallScore,
      verdict: String(data?.VERDICT || data?.analysis?.verdict || 'הניתוח הושלם.'),
      summary: String(
        evidence.hasFrames
          ? `${evidence.notes.join(' ')} ${data?.analysis?.summary || [...whyItFailed, ...whatToChange].slice(0, 2).join(' ')}`
          : data?.analysis?.summary ||
            [...whyItFailed, ...whatToChange].slice(0, 2).join(' ') ||
            'הניתוח הסתיים ומחזיר המלצות בסיסיות לשיפור הסרטון.',
      ),
      categories: mergedCategories,
      priorityFixes,
      whyItFailed: [...evidence.notes.slice(2), ...whyItFailed].slice(0, 8),
      whatToChange: [...evidence.fixes, ...whatToChange].slice(0, 8),
      howToImprove,
      hookSuggestion: String(data?.['HOOK SUGGESTION'] || data?.analysis?.hookSuggestion || ''),
      scriptSuggestion: String(data?.['SCRIPT SUGGESTION'] || data?.analysis?.scriptSuggestion || ''),
      platformTips: asArray(data?.['PLATFORM TIPS'] ?? data?.analysis?.platformTips),
      timeline: (evidence.timeline.length ? evidence.timeline : normalizeTimeline(data?.TIMELINE ?? data?.analysis?.timeline)),
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
