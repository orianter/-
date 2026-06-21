/**
 * Comprehensive live + structure tests for the analyze API.
 * Usage: node scripts/test-comprehensive.mjs
 *        ANALYZE_URL=https://... node scripts/test-comprehensive.mjs
 */

const BASE = process.env.ANALYZE_URL || 'https://reelzanalyze1.vercel.app/api/analyze';
const CATEGORY_KEYS = ['hook', 'pacing', 'message', 'visual', 'audio', 'platformFit'];

const fullPayload = {
  platform: 'tiktok',
  goal: 'לידים',
  problem: 'אנשים יוצאים מהסרטון אחרי 2 שניות',
  audience: 'בעלי עסקים קטנים',
  contentBrief:
    '0-2 שנ: "אם העסק שלך תקוע ב-0 לידים — תראה את זה". יש טקסט על המסך. בסוף: כתוב לי "לידים" בוואטסאפ.',
  fileName: 'test-reel.mp4',
  fileType: 'video/mp4',
  fileSizeMb: 8.2,
  durationSec: 28,
  width: 1080,
  height: 1920,
  frameMetrics: [
    { second: 0.5, brightness: 120, contrast: 45, sharpness: 18, colorfulness: 22, darkRatio: 8, brightRatio: 3, sceneChange: 0 },
    { second: 1, brightness: 115, contrast: 42, sharpness: 16, colorfulness: 20, darkRatio: 10, brightRatio: 4, sceneChange: 12 },
    { second: 3, brightness: 130, contrast: 50, sharpness: 20, colorfulness: 25, darkRatio: 6, brightRatio: 5, sceneChange: 18 },
    { second: 14, brightness: 125, contrast: 48, sharpness: 19, colorfulness: 24, darkRatio: 7, brightRatio: 4, sceneChange: 15 },
    { second: 26, brightness: 118, contrast: 40, sharpness: 17, colorfulness: 21, darkRatio: 9, brightRatio: 3, sceneChange: 10 },
  ],
  audioMetrics: {
    analyzed: true,
    hasAudio: true,
    avgVolume: 0.08,
    hookVolume: 0.05,
    silentRatio: 12,
    hookSilentRatio: 33,
    openingWeak: true,
    mostlySilent: false,
  },
  analysisDigest: {
    frameCount: 5,
    durationSec: 28,
    aspectRatio: 1.78,
    isVertical916: true,
    hookSceneChange: 12,
    avgSceneChange: 14,
    findings: ['פורמט אנכי 9:16', 'עוצמת האודיו בפתיחה חלשה'],
  },
};

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

async function testHealth() {
  const res = await fetch(BASE, { method: 'GET' });
  assert(res.ok, `GET ${res.status}`);
  const data = await res.json();
  assert(data.ok === true, 'health ok');
  assert(data.maxDurationSec === 60, 'maxDurationSec');
  assert(data.maxFileMb === 100, 'maxFileMb');
  ok(`GET health (${data.service || 'ok'})`);
  return data;
}

function validateAnalysis(data, { label, requireBrief = true }) {
  const a = data.analysis;
  assert(a, `${label}: missing analysis`);
  assert(a.score >= 1 && a.score <= 10, `${label}: score`);
  assert(asText(a.verdict).length > 10, `${label}: verdict`);
  assert(asText(a.summary).length > 30, `${label}: summary`);
  assert(!asText(a.verdict).includes('לא ניתן לנתח'), `${label}: stale verdict`);
  assert(!asText(a.summary).includes('נדרש פלט תקין'), `${label}: stale summary`);

  for (const key of CATEGORY_KEYS) {
    assert(a.categories?.[key]?.score >= 1, `${label}: category ${key}`);
    assert(asText(a.categories?.[key]?.note).length > 8, `${label}: note ${key}`);
  }

  assert(a.priorityFixes?.length >= 1, `${label}: priorityFixes`);
  assert(a.whyItFailed?.length >= 1, `${label}: whyItFailed`);
  assert(a.whatToChange?.length >= 1, `${label}: whatToChange`);
  assert(a.howToImprove?.length >= 1, `${label}: howToImprove`);
  assert(a.platformTips?.length >= 1, `${label}: platformTips`);
  assert(a.timeline?.length >= 1, `${label}: timeline`);
  assert(a.detailedFindings?.length >= 1, `${label}: detailedFindings`);
  assert(a.measuredEvidence?.length >= 1, `${label}: measuredEvidence`);
  assert(asText(a.hookSuggestion).length > 15, `${label}: hookSuggestion`);
  assert(asText(a.scriptSuggestion).length > 30, `${label}: scriptSuggestion`);

  assert(data.dataSources?.frameCount >= 1, `${label}: dataSources.frameCount`);
  if (requireBrief) assert(data.dataSources?.hasContentBrief === true, `${label}: hasContentBrief`);
  assert(data.durationSec > 0, `${label}: durationSec`);
  assert(data.videoMeta?.width > 0, `${label}: videoMeta.width`);
}

function asText(v) {
  return typeof v === 'string' ? v.trim() : '';
}

async function testPost(payload, options) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  assert(res.ok, `${options.label} POST ${res.status}: ${data.error || ''}`);
  validateAnalysis(data, options);
  ok(`${options.label} — score ${data.analysis.score}/10, ${data.analysis.detailedFindings.length} findings`);
  return data;
}

async function testRejectLongVideo() {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...fullPayload, durationSec: 90 }),
  });
  const data = await res.json();
  assert(!res.ok || data.error, 'long video should fail');
  ok('rejects video over 60 seconds');
}

async function main() {
  console.log('Comprehensive tests:', BASE);
  console.log('');

  try {
    await testHealth();
    await testPost(fullPayload, { label: 'Full payload', requireBrief: true });

    const minimal = {
      platform: 'reels',
      fileName: 'short.mp4',
      fileType: 'video/mp4',
      durationSec: 15,
      width: 1080,
      height: 1920,
      frameMetrics: fullPayload.frameMetrics.slice(0, 3),
      audioMetrics: { analyzed: false },
      analysisDigest: { frameCount: 3, durationSec: 15, findings: ['פורמát אנכי'] },
    };
    await testPost(minimal, { label: 'Minimal payload', requireBrief: false });

    const horizontal = {
      ...fullPayload,
      platform: 'both',
      width: 1920,
      height: 1080,
      analysisDigest: { ...fullPayload.analysisDigest, isVertical916: false, findings: ['פורמát לא אנכי'] },
    };
    const hData = await testPost(horizontal, { label: 'Horizontal video', requireBrief: true });
    const platformNote = asText(hData.analysis.categories?.platformFit?.note);
    assert(
      platformNote.includes('אנכי') || hData.analysis.detailedFindings.some((f) => /אנכי|פורמát|9:16/i.test(JSON.stringify(f))),
      'horizontal should flag format',
    );
    ok('horizontal video flags format issue');

    await testRejectLongVideo();
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${err.message}`);
    process.exit(1);
  }

  console.log('');
  console.log(`All ${passed} comprehensive checks passed.`);
}

main();
