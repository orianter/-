import {
  markFreeUsageUsed,
} from './lib/freeUsage.js';
import {
  accessHealthExtras,
  accessLimitResponse,
  resolveAnalysisAccess,
} from './lib/analysisAccess.js';
import { deductCredit } from './lib/credits.js';
import { isCardcomConfigured } from './lib/cardcom.js';
import { getHealthInfo, runOpenAiAnalysis, runTeaserAnalysis } from './lib/openaiAnalyze.js';

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

function asText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
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
    (durationSec > 90 ? -3 : 0),
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

  const timeline = frames.map((frame) => {
    const sec = Math.round(Number(frame.second) || 0);
    const parts = [];
    if (Number(frame.second) <= 3) parts.push('אזור Hook');
    parts.push(`שינוי סצנה ${Math.round(Number(frame.sceneChange) || 0)}%`);
    parts.push(`בהירות ${Math.round(Number(frame.brightness) || 0)}`);
    parts.push(`חדות ${Math.round(Number(frame.sharpness) || 0)}`);
    if (Number(frame.sharpness) < 10) parts.push('חדות נמוכה');
    if (Number(frame.brightness) < 70) parts.push('חשוך');
    if (Number(frame.brightness) > 195) parts.push('בהיר מדי');
    if (Number(frame.sceneChange) < 6) parts.push('סטטי — סיכון לגלילה');
    return {
      second: sec,
      note: `שנייה ${Number(frame.second)?.toFixed?.(1) ?? sec}: ${parts.join(' · ')}`,
    };
  });

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

function blendScore(measured, ai, measuredWeight = 0.65) {
  const m = clampScore(measured);
  const a = clampScore(ai, m);
  return Math.round(m * measuredWeight + a * (1 - measuredWeight));
}

function pickScore(measured, aiScore, aiNote, options = {}) {
  const { hasVision = false, measuredWeight = 0.55 } = options;
  const ai = clampScore(aiScore, measured);
  if (hasVision && asText(aiNote).length > 28) return ai;
  return blendScore(measured, ai, measuredWeight);
}

function pickNote(measuredNote, aiNote, fallback, hasVision = false) {
  const ai = asText(aiNote);
  const measured = asText(measuredNote);
  if (hasVision && ai.length > 28) return ai;
  return mergeNote(measured, ai, fallback);
}

function audioEvidence(input) {
  const audio = input?.audioMetrics;
  if (!audio?.analyzed) {
    return { score: 6, notes: ['לא ניתן לנתח אודיו מהקובץ — הניתוח מבוסס על תיאור התוכן בלבד.'], fixes: [] };
  }

  let score = 7;
  const notes = [];
  const fixes = [];

  if (!audio.hasAudio) {
    score = 4;
    notes.push('כמעט אין אודיו מזוהה בסרטון.');
    fixes.push('הוסף מוזיקת רקע או דיבור ברור — סרטון שקט מפסיד צופים.');
  }
  if (audio.hookSilentRatio > 50) {
    score = Math.min(score, 5);
    notes.push(`ב-3 השניות הראשונות יש ${audio.hookSilentRatio}% שקט — פוגע ב-Hook.`);
    fixes.push('פתח עם משפט/מוזיקה/אפקט סאונד מיד בשנייה 0, לא אחרי 2 שניות שקט.');
  }
  if (audio.openingWeak) {
    score = Math.min(score, 6);
    notes.push('עוצמת האודיו בפתיחה חלשה יותר מהממוצע.');
    fixes.push('הגבר דיבור/מוזיקה ב-3 השניות הראשונות.');
  }
  if (audio.mostlySilent) {
    score = Math.min(score, 5);
    notes.push(`הסרטון שקט ב-${audio.silentRatio}% מהזמן.`);
  }

  return { score, notes, fixes };
}

