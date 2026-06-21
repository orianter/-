export function analyzePacingMetrics(frameMetrics = [], audioMetrics = null, durationSec = 60) {
  const frames = Array.isArray(frameMetrics) ? frameMetrics.filter((f) => Number.isFinite(Number(f.second))) : [];
  const duration = Math.min(Math.max(Number(durationSec) || 60, 1), 60);
  const findings = [];
  const fixes = [];

  let longestStaticSec = 0;
  let staticStart = null;

  for (let i = 1; i < frames.length; i += 1) {
    const prev = frames[i - 1];
    const curr = frames[i];
    const gap = Number(curr.second) - Number(prev.second);
    const change = Number(curr.sceneChange) || 0;

    if (change < 6 && gap >= 1.5) {
      if (staticStart === null) staticStart = Number(prev.second);
      const stretch = Number(curr.second) - staticStart;
      if (stretch > longestStaticSec) longestStaticSec = stretch;
    } else {
      staticStart = null;
    }
  }

  if (longestStaticSec >= 3.5) {
    findings.push(`קטע סטטי של ~${Math.round(longestStaticSec)} שניות בלי שינוי ויזואלי`);
    fixes.push('הוסף jump cut, zoom, b-roll או טקסט כל 1–2 שניות');
  }

  const hookFrames = frames.filter((f) => Number(f.second) <= 3);
  const hookStatic = hookFrames.length > 1
    && hookFrames.slice(1).every((f) => (Number(f.sceneChange) || 0) < 6);
  if (hookStatic) {
    findings.push('ה-Hook הוויזואלי סטטי (0–3 שניות) — סיכון גבוה לגלילה');
    fixes.push('שנה פריים/זווית/טקסט כבר בשנייה 0.5–1');
  }

  let beatPeaks = 0;
  let beatAlignedCuts = 0;
  if (audioMetrics?.rmsWindows?.length > 4 && frames.length > 3) {
    const windows = audioMetrics.rmsWindows;
    const peaks = [];
    for (let i = 1; i < windows.length - 1; i += 1) {
      const prev = windows[i - 1].rms;
      const curr = windows[i].rms;
      const next = windows[i + 1].rms;
      if (curr > prev && curr > next && curr > (audioMetrics.avgVolume || 0.03) * 1.15) {
        peaks.push(Number(windows[i].second) || 0);
      }
    }
    beatPeaks = peaks.length;

    const cutTimes = frames.slice(1)
      .filter((f) => (Number(f.sceneChange) || 0) >= 12)
      .map((f) => Number(f.second));

    for (const cut of cutTimes) {
      const nearBeat = peaks.some((p) => Math.abs(p - cut) <= 0.6);
      if (nearBeat) beatAlignedCuts += 1;
    }

    if (beatPeaks >= 4 && cutTimes.length >= 2) {
      const ratio = cutTimes.length ? beatAlignedCuts / cutTimes.length : 0;
      if (ratio < 0.35) {
        findings.push('חיתוכים לא מסונכרנים לביטים/פיקים באודיו');
        fixes.push('יישר jump cuts לפיקים במוזיקה — זה מרגיש מקצועי יותר');
      } else if (ratio >= 0.6) {
        findings.push('חיתוכים מסונכרנים יחסית לפיקים באודיו ✓');
      }
    }
  }

  return {
    longestStaticSec: Math.round(longestStaticSec * 10) / 10,
    hookVisuallyStatic: hookStatic,
    beatPeaks,
    beatAlignedCuts,
    findings,
    fixes,
  };
}

export function formatPacingMetrics(metrics) {
  if (!metrics) return '';
  return [
    metrics.longestStaticSec ? `- קטע סטטי ארוך: ~${metrics.longestStaticSec}s` : '',
    metrics.hookVisuallyStatic ? '- Hook ויזואלי סטטי (0-3 שנ\')' : '',
    metrics.beatPeaks ? `- פיקי אודיו: ${metrics.beatPeaks}${metrics.beatAlignedCuts ? ` · חיתוכים על ביט: ${metrics.beatAlignedCuts}` : ''}` : '',
    metrics.findings?.length ? metrics.findings.map((f) => `  • ${f}`).join('\n') : '',
  ].filter(Boolean).join('\n');
}
