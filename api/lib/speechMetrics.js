const CTA_PATTERN = /(שלח|לחץ|כתוב|שמור|עקוב|קנה|דברו|השאירו|תגובה|לינק|ביו|וואטסאפ|whatsapp|dm|direct|הירשם|הצטרף|לחצו|עקבו)/i;
const HOOK_PATTERN = /[?]|(איך|למה|כמה|מה|טעות|סוד|לפני|אחרי|אל|בלי|אם|תראו|תקשיבו|עצור|stop|wait)/i;

function parseSegments(transcription, formattedText = '') {
  if (Array.isArray(transcription?.segments) && transcription.segments.length) {
    return transcription.segments
      .filter((seg) => seg && typeof seg.text === 'string' && seg.text.trim())
      .map((seg) => ({
        start: Math.max(0, Number(seg.start) || 0),
        end: Math.max(0, Number(seg.end) || Number(seg.start) || 0),
        text: seg.text.trim(),
      }));
  }

  if (!formattedText || formattedText.startsWith('(')) return [];

  return formattedText
    .split('\n')
    .map((line) => {
      const match = line.match(/^\[(\d+(?:\.\d+)?)s\]\s*(.+)$/);
      if (!match) return null;
      const start = Number(match[1]);
      return { start, end: start + 2, text: match[2].trim() };
    })
    .filter(Boolean);
}

export function analyzeSpeechMetrics(transcription, formattedText = '', durationSec = 60) {
  const segments = parseSegments(transcription, formattedText);
  const duration = Math.min(Math.max(Number(durationSec) || 60, 1), 60);

  if (!segments.length) {
    return {
      hasSpeech: false,
      wordCount: 0,
      wpm: null,
      hookSpeechSec: null,
      hookHasSpeech: false,
      hookHasQuestionOrTension: false,
      ctaAtSec: null,
      ctaInLastThird: false,
      longestPauseSec: null,
      pauseAfterHookSec: null,
      findings: ['אין תמלול דיבור — ניתוח מסר מבוסס על תיאור היוצר / כתוביות'],
      fixes: [],
    };
  }

  const fullText = segments.map((s) => s.text).join(' ');
  const words = fullText.split(/\s+/).filter(Boolean);
  const spokenSec = Math.max(
    1,
    segments.reduce((max, seg) => Math.max(max, seg.end), 0) - segments[0].start,
  );
  const wpm = Math.round((words.length / spokenSec) * 60);

  const hookSegments = segments.filter((seg) => seg.start < 3);
  const hookSpeechSec = hookSegments.length ? Math.min(...hookSegments.map((s) => s.start)) : null;
  const hookText = hookSegments.map((s) => s.text).join(' ');
  const hookHasSpeech = hookSegments.length > 0;
  const hookHasQuestionOrTension = HOOK_PATTERN.test(hookText);

  const lastThirdStart = duration * 0.66;
  const ctaSegment = [...segments].reverse().find((seg) => CTA_PATTERN.test(seg.text));
  const ctaAtSec = ctaSegment ? Math.round(ctaSegment.start * 10) / 10 : null;
  const ctaInLastThird = ctaSegment ? ctaSegment.start >= lastThirdStart : false;

  let longestPauseSec = 0;
  let pauseAfterHookSec = null;
  for (let i = 1; i < segments.length; i += 1) {
    const gap = segments[i].start - segments[i - 1].end;
    if (gap > longestPauseSec) longestPauseSec = gap;
    if (segments[i - 1].end <= 3 && segments[i].start > 3 && pauseAfterHookSec === null) {
      pauseAfterHookSec = Math.round(gap * 10) / 10;
    }
  }

  const findings = [];
  const fixes = [];

  if (!hookHasSpeech) {
    findings.push('אין דיבור ב-0–3 שניות — Hook מילולי חסר');
    fixes.push('התחל לדבר מיד בשנייה 0, או הוסף טקסט גדול על המסך עם מתח/שאלה');
  } else if (hookSpeechSec > 1.5) {
    findings.push(`דיבור מתחיל רק ב-${hookSpeechSec}s — מאוחר ל-Hook`);
    fixes.push('חתוך שקט/הקדמה — המשפט הראשון חייב להישמע לפני שניה 1');
  }

  if (hookHasSpeech && !hookHasQuestionOrTension) {
    findings.push('ב-Hook המילולי אין שאלה/מתח ברור');
    fixes.push('פתח בשאלה או בהבטחה: "למה X?" / "טעות שכולם עושים"');
  }

  if (wpm > 185) {
    findings.push(`קצב דיבור מהיר (${wpm} מילים/דקה) — קשה לעקוב`);
    fixes.push('האט 10–15%, הוסף jump cuts וכתוביות');
  } else if (wpm < 95 && words.length > 8) {
    findings.push(`קצב דיבור איטי (${wpm} מילים/דקה) — סיכון לגלילה`);
    fixes.push('קצר משפטים, הוסף שינוי ויזואלי כל 1–2 שניות');
  }

  if (longestPauseSec > 2.5) {
    findings.push(`שקט ארוך של ${Math.round(longestPauseSec * 10) / 10} שניות באמצע`);
    fixes.push('מלא שקטים ב-b-roll, zoom, או טקסט — אל תשאיר dead air');
  }

  if (pauseAfterHookSec !== null && pauseAfterHookSec > 1.2) {
    findings.push(`שקט של ${pauseAfterHookSec}s מיד אחרי ה-Hook`);
    fixes.push('אחרי המשפט הראשון — המשך מיד עם ערך/הוכחה, בלי הפסקה');
  }

  if (!ctaSegment) {
    findings.push('לא זוהה CTA מילולי בתמלול');
    fixes.push('סיים במשפט פעולה אחד: "שלח/כתוב/שמור/עקוב..."');
  } else if (!ctaInLastThird) {
    findings.push(`CTA מופיע ב-${ctaAtSec}s — לא בסוף`);
    fixes.push('העבר את ה-CTA ל-5 השניות האחרונות בלבד');
  }

  return {
    hasSpeech: true,
    wordCount: words.length,
    wpm,
    hookSpeechSec,
    hookHasSpeech,
    hookHasQuestionOrTension,
    ctaAtSec,
    ctaInLastThird,
    longestPauseSec: longestPauseSec ? Math.round(longestPauseSec * 10) / 10 : 0,
    pauseAfterHookSec,
    findings,
    fixes,
  };
}

export function formatSpeechMetrics(metrics) {
  if (!metrics) return 'לא חושבו מדדי דיבור.';
  if (!metrics.hasSpeech) return metrics.findings?.[0] || 'אין דיבור בתמלול.';

  return [
    `- מילים: ${metrics.wordCount} · קצב: ${metrics.wpm} מילים/דקה`,
    `- דיבור ב-Hook (0-3 שנ'): ${metrics.hookHasSpeech ? `כן (מ-${metrics.hookSpeechSec}s)` : 'לא'}`,
    `- מתח/שאלה ב-Hook: ${metrics.hookHasQuestionOrTension ? 'כן' : 'לא'}`,
    `- CTA מילולי: ${metrics.ctaAtSec != null ? `ב-${metrics.ctaAtSec}s` : 'לא זוהה'}`,
    metrics.longestPauseSec ? `- השהיה ארוכה: ${metrics.longestPauseSec}s` : '',
    metrics.findings?.length ? `ממצאים:\n${metrics.findings.map((f) => `  • ${f}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');
}