function mergeNote(measuredNote, aiNote, fallback) {
  const parts = [asText(measuredNote), asText(aiNote)].filter(Boolean);
  if (!parts.length) return fallback;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1]}`;
}

function contentScores(content) {
  let message = 5;
  let audio = 6;
  const notes = [];
  const { goal, problem, audience, contentBrief, transcript } = content;
  const hasTranscript = Boolean(transcript && !transcript.startsWith('('));

  if (audience) {
    message += 1;
    notes.push(`קהל יעד מוגדר: ${audience}.`);
  }
  if (goal) {
    message += 1;
    notes.push(`מטרה: ${goal}.`);
  }
  if (problem) notes.push(`בעיה שדווחה: ${problem}.`);

  if (hasTranscript) {
    message += 2;
    notes.push('יש תמלול Whisper — ניתוח המסר מבוסס על דיבור אמיתי מהסרטון.');
    const lower = transcript.toLowerCase();
    const hasHook = /[?]/.test(transcript) || /(איך|למה|כמה|מה|טעות|סוד|לפני|אחרי|אל|בלי|אם)/.test(lower);
    const hasCta = /(שלח|לחץ|כתוב|שמור|עקוב|קנה|דברו|השאירו|תגובה|לינק|ביו|וואטסאפ|dm|direct)/i.test(transcript);
    if (hasHook) message += 1;
    else notes.push('בתמלול לא זוהה Hook מילולי ברור (שאלה/מתח).');
    if (hasCta) message += 1;
    else notes.push('בתמלול לא זוהה CTA ברור בסוף.');
    audio += 1;
  } else if (contentBrief) {
    message += 1;
    const brief = contentBrief.toLowerCase();
    const hasHook = /[?]/.test(contentBrief) || /(איך|למה|כמה|מה|טעות|סוד|לפני|אחרי|אל|בלי|אם)/.test(brief);
    const hasCta = /(שלח|לחץ|כתוב|שמור|עקוב|קנה|דברו|השאירו|תגובה|לינק|ביו|וואטסאפ|dm|direct)/i.test(brief);
    const hasValue = contentBrief.length >= 40;

    if (hasHook) message += 1;
    else notes.push('בתיאור התוכן לא זוהה Hook ברור (שאלה/מתח/הבטחה).');
    if (hasCta) message += 1;
    else notes.push('לא זוהה CTA ברור בתיאור התוכן.');
    if (hasValue) message += 1;
    else notes.push('תיאור התוכן קצר מדי — קשה לבדוק מסר מלא.');

    if (/(מוזיק|שיר|beat|סאונד|קול|דיבור|כתובית)/i.test(brief)) {
      audio += 1;
      notes.push('יש אזכור לאודיו/מוזיקה/דיבור בתיאור.');
    } else {
      notes.push('לא ניתן לבדוק אודיו — ודא שיש מוזיקה/דיבור ברור וכתוביות.');
    }
  } else {
    notes.push('לא סופק תיאור תוכן ואין תמלול — ניתוח המסר מוגבל.');
  }

  return {
    message: Math.min(10, message),
    audio: Math.min(10, audio),
    notes,
  };
}
function contentEvidence(input) {
  const goal = asText(input?.goal);
  const problem = asText(input?.problem);
  const audience = asText(input?.audience);
  const contentBrief = asText(input?.contentBrief);
  const transcript = asText(input?.transcript);
  const hasTranscript = Boolean(transcript && !transcript.startsWith('('));
  const hasContext = Boolean(goal || problem || audience || contentBrief || hasTranscript);
  const notes = [];
  const fixes = [];
  const scores = contentScores({ goal, problem, audience, contentBrief, transcript });

  notes.push(...scores.notes);

  if (!audience) {
    notes.push('לא הוגדר קהל יעד ברור, ולכן קשה לדעת למי ההבטחה בסרטון אמורה לדבר.');
    fixes.push('פתח את הסרטון בפנייה ישירה לקהל יעד אחד, למשל: "בעלי עסקים שמעלים רילס ולא מקבלים פניות".');
  }
  if (!goal) {
    notes.push('לא הוגדרה מטרה עסקית/תוכנית ברורה לסרטון.');
    fixes.push('בחר מטרה אחת לסרטון: צפיות, לידים, מכירה, שמירה, או תגובות. אל תנסה הכל יחד.');
  }
  if (!contentBrief && !hasTranscript) {
    notes.push('לא סופק תיאור של מה נאמר או כתוב בסרטון, ואין תמלול — הניתוח של המסר מוגבל.');
    fixes.push('הוסף משפט פתיחה, מה רואים על המסך ומה ה-CTA — או ודא שיש דיבור לתמלול.');
  } else if (!contentBrief && hasTranscript) {
    notes.push('אין תיאור מהיוצר, אבל יש תמלול Whisper — ניתוח המסר מבוסס על מה שנאמר בפועל.');
  } else if (contentBrief) {
    const brief = contentBrief.toLowerCase();
    if (!/[?]/.test(contentBrief) && !/(איך|למה|כמה|מה|טעות|סוד|לפני|אחרי|אל|בלי)/.test(brief)) {
      fixes.push('ה-Hook צריך להכיל מתח ברור: שאלה, טעות נפוצה, הבטחה מדידה או ניגוד לפני/אחרי.');
    }
    if (!/(שלח|לחץ|כתוב|שמור|עקוב|קנה|דברו|השאירו|תגובה|לינק|ביו|וואטסאפ)/.test(brief)) {
      fixes.push('חסר CTA ברור בסוף. אמור לצופה פעולה אחת מדויקת לעשות עכשיו.');
      notes.push('לא זוהה CTA ברור בתיאור שסופק.');
    }
  }
  if (problem) {
    notes.push(`הבעיה שהיוצר דיווח עליה: ${problem}.`);
  }

  return { hasContext, goal, problem, audience, contentBrief, notes, fixes, scores: scores };
}

function unique(items, max = 10) {
  return [...new Set(items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))].slice(0, max);
}

function formatCategoryNoteFromDetail(detail, fallbackNote) {
  if (!detail || typeof detail !== 'object') return fallbackNote;
  const parts = [
    asText(detail.whatWeSaw),
    asText(detail.whyItMatters),
    asText(detail.exactFix) ? `→ ${asText(detail.exactFix)}` : '',
  ].filter(Boolean);
  if (parts.length >= 2) return parts.join(' ');
  return fallbackNote;
}

function buildMeasuredEvidence(input, evidence, content, audio) {
  const items = [];
  const digest = input?.analysisDigest;

  if (evidence.hasFrames) {
    evidence.notes.forEach((note) => {
      items.push({ source: 'frames', label: 'מדידת פריימים', value: note, implication: '' });
    });
    (input?.frameMetrics || []).slice(0, 8).forEach((frame) => {
      const sec = Number(frame.second);
      if (!Number.isFinite(sec)) return;
      items.push({
        source: 'frames',
        label: `פריים ${sec.toFixed(1)} שנ'`,
        value: `בהירות ${Math.round(frame.brightness)}, חדות ${Math.round(frame.sharpness)}, שינוי ${Math.round(frame.sceneChange)}%`,
        implication: sec <= 3 && Number(frame.sceneChange) < 7
          ? 'פתיחה סטטית — סיכון גבוה לגלילה'
          : Number(frame.sharpness) < 10
            ? 'איכות תמונה נמוכה בנקודה זו'
            : '',
      });
    });
  }

  if (audio?.notes?.length) {
    audio.notes.forEach((note) => {
      items.push({ source: 'audio', label: 'מדידת אודיו', value: note, implication: '' });
    });
    const am = input?.audioMetrics;
    if (am?.analyzed) {
      items.push({
        source: 'audio',
        label: 'עוצמות',
        value: `ממוצע ${am.avgVolume} · Hook ${am.hookVolume} · שקט בפתיחה ${am.hookSilentRatio}%`,
        implication: am.openingWeak ? 'האודיו בפתיחה חלש — פוגע ב-Hook' : '',
      });
    }
  }

  if (content.notes?.length) {
    content.notes.slice(0, 4).forEach((note) => {
      items.push({ source: 'content', label: 'ניתוח תוכן', value: note, implication: '' });
    });
  }

  if (Array.isArray(digest?.findings)) {
    digest.findings.forEach((finding) => {
      items.push({ source: 'digest', label: 'ממצא אוטומטי', value: finding, implication: '' });
    });
  }

  const width = Number(input?.width);
  const height = Number(input?.height);
  if (Number.isFinite(width) && Number.isFinite(height)) {
    items.push({
      source: 'metadata',
      label: 'פורמט',
      value: `${width}×${height} · ${Number(input?.durationSec)?.toFixed?.(1) ?? '?'} שניות`,
      implication: height <= width ? 'לא אנכי — פוגע ב-Reels/TikTok' : 'פורמט אנכי',
    });
  }

  return items.slice(0, 16);
}

