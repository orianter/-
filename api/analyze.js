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
  const { goal, problem, audience, contentBrief } = content;

  if (audience) {
    message += 1;
    notes.push(`קהל יעד מוגדר: ${audience}.`);
  }
  if (goal) {
    message += 1;
    notes.push(`מטרה: ${goal}.`);
  }
  if (problem) notes.push(`בעיה שדווחה: ${problem}.`);

  if (contentBrief) {
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
    notes.push('לא סופק תיאור תוכן — ניתוח המסר מוגבל.');
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
  const hasContext = Boolean(goal || problem || audience || contentBrief);
  const notes = [];
  const fixes = [];
  const scores = contentScores({ goal, problem, audience, contentBrief });

  notes.push(...scores.notes);

  if (!audience) {
    notes.push('לא הוגדר קהל יעד ברור, ולכן קשה לדעת למי ההבטחה בסרטון אמורה לדבר.');
    fixes.push('פתח את הסרטון בפנייה ישירה לקהל יעד אחד, למשל: "בעלי עסקים שמעלים רילס ולא מקבלים פניות".');
  }
  if (!goal) {
    notes.push('לא הוגדרה מטרה עסקית/תוכנית ברורה לסרטון.');
    fixes.push('בחר מטרה אחת לסרטון: צפיות, לידים, מכירה, שמירה, או תגובות. אל תנסה הכל יחד.');
  }
  if (!contentBrief) {
    notes.push('לא סופק תיאור של מה נאמר או כתוב בסרטון, לכן הניתוח של המסר מוגבל ולא ימציא תמלול.');
    fixes.push('הוסף משפט פתיחה, מה רואים על המסך ומה ה-CTA כדי לקבל ניתוח מסר הרבה יותר מדויק.');
  } else {
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

function unique(items, max = 8) {
  return [...new Set(items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))].slice(0, max);
}

function deepRecommendations({ input, evidence, content, audio, upstream }) {
  const durationSec = Number(input?.durationSec) || 60;
  const isVertical = Number(input?.height) > Number(input?.width);
  const goal = content.goal || 'המטרה שלא הוגדרה';
  const audience = content.audience || 'קהל יעד לא מוגדר';
  const reportedProblem = content.problem || 'לא צוין';
  const ai = upstream?.analysis && typeof upstream.analysis === 'object' ? upstream.analysis : {};
  const hasAiPriority = asArray(ai.priorityFixes).length >= 3;
  const hasAiWhy = asArray(ai.whyItFailed).length >= 2;

  const priority = [];
  const why = [];
  const changes = [];
  const improve = [];
  const platformTips = [];

  if (!hasAiPriority) {
    priority.push(...evidence.fixes, ...content.fixes, ...audio.fixes);
  }
  if (!hasAiWhy) {
    why.push(...evidence.notes.slice(2), ...content.notes, ...audio.notes);
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
    priority: unique([...asArray(upstream?.analysis?.priorityFixes), ...priority], 5),
    why: unique([...asArray(upstream?.analysis?.whyItFailed), ...why], 8),
    changes: unique([...asArray(upstream?.analysis?.whatToChange), ...changes], 8),
    improve: unique([...asArray(upstream?.analysis?.howToImprove), ...improve], 8),
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
  const evidence = visualEvidence(input);
  const content = contentEvidence(input);
  const audio = audioEvidence(input);
  const hasVision = Array.isArray(input?.frameImages) && input.frameImages.length > 0;
  const recommendations = deepRecommendations({ input, evidence, content, audio, upstream: data });
  const aiAnalysis = data?.analysis && typeof data.analysis === 'object' ? data.analysis : {};
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

  const mergedCategories = {
    ...categories,
    hook: {
      ...categories.hook,
      score: pickScore(evidence.scores.hook, categories.hook?.score, categories.hook?.note, scoreOpts),
      note: pickNote(hookNoteMeasured, categories.hook?.note, 'בדוק שהפתיחה עוצרת גלילה תוך 3 שניות.', hasVision),
    },
    pacing: {
      ...categories.pacing,
      score: pickScore(evidence.scores.pacing, categories.pacing?.score, categories.pacing?.note, scoreOpts),
      note: pickNote(
        evidence.hasFrames ? 'הקצב נמדד לפי שינויי סצנה בין פריימים.' : '',
        categories.pacing?.note,
        'שמור על שינוי ויזואלי כל 1-2 שניות.',
        hasVision,
      ),
    },
    visual: {
      ...categories.visual,
      score: pickScore(evidence.scores.visual, categories.visual?.score, categories.visual?.note, { ...scoreOpts, measuredWeight: hasVision ? 0.25 : 0.6 }),
      note: pickNote(visualNoteMeasured, categories.visual?.note, 'שפר תאורה, חדות וקונטרסט.', hasVision),
    },
    message: {
      ...categories.message,
      score: pickScore(content.scores.message, categories.message?.score, categories.message?.note, { measuredWeight: 0.4 }),
      note: pickNote(content.contentBrief ? 'נבדק לפי תיאור התוכן.' : '', categories.message?.note, 'חדד הבטחה ו-CTA אחד.', asText(categories.message?.note).length > 28),
    },
    audio: {
      ...categories.audio,
      score: pickScore(audio.score, categories.audio?.score, categories.audio?.note, { measuredWeight: input?.audioMetrics?.analyzed ? 0.55 : 0.35 }),
      note: pickNote(audio.notes[0], categories.audio?.note, 'ודא שיש מוזיקה/דיבור ברור וכתוביות.', asText(categories.audio?.note).length > 28),
    },
    platformFit: {
      ...categories.platformFit,
      score: pickScore(evidence.scores.platformFit, categories.platformFit?.score, categories.platformFit?.note, scoreOpts),
      note: pickNote(platformNoteMeasured, categories.platformFit?.note, 'התאם לפורמט ולאורך של TikTok/Reels.', hasVision),
    },
  };

  const categoryScores = Object.values(mergedCategories).map((cat) => cat.score);
  const overallScore = hasVision && aiScore
    ? Math.round((aiScore + categoryScores.reduce((sum, s) => sum + s, 0)) / (categoryScores.length + 1))
    : Math.round(categoryScores.reduce((sum, s) => sum + s, 0) / categoryScores.length);
  const aiSummary = asText(aiAnalysis.summary);
  const digestFindings = Array.isArray(input?.analysisDigest?.findings) ? input.analysisDigest.findings : [];
  const priorityFixes = recommendations.priority.slice(0, 5);
  const aiTimeline = normalizeTimeline(aiAnalysis.timeline);
  const timeline = aiTimeline.length >= 3 ? aiTimeline : (evidence.timeline.length ? evidence.timeline : aiTimeline);

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
    dataSources: {
      frameCount: (input?.frameMetrics || []).length,
      visionFrames: (input?.frameImages || []).length,
      audioAnalyzed: Boolean(input?.audioMetrics?.analyzed),
      hasContentBrief: Boolean(content.contentBrief),
    },
    analysis: {
      score: overallScore,
      verdict: asText(aiAnalysis.verdict, 'הניתוח הושלם.'),
      summary: [
        aiSummary || (evidence.hasFrames
          ? `${evidence.notes[0]} ${evidence.notes[1]}`
          : 'לא התקבלו דגימות פריימים — הניתוח הוויזואלי מוגבל.'),
        hasVision ? `נותחו ${input.frameImages.length} פריימים ב-Vision.` : '',
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
