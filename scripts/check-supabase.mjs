import { readFileSync } from 'node:fs';

const apiJs = readFileSync(new URL('../api/analyze.js', import.meta.url), 'utf8');
const urlMatch = apiJs.match(/const SUPABASE_URL = '([^']+)'/);
const keyMatch = apiJs.match(/const SUPABASE_ANON_KEY =\s*\n?\s*'([^']+)'/);
const url = urlMatch?.[1];
const key = keyMatch?.[1];

if (!url || !key) {
  console.error('Could not read Supabase config from api/analyze.js');
  process.exit(1);
}

const payload = {
  platform: 'tiktok',
  goal: 'לידים',
  problem: 'אנשים יוצאים מהר',
  audience: 'בעלי עסקים',
  contentBrief: 'אם העסק שלך תקוע — כתוב לי "לידים" בוואטסאפ',
  fileName: 'test.mp4',
  fileType: 'video/mp4',
  fileSizeMb: 8,
  durationSec: 25,
  width: 1080,
  height: 1920,
  frameMetrics: [
    { second: 0.5, brightness: 120, contrast: 45, sharpness: 18, colorfulness: 22, darkRatio: 8, brightRatio: 3, sceneChange: 0 },
    { second: 3, brightness: 115, contrast: 42, sharpness: 16, colorfulness: 20, darkRatio: 10, brightRatio: 4, sceneChange: 15 },
  ],
  audioMetrics: { analyzed: true, hasAudio: true, hookSilentRatio: 33, openingWeak: true },
  analysisDigest: { frameCount: 2, findings: ['פורמט אנכי'] },
};

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
};

const getRes = await fetch(`${url}/functions/v1/analyze`, { method: 'GET', headers });
console.log('GET status', getRes.status);
console.log(await getRes.text());

const postRes = await fetch(`${url}/functions/v1/analyze`, {
  method: 'POST',
  headers,
  body: JSON.stringify(payload),
});
const postText = await postRes.text();
console.log('POST status', postRes.status);
try {
  const parsed = JSON.parse(postText);
  console.log(JSON.stringify({
    error: parsed.error,
    verdict: parsed.analysis?.verdict,
    summary: parsed.analysis?.summary?.slice?.(0, 180),
    score: parsed.analysis?.score,
    service: parsed.service,
  }, null, 2));
} catch {
  console.log(postText.slice(0, 1500));
}