function buildMeasuredFindings(input, evidence, content, audio, speechMetrics, pacingMetrics) {
  const findings = [];
  const frames = input?.frameMetrics || [];
  const hookFrames = frames.filter((f) => Number(f.second) <= 3);
  const hookChange = average(hookFrames.slice(1), 'sceneChange');

  if (speechMetrics?.hasSpeech) {
    if (!speechMetrics.hookHasSpeech) {
      findings.push({
        area: 'Hook',
        finding: 'אין דיבור ב-0–3 שניות',
        evidence: 'תמלול Whisper',
        impact: 'Hook מילולי חסר — גלילה גבוהה',
        fix: 'התחל לדבר מיד או הוסף טקסט גדול עם מתח',
      });
    }
    if (speechMetrics.wpm > 185 || speechMetrics.wpm < 95) {
      findings.push({
        area: 'מסר',
        finding: `קצב דיבור ${speechMetrics.wpm} מילים/דקה`,
        evidence: `${speechMetrics.wordCount} מילים בתמלול`,
        impact: 'קשה לעקוב או משעמם',
        fix: speechMetrics.wpm > 185 ? 'האט ופרק למשפטים קצרים' : 'קצר והוסף שינויי קצב',
      });
    }
    if (speechMetrics.ctaAtSec == null) {
      findings.push({
        area: 'CTA',
        finding: 'לא זוהה CTA מילולי',
        evidence: 'תמלול Whisper',
        impact: 'צופים לא יודעים מה לעשות',
        fix: 'סיים בפעולה אחת: שלח/כתוב/שמור/עקוב',
      });
    }
  }

  if (pacingMetrics?.longestStaticSec >= 3.5) {
    findings.push({
      area: 'קצב',
      finding: `קטע סטטי של ~${pacingMetrics.longestStaticSec}s`,
      evidence: 'מדדי פריימים',
      impact: 'retention יורד בקטעים סטטיים',
      fix: 'jump cut / zoom / b-roll כל 1–2 שניות',
    });
  }

  if (hookChange !== null && hookChange < 7) {
    findings.push({
      area: 'Hook',
      finding: 'בפתיחה יש מעט שינוי ויזואלי',
      evidence: `שינוי סצנה ממוצע ${Math.round(hookChange)}% ב-0-3 שניות`,
      impact: 'צופים גוללים לפני שהמסר מגיע',
      fix: 'הוסף חיתוך, זום או טקסט גדול בשנייה 0-1',
    });
  }

  if (input?.audioMetrics?.openingWeak) {
    findings.push({
      area: 'אודיו',
      finding: 'האודיו בפתיחה חלש מהממוצע',
      evidence: `Hook ${input.audioMetrics.hookVolume} לעומת ממוצע ${input.audioMetrics.avgVolume}`,
      impact: 'פתיחה שקטה לא עוצרת גלילה',
      fix: 'התחל עם משפט/מוזיקה/אפקט סאונד מיד בשנייה 0',
    });
  }

  if (Number(input?.height) <= Number(input?.width)) {
    findings.push({
      area: 'פורמט',
      finding: 'הסרטון לא בפורמát אנכי',
      evidence: `${input.width}×${input.height}`,
      impact: 'Reels/TikTok מציגים את זה עם שוליים או חיתוך',
      fix: 'ייצא מחדש ב-1080×1920 (9:16)',
    });
  }

  if (!content.contentBrief && !(speechMetrics?.hasSpeech)) {
    findings.push({
      area: 'מסר',
      finding: 'לא סופק תיאור תוכן ואין תמלול',
      evidence: 'שדות ריקים',
      impact: 'לא ניתן לבדוק Hook, CTA והבטחה במדויק',
      fix: 'מלא תיאור או ודא שיש דיבור לתמלול',
    });
  }

  evidence.fixes.slice(0, 2).forEach((fix) => {
    findings.push({
      area: 'ויזואל',
      finding: fix,
      evidence: evidence.notes[1] || 'מדדי פריימים',
      impact: 'פוגע ב-retention ובמקצועיות',
      fix,
    });
  });

  return findings.slice(0, 8);
}

