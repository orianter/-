import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDemoAnalysis } from '../lib/demo.js';

test('buildDemoAnalysis: returns a complete, valid analysis', () => {
  const a = buildDemoAnalysis(
    { durationSec: 24, width: 1080, height: 1920, isVertical: true },
    { platform: 'tiktok', goal: 'מכירות', problem: 'מעט צפיות' }
  );
  assert.ok(a.score >= 1 && a.score <= 10);
  assert.ok(a.verdict.length > 0);
  assert.ok(a.summary.includes('מכירות'));
  assert.ok(a.summary.includes('מעט צפיות'));
  assert.ok(a.priorityFixes.length >= 1);
  assert.ok(a.timeline.length >= 1);
  for (const k of ['hook', 'pacing', 'message', 'visual', 'audio', 'platformFit']) {
    assert.ok(a.categories[k].score >= 1 && a.categories[k].score <= 10);
  }
});

test('buildDemoAnalysis: deterministic for same input', () => {
  const meta = { durationSec: 30, width: 1080, height: 1920, isVertical: true };
  const a = buildDemoAnalysis(meta, { platform: 'reels' });
  const b = buildDemoAnalysis(meta, { platform: 'reels' });
  assert.deepEqual(a, b);
});

test('buildDemoAnalysis: horizontal video flags a vertical-format fix', () => {
  const a = buildDemoAnalysis(
    { durationSec: 20, width: 1920, height: 1080, isVertical: false },
    { platform: 'tiktok' }
  );
  const text = JSON.stringify(a);
  assert.ok(text.includes('אנכי'), 'should mention vertical format issue');
});

test('buildDemoAnalysis: handles missing/extreme metadata gracefully', () => {
  const a = buildDemoAnalysis({}, {});
  assert.ok(a.score >= 1 && a.score <= 10);
  assert.ok(a.timeline.every((t) => t.second >= 0));

  const long = buildDemoAnalysis({ durationSec: 90 }, { platform: 'tiktok' });
  assert.ok(long.categories.platformFit.score >= 1);
});

test('buildDemoAnalysis: timeline seconds never exceed duration meaningfully', () => {
  const a = buildDemoAnalysis({ durationSec: 10, width: 1080, height: 1920, isVertical: true }, {});
  for (const t of a.timeline) {
    assert.ok(t.second <= 10, `timeline second ${t.second} > duration`);
  }
});
