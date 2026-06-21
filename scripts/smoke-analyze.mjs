const BASE = process.env.ANALYZE_URL || 'https://reelzanalyze1.vercel.app/api/analyze';

const mockPayload = {
  platform: 'tiktok',
  goal: 'לידים',
  problem: 'אנשים יוצאים מהסרטון אחרי 2 שניות',
  audience: 'בעלי עסקים קטנים',
  contentBrief:
    'אני אומר "אם העסק שלך תקוע ב-0 לידים — תראה את זה". יש טקסט על המסך. בסוף: כתוב לי "לידים" בוואטסאפ.',
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
    findings: ['פורמט אנכי 9:16 — מתאים לרילס/טיקטוק', 'עוצמת האודיו בפתיחה חלשה יחסית לשאר הסרטון'],
  },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function testGet() {
  const res = await fetch(BASE, { method: 'GET' });
  assert(res.ok, `GET failed: ${res.status}`);
  const data = await res.json();
  assert(data.ok === true, 'GET health check missing ok:true');
  console.log('✓ GET health', data.service || data.model || 'ok');
  return data;
}

async function testPost() {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mockPayload),
  });
  const data = await res.json();
  assert(res.ok, `POST failed: ${res.status} ${data.error || ''}`);
  assert(data.analysis, 'Missing analysis object');
  assert(data.analysis.score >= 1 && data.analysis.score <= 10, 'Invalid score');
  assert(Array.isArray(data.analysis.priorityFixes) && data.analysis.priorityFixes.length >= 1, 'Missing priorityFixes');
  assert(data.analysis.categories?.hook, 'Missing hook category');
  assert(data.analysis.summary?.length > 20, 'Summary too short');
  assert(!String(data.analysis.verdict || '').includes('לא ניתן לנתח'), 'Stale AI verdict');
  assert(!String(data.analysis.summary || '').includes('נדרש פלט תקין'), 'Stale AI summary');
  assert(Array.isArray(data.analysis.whatToChange), 'Missing whatToChange');
  assert(Array.isArray(data.analysis.howToImprove), 'Missing howToImprove');
  assert(data.dataSources?.frameCount >= 1, 'Missing dataSources.frameCount');
  console.log('✓ POST analyze score=', data.analysis.score, 'verdict=', data.analysis.verdict?.slice(0, 60));
  console.log('  sources:', JSON.stringify(data.dataSources));
  console.log('  fixes:', data.analysis.priorityFixes?.length, '| changes:', data.analysis.whatToChange?.length);
  return data;
}

async function main() {
  console.log('Smoke test:', BASE);
  await testGet();
  await testPost();
  console.log('All smoke tests passed.');
}

main().catch((err) => {
  console.error('Smoke test failed:', err.message);
  process.exit(1);
});