function deepRecommendations({ input, evidence, content, audio, upstream }) {
  const durationSec = Number(input?.durationSec) || 60;
  const isVertical = Number(input?.height) > Number(input?.width);
  const goal = content.goal || 'המטרה שלא הוגדרה';
  const audience = content.audience || 'קהל יעד לא מוגדר';
  const reportedProblem = content.problem || 'לא צוין';
  const ai = upstream?.analysis && typeof upstream.analysis === 'object' ? upstream.analysis : {};
  const hasAiPriority = asArray(ai.priorityFixes).length >= 4;
  const hasAiWhy = asArray(ai.whyItFailed).length >= 3;

  const priority = [];
  const why = [];
  const changes = [];
  const improve = [];
  const platformTips = [];

  if (!hasAiPriority) {
    priority.push(...evidence.fixes, ...content.fixes, ...audio.fixes);
    priority.push(...(input?.speechMetrics?.fixes || []), ...(input?.pacingMetrics?.fixes || []));
  }
  if (!hasAiWhy) {
    why.push(...evidence.notes.slice(2), ...content.notes, ...audio.notes);
    why.push(...(input?.speechMetrics?.findings || []), ...(input?.pacingMetrics?.findings || []));
  }

  if (!hasAiPriority && durationSec > 35) {
    priority.push('קצר את הסרטון או בנה אותו בפרקים ברורים: Hook, הוכחה, ערך, CTA.');
  }
  if (!hasAiWhy && durationSec > 35) {
    why.push('לרילס/טיקטוק, סרטון ארוך בלי שינויי קצב חזקים נוטה לאבד צפייה לפני המסר המרכזי.');
  }
  if (!hasAiPriority && !isVertical) {
    priority.push('חתוך ל-9:16 ושמור את הנושא המרכזי במרכז הפריים.');
  }
  if (asArray(ai.whatToChange).length < 2) {
    if (evidence.scores.hook <= 6) {
      changes.push(`החלף פתיחה כללית בפתיחה שמדברת ישירות ל-${audience}: בעיה אחת, תוצאה אחת, מתח אחד.`);
    }
    if (evidence.scores.pacing <= 6) {
      changes.push('חתוך dead air. כל 1-2 שניות צריך לקרות משהו: תנועה, זום, טקסט, שינוי זווית או הדגשה.');
    }
    if (evidence.scores.visual <= 6) {
      changes.push('שפר תאורה קדמית, הגדל קונטרסט, והימנע מפריים חשוך/מטושטש בפתיחה.');
    }
    if (!content.contentBrief) {
      changes.push('הוסף תיאור/תמלול קצר כדי שהניתוח יוכל לבדוק מסר, CTA והבטחה ולא רק מדדי וידאו.');
    }
  }

  if (asArray(ai.howToImprove).length < 2) {
    improve.push(`בנה את הסרטון סביב מטרה אחת: ${goal}. כל משפט שלא משרת אותה יורד בעריכה.`);
    improve.push('בדוק שכל 3 השניות הראשונות עונות לצופה על "למה זה חשוב לי עכשיו?"');
    improve.push('הוסף הוכחה אחת: מספר, צילום תוצאה, before/after, או דוגמה אמיתית.');
    improve.push('סיים עם CTA אחד בלבד, לא רשימת בקשות.');
  }

  if (asArray(ai.platformTips).length < 2) {
    platformTips.push('TikTok/Reels מענישים פתיחה איטית: הבעיה או התוצאה חייבות להופיע בפריים הראשון.');
    platformTips.push('שמור טקסט מרכזי באזור בטוח: לא צמוד לתחתית ולא מכוסה בכפתורי האפליקציה.');
    platformTips.push('אם יש דיבור, הוסף כתוביות גדולות עם 4-7 מילים בכל רגע.');
  }

  const aiHook = asText(upstream?.analysis?.hookSuggestion);
  const aiScript = asText(upstream?.analysis?.scriptSuggestion);
  const fallbackHook = content.audience
    ? `אם אתה ${content.audience} ו${reportedProblem !== 'לא צוין' ? reportedProblem : 'הסרטונים שלך לא מביאים תוצאה'}, תראה את זה לפני שאתה מעלה עוד רילס.`
    : 'אם הסרטונים שלך לא מביאים תוצאה, כנראה שהבעיה מתחילה ב-3 השניות הראשונות.';

  const fallbackScript = [
    `0-2 שניות: פנייה חדה לקהל: "${fallbackHook}"`,
    `2-6 שניות: הצג את הבעיה הספציפית בלי הקדמות.`,
    `6-14 שניות: תן דוגמה/הוכחה אחת שמראה שאתה יודע על מה אתה מדבר.`,
    `14-22 שניות: תן פתרון אחד פרקטי שאפשר ליישם מיד.`,
    `סוף: CTA אחד: "כתוב לי X", "שמור את זה", או "שלח למי שזה רלוונטי".`,
  ].join('\n');

  return {
    priority: unique([...asArray(upstream?.analysis?.priorityFixes), ...priority], 6),
    why: unique([...asArray(upstream?.analysis?.whyItFailed), ...why], 10),
    changes: unique([...asArray(upstream?.analysis?.whatToChange), ...changes], 10),
    improve: unique([...asArray(upstream?.analysis?.howToImprove), ...improve], 10),
    platformTips: unique([...asArray(upstream?.analysis?.platformTips), ...platformTips], 8),
    hookSuggestion: aiHook.length > 20 ? aiHook : fallbackHook,
    scriptSuggestion: aiScript.length > 40 ? aiScript : fallbackScript,
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
  const transcript = asText(data?.transcript);
  const enrichedInput = {
    ...input,
    transcript,
    speechMetrics: data?.speechMetrics || null,
    pacingMetrics: data?.pacingMetrics || null,
  };
  const evidence = visualEvidence(enrichedInput);
  const content = contentEvidence(enrichedInput);
  const audio = audioEvidence(enrichedInput);
  const hasVision = Array.isArray(input?.frameImages) && input.frameImages.length > 0;
  const recommendations = deepRecommendations({ input: enrichedInput, evidence, content, audio, upstream: data });
  const aiAnalysis = data?.analysis && typeof data.analysis === 'object' ? data.analysis : {};
  const aiCategoryDetails = aiAnalysis.categoryDetails && typeof aiAnalysis.categoryDetails === 'object'
    ? aiAnalysis.categoryDetails
    : {};
  const aiScore = clampScore(aiAnalysis.score ?? data?.SCORE);
  const categories = aiAnalysis.categories && typeof aiAnalysis.categories === 'object'
    ? aiAnalysis.categories
    : buildCategories(aiScore, data?.CATEGORIES);

  const hookNoteMeasured = evidence.hasFrames
    ? evidence.notes.find((note) => note.includes('שלוש השניות')) || evidence.notes[1] || 'הפתיחה נמדדה לפי שינוי ויזואלי וחדות.'
    : '';
  const visualNoteMeasured = evidence.hasFrames ? evidence.notes[1] : '';
  const platformNoteMeasured = Number(input?.height) > Number(input?.width)
    ? 'הפורמט אנכי ומתאים יותר לרילס/טיקטוק.'
    : 'הפורמט אינו אנכי, וזה פוגע בהתאמה לפלטפורמות קצרות.';
  const scoreOpts = { hasVision, measuredWeight: hasVision ? 0.3 : 0.55 };
  const categoryDetailNote = (key, fallback) => formatCategoryNoteFromDetail(aiCategoryDetails[key], fallback);
  const measuredEvidence = buildMeasuredEvidence(enrichedInput, evidence, content, audio);
  const measuredFindings = buildMeasuredFindings(
    enrichedInput,
    evidence,
    content,
    audio,
    data?.speechMetrics,
    data?.pacingMetrics,
  );
  if (transcript && !transcript.startsWith('(')) {
    measuredEvidence.unshift({
      source: 'transcript',
      label: 'תמלול Whisper',
      value: transcript.split('\n').slice(0, 3).join(' · ').slice(0, 220),
      implication: 'ניתוח מסר ו-CTA מבוסס על דיבור אמיתי',
    });
  }

  const mergedCategories = {
    ...categories,
    hook: {
      ...categories.hook,
      score: pickScore(evidence.scores.hook, categories.hook?.score, categories.hook?.note, scoreOpts),
      note: categoryDetailNote('hook', pickNote(hookNoteMeasured, categories.hook?.note, 'בדוק שהפתיחה עוצרת גלילה תוך 3 שניות.', hasVision)),
      detail: aiCategoryDetails.hook || null,
    },
    pacing: {
      ...categories.pacing,
      score: pickScore(evidence.scores.pacing, categories.pacing?.score, categories.pacing?.note, scoreOpts),
      note: categoryDetailNote('pacing', pickNote(
        evidence.hasFrames ? 'הקצב נמדד לפי שינויי סצנה בין פריימים.' : '',
        categories.pacing?.note,
        'שמור על שינוי ויזואלי כל 1-2 שניות.',
        hasVision,
      )),
      detail: aiCategoryDetails.pacing || null,
    },
    visual: {
      ...categories.visual,
      score: pickScore(evidence.scores.visual, categories.visual?.score, categories.visual?.note, { ...scoreOpts, measuredWeight: hasVision ? 0.25 : 0.6 }),
      note: categoryDetailNote('visual', pickNote(visualNoteMeasured, categories.visual?.note, 'שפר תאורה, חדות וקונטרסט.', hasVision)),
      detail: aiCategoryDetails.visual || null,
    },
    message: {
      ...categories.message,
      score: pickScore(content.scores.message, categories.message?.score, categories.message?.note, { measuredWeight: 0.4 }),
      note: categoryDetailNote('message', pickNote(
        transcript && !transcript.startsWith('(') ? 'נבדק לפי תמלול Whisper.' : content.contentBrief ? 'נבדק לפי תיאור התוכן.' : '',
        categories.message?.note,
        'חדד הבטחה ו-CTA אחד.',
        asText(categories.message?.note).length > 28,
      )),
      detail: aiCategoryDetails.message || null,
    },
    audio: {
      ...categories.audio,
      score: pickScore(audio.score, categories.audio?.score, categories.audio?.note, { measuredWeight: input?.audioMetrics?.analyzed ? 0.55 : 0.35 }),
      note: categoryDetailNote('audio', pickNote(audio.notes[0], categories.audio?.note, 'ודא שיש מוזיקה/דיבור ברור וכתוביות.', asText(categories.audio?.note).length > 28)),
      detail: aiCategoryDetails.audio || null,
    },
    platformFit: {
      ...categories.platformFit,
      score: pickScore(evidence.scores.platformFit, categories.platformFit?.score, categories.platformFit?.note, scoreOpts),
      note: categoryDetailNote('platformFit', pickNote(platformNoteMeasured, categories.platformFit?.note, 'התאם לפורמט ולאורך של TikTok/Reels.', hasVision)),
      detail: aiCategoryDetails.platformFit || null,
    },
  };

  const categoryScores = Object.values(mergedCategories).map((cat) => cat.score);
  const overallScore = hasVision && aiScore
    ? Math.round((aiScore + categoryScores.reduce((sum, s) => sum + s, 0)) / (categoryScores.length + 1))
    : Math.round(categoryScores.reduce((sum, s) => sum + s, 0) / categoryScores.length);
  const aiSummary = asText(aiAnalysis.summary);
  const digestFindings = Array.isArray(input?.analysisDigest?.findings) ? input.analysisDigest.findings : [];
  const priorityFixes = recommendations.priority.slice(0, 6);
  const aiTimeline = normalizeTimeline(aiAnalysis.timeline);
  const timeline = aiTimeline.length >= 4 ? aiTimeline : uniqueTimeline([...aiTimeline, ...evidence.timeline]).slice(0, 12);
  const aiDetailedFindings = Array.isArray(aiAnalysis.detailedFindings) ? aiAnalysis.detailedFindings : [];
  const detailedFindings = [...aiDetailedFindings, ...measuredFindings]
    .filter((item, index, arr) => arr.findIndex((x) => x.finding === item.finding) === index)
    .slice(0, 12);

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
    transcript,
    whisperUsed: Boolean(data?.whisperUsed),
    speechMetrics: data?.speechMetrics || null,
    pacingMetrics: data?.pacingMetrics || null,
    costEstimate: data?.costEstimate || null,
    frameTimestamps: (input?.frameMetrics || []).map((frame) => frame.second).filter(Number.isFinite),
    dataSources: {
      frameCount: (input?.frameMetrics || []).length,
      visionFrames: (input?.frameImages || []).length,
      audioAnalyzed: Boolean(input?.audioMetrics?.analyzed),
      hasContentBrief: Boolean(content.contentBrief),
      hasTranscript: Boolean(transcript && !transcript.startsWith('(')),
    },
    analysis: {
      score: overallScore,
      verdict: asText(aiAnalysis.verdict, 'הניתוח הושלם.'),
      summary: [
        aiSummary || (evidence.hasFrames
          ? `${evidence.notes[0]} ${evidence.notes[1]}`
          : 'לא התקבלו דגימות פריימים — הניתוח הוויזואלי מוגבל.'),
        hasVision ? `נותחו ${input.frameImages.length} פריימים ב-Vision.` : '',
        transcript && !transcript.startsWith('(') ? 'נוסף תמלול Whisper לניתוח מסר מדויק.' : '',
        input?.audioMetrics?.analyzed ? 'נותח גם מסלול האודיו מהקובץ.' : '',
        digestFindings.length ? `ממצאים: ${digestFindings.slice(0, 2).join(' · ')}` : '',
        !content.contentBrief ? 'טיפ: מילוי תיאור התוכן משפר משמעותית את דיוק ניתוח המסר.' : '',
      ].filter(Boolean).join(' '),
      categories: mergedCategories,
      priorityFixes,
      whyItFailed: recommendations.why,
      whatToChange: recommendations.changes,
      howToImprove: recommendations.improve,
      hookSuggestion: recommendations.hookSuggestion,
      scriptSuggestion: recommendations.scriptSuggestion,
      platformTips: recommendations.platformTips,
      timeline,
      measuredEvidence,
      detailedFindings,
      onScreenText: asArray(aiAnalysis.onScreenText, 8),
    },
  };
}

