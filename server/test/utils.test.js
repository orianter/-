import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildFrameTimestamps,
  clampScore,
  formatTranscript,
  formatVideoMeta,
  normalizeAnalysis,
  normalizePlatform,
  parseModelJson,
} from '../lib/utils.js';

test('normalizePlatform: valid passes through, invalid falls back to tiktok', () => {
  assert.equal(normalizePlatform('reels'), 'reels');
  assert.equal(normalizePlatform('both'), 'both');
  assert.equal(normalizePlatform('tiktok'), 'tiktok');
  assert.equal(normalizePlatform('youtube'), 'tiktok');
  assert.equal(normalizePlatform(undefined), 'tiktok');
  assert.equal(normalizePlatform(''), 'tiktok');
});

test('clampScore: clamps to 1-10 and rounds', () => {
  assert.equal(clampScore(0), 1);
  assert.equal(clampScore(-5), 1);
  assert.equal(clampScore(11), 10);
  assert.equal(clampScore(100), 10);
  assert.equal(clampScore(7.4), 7);
  assert.equal(clampScore(7.6), 8);
  assert.equal(clampScore('5'), 5);
  assert.equal(clampScore('abc'), 5);
  assert.equal(clampScore(NaN, 3), 3);
  assert.equal(clampScore(undefined, 4), 4);
});

test('buildFrameTimestamps: always sorted, unique, within bounds, max 10', () => {
  for (const d of [0, 1, 3, 7, 12, 24, 45, 60, 120]) {
    const ts = buildFrameTimestamps(d);
    assert.ok(ts.length <= 10, `too many frames for ${d}`);
    assert.ok(ts.length >= 1, `no frames for ${d}`);
    // sorted ascending
    for (let i = 1; i < ts.length; i++) assert.ok(ts[i] >= ts[i - 1], 'not sorted');
    // unique
    assert.equal(new Set(ts).size, ts.length, 'duplicates present');
    // within bounds (capped at 60)
    const cap = Math.min(Math.max(d, 0), 60);
    for (const t of ts) assert.ok(t >= 0 && t <= cap, `frame ${t} out of bounds for ${d}`);
  }
});

test('buildFrameTimestamps: short clip stays minimal', () => {
  const ts = buildFrameTimestamps(2);
  assert.ok(ts.every((t) => t <= 2));
});

test('formatTranscript: handles segments, plain text, and empty', () => {
  const withSegments = formatTranscript({
    segments: [
      { start: 0, end: 1.5, text: ' שלום ' },
      { start: 1.5, end: 3, text: 'עולם' },
    ],
  });
  assert.ok(withSegments.includes('שלום'));
  assert.ok(withSegments.includes('0.0s'));
  assert.ok(withSegments.includes('1.5s'));

  assert.equal(formatTranscript({ text: 'רק טקסט' }), 'רק טקסט');
  assert.equal(formatTranscript({}), '(ללא דיבור מזוהה)');
  assert.equal(formatTranscript(null), '(ללא דיבור מזוהה)');
});

test('formatVideoMeta: vertical vs horizontal vs unknown', () => {
  assert.ok(formatVideoMeta({ width: 1080, height: 1920, isVertical: true }).includes('אנכי'));
  assert.ok(formatVideoMeta({ width: 1920, height: 1080, isVertical: false }).includes('אופקי'));
  assert.equal(formatVideoMeta({}), 'לא זוהה');
});

test('parseModelJson: parses clean, fenced, and prose-wrapped JSON', () => {
  assert.deepEqual(parseModelJson('{"a":1}'), { a: 1 });
  assert.deepEqual(parseModelJson('```json\n{"a":2}\n```'), { a: 2 });
  assert.deepEqual(parseModelJson('הנה התשובה: {"a":3} תודה'), { a: 3 });
  assert.throws(() => parseModelJson(''), /לא התקבלה/);
  assert.throws(() => parseModelJson('no json here'), /JSON/);
});

test('normalizeAnalysis: fills missing fields and clamps scores', () => {
  const out = normalizeAnalysis({});
  assert.ok(out.score >= 1 && out.score <= 10);
  assert.equal(typeof out.summary, 'string');
  assert.ok(Array.isArray(out.priorityFixes));
  assert.ok(Array.isArray(out.timeline));
  // all 6 categories present
  for (const k of ['hook', 'pacing', 'message', 'visual', 'audio', 'platformFit']) {
    assert.ok(out.categories[k], `missing category ${k}`);
    assert.ok(out.categories[k].score >= 1 && out.categories[k].score <= 10);
    assert.equal(typeof out.categories[k].label, 'string');
  }
});

test('normalizeAnalysis: derives overall score from categories when missing', () => {
  const out = normalizeAnalysis({
    categories: {
      hook: { score: 10 },
      pacing: { score: 10 },
      message: { score: 10 },
      visual: { score: 10 },
      audio: { score: 10 },
      platformFit: { score: 10 },
    },
  });
  assert.equal(out.score, 10);
});

test('normalizeAnalysis: strips non-string array entries', () => {
  const out = normalizeAnalysis({
    priorityFixes: ['תקן את ה-hook', '', null, 42, '   ', 'הוסף CTA'],
  });
  assert.deepEqual(out.priorityFixes, ['תקן את ה-hook', 'הוסף CTA']);
});

test('normalizeAnalysis: timeline entries get rounded seconds and require notes', () => {
  const out = normalizeAnalysis({
    timeline: [
      { second: 2.7, note: 'משהו' },
      { second: 5, note: '' },
      { second: -3, note: 'התחלה' },
    ],
  });
  assert.equal(out.timeline.length, 2);
  assert.equal(out.timeline[0].second, 3);
  assert.equal(out.timeline[1].second, 0);
});
