import { CATEGORY_LABELS, clampScore, normalizeAnalysis, PLATFORM_LABELS } from './utils.js';

// Deterministic pseudo-random from a seed so the same video gives a stable demo.
function seeded(seed) {
  let s = Math.floor(seed) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

const HOOK_NOTES = [
  'הפתיחה איטית — אין משהו שמכריח לעצור גלילה',
  'אין curiosity gap ב-3 השניות הראשונות',
  'הפתיחה בסדר אבל לא יוצאת דופן',
];
const PACING_NOTES = [
  'יש קטעים מתים שמורידים אנרגיה',
  'הקצב סביר אבל אפשר יותר jump cuts',
  'מעברים חלקים, האנרגיה נשמרת',
];
const CTA_NOTES = [
  'אין קריאה לפעולה ברורה בסוף',
  'המסר ברור אבל ה-CTA חלש',
  'יש מסר, כדאי לחזק קריאה לפעולה',
];

const PRIORITY_POOL = [
  'התחל עם המשפט הכי חזק שלך כבר בשנייה 0',
  'הוסף טקסט גדול על המסך בפתיחה',
  'סיים ב-CTA ברור: "עקבו", "שמרו" או "שתפו"',
  'קצר את הפתיחה — רד ישר לעניין',
  'הוסף כתוביות לכל הסרטון (רוב הצופים בלי סאונד)',
];

const WHY_POOL = [
  'הפתיחה לא יוצרת סקרנות — אין סיבה לעצור',
  'אין קריאה לפעולה — הצופה לא יודע מה לעשות הלאה',
  'הטקסט על המסך קטן מדי לצפייה במובייל',
  'יש ירידת אנרגיה באמצע שגורמת לנטישה',
];

const CHANGE_POOL = [
  'חתוך את השניות הראשונות והתחל מה-hook',
  'הגדל את הטקסט על המסך פי שניים',
  'הוסף משפט CTA אחד בסוף',
  'הוסף jump cut כל 2–3 שניות',
];

const IMPROVE_POOL = [
  'נסה פתיחה בנוסח "עשיתי טעות ש..." או "אף אחד לא מספר לכם ש..."',
  'בדוק את הסרטון בלי סאונד — האם עדיין מובן?',
  'שים מוזיקה טרנדית ברקע בעוצמה נמוכה',
  'הוסף proof / הדגמה כדי לבסס אמינות',
];

const HOOK_SUGGESTIONS = [
  'עשיתי את הטעות הזאת שנים — ואתם כנראה עושים אותה עכשיו',
  'אל תעלו עוד רילס לפני שאתם יודעים את זה',
  '3 שניות. זה כל מה שיש לכם כדי לתפוס אותם. ככה עושים את זה:',
];

export function buildDemoAnalysis(meta, { platform, goal, problem } = {}) {
  const duration = Math.max(1, Math.round(meta?.durationSec || 24));
  const rand = seeded(duration * 1000 + (meta?.width || 1080));
  const platformLabel = PLATFORM_LABELS[platform] || 'TikTok';

  const hookScore = clampScore(2 + Math.floor(rand() * 4));
  const pacingScore = clampScore(4 + Math.floor(rand() * 4));
  const messageScore = clampScore(5 + Math.floor(rand() * 4));
  const visualScore = clampScore(meta?.isVertical === false ? 3 + Math.floor(rand() * 3) : 5 + Math.floor(rand() * 4));
  const audioScore = clampScore(5 + Math.floor(rand() * 5));
  const platformFitScore = clampScore(
    (duration > 60 ? 3 : duration < 7 ? 5 : 7) + Math.floor(rand() * 3)
  );

  const verticalNote = meta?.isVertical === false
    ? 'הסרטון לא אנכי (9:16) — מאבד נדל"ן יקר על המסך בטיקטוק ורילס'
    : `${duration} שניות — אורך טוב, אבל ה-hook הוא מה שמכריע`;

  const fixes = [...PRIORITY_POOL].sort(() => rand() - 0.5).slice(0, 3);
  if (meta?.isVertical === false) {
    fixes.unshift('צלם מחדש בפורמט אנכי (9:16) — קריטי לטיקטוק ורילס');
    fixes.pop();
  }

  const raw = {
    score: clampScore(
      Math.round((hookScore + pacingScore + messageScore + visualScore + audioScore + platformFitScore) / 6)
    ),
    verdict:
      hookScore <= 4
        ? 'יש בסיס טוב — אבל הפתיחה לא עוצרת גלילה'
        : 'סרטון מבטיח — כמה חידודים יעלו אותו מדרגה',
    summary:
      `ניתוח לדוגמה עבור ${platformLabel}. ` +
      `${goal ? `המטרה שציינת: ${goal}. ` : ''}` +
      `${problem ? `הבעיה שתיארת: ${problem}. ` : ''}` +
      'הנקודה הקריטית ביותר היא ה-hook ב-3 השניות הראשונות, ואחריו קריאה לפעולה ברורה בסוף.',
    categories: {
      hook: { score: hookScore, label: CATEGORY_LABELS.hook, note: pick(rand, HOOK_NOTES) },
      pacing: { score: pacingScore, label: CATEGORY_LABELS.pacing, note: pick(rand, PACING_NOTES) },
      message: { score: messageScore, label: CATEGORY_LABELS.message, note: pick(rand, CTA_NOTES) },
      visual: {
        score: visualScore,
        label: CATEGORY_LABELS.visual,
        note: meta?.isVertical === false ? 'פורמט לא אנכי — בעיה משמעותית' : 'ויזואל סביר, אפשר לחזק טקסט על המסך',
      },
      audio: { score: audioScore, label: CATEGORY_LABELS.audio, note: 'בדוק שהדיבור ברור והמוזיקה לא מסתירה' },
      platformFit: { score: platformFitScore, label: CATEGORY_LABELS.platformFit, note: verticalNote },
    },
    priorityFixes: fixes,
    whyItFailed: [...WHY_POOL].sort(() => rand() - 0.5).slice(0, 3),
    whatToChange: [...CHANGE_POOL].sort(() => rand() - 0.5).slice(0, 3),
    howToImprove: [...IMPROVE_POOL].sort(() => rand() - 0.5).slice(0, 3),
    hookSuggestion: pick(rand, HOOK_SUGGESTIONS),
    scriptSuggestion:
      `0-3s:  ${pick(rand, HOOK_SUGGESTIONS)} [טקסט גדול על המסך]\n` +
      `3-${Math.max(4, duration - 5)}s: הסבר/הדגמה עם jump cuts לשמירת אנרגיה\n` +
      `${Math.max(4, duration - 5)}-${duration}s: קריאה לפעולה ברורה + הצבעה למעלה`,
    platformTips: [
      `ב-${platformLabel} — ה-hook חייב להופיע בשנייה 0`,
      'הוסף כתוביות — רוב הצפייה בלי סאונד',
      'פרסם בשעות שיא (18:00–22:00 לקהל ישראלי)',
    ],
    timeline: [
      { second: 0, note: 'נקודת ההכרעה — האם ה-hook עוצר גלילה?' },
      { second: Math.round(duration * 0.4), note: 'אמצע הסרטון — שמירת אנרגיה קריטית כאן' },
      { second: Math.max(1, duration - 2), note: 'סוף — כאן צריכה להופיע קריאה לפעולה' },
    ],
  };

  return normalizeAnalysis(raw);
}