function uniqueTimeline(items) {
  const seen = new Set();
  return items
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      second: Math.max(0, Math.round(Number(item.second) || 0)),
      note: asText(item.note),
    }))
    .filter((item) => {
      if (!item.note) return false;
      const key = `${item.second}:${item.note.slice(0, 40)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.second - b.second);
}

function isStaleAnalysis(data) {
  const verdict = asText(data?.analysis?.verdict);
  const summary = asText(data?.analysis?.summary);
  return (
    verdict.includes('לא ניתן לנתח')
    || summary.includes('נדרש פלט תקין')
    || Number(data?.analysis?.score) === 0
  );
}

function isOpenAiKeyError(message) {
  return /incorrect api key|invalid api key|invalid_api_key|authentication|401|api key/i.test(String(message));
}

async function fetchSupabase(method, body) {
  const upstream = await fetch(functionUrl, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
  });
  const text = await upstream.text();
  return { upstream, text };
}

async function trySupabaseAnalysis(body) {
  const { upstream, text } = await fetchSupabase('POST', body);
  if (!upstream.ok) return null;
  const parsed = JSON.parse(text);
  return isStaleAnalysis(parsed) ? null : parsed;
}

function normalizeTeaserUpstream(data, input) {
  const analysis = data?.analysis && typeof data.analysis === 'object' ? data.analysis : {};
  return {
    isTeaser: true,
    demo: false,
    simplified: true,
    durationSec: Number(data?.durationSec) || Number(input?.durationSec) || 60,
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
    whisperUsed: false,
    speechMetrics: null,
    pacingMetrics: null,
    costEstimate: data?.costEstimate || null,
    frameTimestamps: (input?.frameMetrics || []).map((f) => f.second).filter(Number.isFinite),
    dataSources: {
      frameCount: (input?.frameMetrics || []).length,
      visionFrames: 0,
      audioAnalyzed: Boolean(input?.audioMetrics?.analyzed),
      hasContentBrief: Boolean(input?.contentBrief?.trim()),
      hasTranscript: false,
      teaser: true,
    },
    analysis: {
      score: clampScore(analysis.score),
      verdict: asText(analysis.verdict),
      summary: asText(analysis.summary),
      categories: analysis.categories || {},
      priorityFixes: [],
      whyItFailed: [],
      whatToChange: [],
      howToImprove: [],
      hookSuggestion: '',
      scriptSuggestion: '',
      platformTips: [],
      timeline: [],
      measuredEvidence: [],
      detailedFindings: [],
      onScreenText: [],
      teaserLockedHint: asText(analysis.teaserLockedHint),
    },
  };
}

async function runAnalysis(body, openaiKey, { teaser = false } = {}) {
  if (openaiKey) {
    try {
      if (teaser) {
        const upstream = await runTeaserAnalysis(body || {}, openaiKey);
        return { ok: true, data: normalizeTeaserUpstream(upstream, body || {}) };
      }
      const upstream = await runOpenAiAnalysis(body || {}, openaiKey);
      return { ok: true, data: normalizeUpstream(upstream, body || {}) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!isOpenAiKeyError(message)) {
        return { ok: false, status: 500, error: message };
      }
    }
  }

  const supabaseResult = await trySupabaseAnalysis(body || {});
  if (supabaseResult) {
    return { ok: true, data: normalizeUpstream(supabaseResult, body || {}) };
  }

  return {
    ok: false,
    status: 503,
    error: 'ניתוח AI לא זמין. הוסף OPENAI_API_KEY תקין ב-Vercel Environment Variables, או פרוס מחדש את Supabase Function analyze.',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Device-Fingerprint, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (!['GET', 'POST'].includes(req.method)) {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();

  try {
    const usage = await resolveAnalysisAccess(req, {
      requireAuth: req.method === 'POST',
    });

    if (req.method === 'GET') {
      const healthExtras = {
        ...accessHealthExtras(usage),
        paymentConfigured: isCardcomConfigured(),
      };
      if (openaiKey) {
        sendJson(res, 200, { ...getHealthInfo(openaiKey), ...healthExtras });
        return;
      }
      const { upstream, text } = await fetchSupabase('GET');
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = {};
      }
      if (upstream.ok && payload && typeof payload === 'object') {
        Object.assign(payload, healthExtras);
        sendJson(res, upstream.status, payload);
        return;
      }
      res.status(upstream.status).setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
      res.send(text);
      return;
    }

    if (!usage.allowed) {
      sendJson(res, usage.status || 402, accessLimitResponse(usage));
      return;
    }

    const isTeaser = usage.mode === 'teaser';
    const analysisResult = await runAnalysis(req.body || {}, openaiKey, { teaser: isTeaser });
    if (!analysisResult.ok) {
      sendJson(res, analysisResult.status, { error: analysisResult.error });
      return;
    }

    if (usage.mode === 'full' && usage.emailHash) {
      try {
        const remaining = await deductCredit(usage.emailHash);
        analysisResult.data.analysisCredits = remaining;
        analysisResult.data.isTeaser = false;
      } catch (err) {
        sendJson(res, 402, { error: err instanceof Error ? err.message : 'אין יתרת ניתוחים' });
        return;
      }
    } else if (usage.mode === 'teaser') {
      await markFreeUsageUsed(req, res, usage);
      analysisResult.data.isTeaser = true;
    }

    sendJson(res, 200, analysisResult.data);
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : 'Proxy error' });
  }
}
