import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

// Ensure demo mode (no real key) for deterministic, offline testing.
// Setting it to empty BEFORE import prevents dotenv from injecting a placeholder.
process.env.OPENAI_API_KEY = '';

const { app } = await import('../index.js');

let server;
let baseUrl;
let tmpDir;
let videoBuf;

function makeVideo(outPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y', '-f', 'lavfi', '-i', 'testsrc=size=360x640:rate=24:duration=3',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
      '-shortest', '-pix_fmt', 'yuv420p', outPath,
    ];
    const proc = spawn(ffmpegPath, args, { stdio: 'ignore' });
    proc.on('error', reject);
    proc.on('close', (c) => (c === 0 ? resolve(outPath) : reject(new Error(`ffmpeg ${c}`))));
  });
}

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reel-http-'));
  const vp = path.join(tmpDir, 'v.mp4');
  await makeVideo(vp);
  videoBuf = await fs.readFile(vp);
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((r) => server.close(r));
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test('GET /api/health reports demo mode without key', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.hasApiKey, false);
  assert.equal(body.demoMode, true);
});

test('POST /api/analyze rejects when no file', async () => {
  const res = await fetch(`${baseUrl}/api/analyze`, { method: 'POST', body: new FormData() });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('סרטון'));
});

test('POST /api/analyze returns a demo report for a real video', async () => {
  const form = new FormData();
  form.append('video', new Blob([videoBuf], { type: 'video/mp4' }), 'clip.mp4');
  form.append('platform', 'reels');
  form.append('goal', 'חשיפה');

  const res = await fetch(`${baseUrl}/api/analyze`, { method: 'POST', body: form });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.demo, true);
  assert.equal(body.platform, 'reels');
  assert.equal(body.videoMeta.isVertical, true);
  assert.ok(body.analysis.score >= 1 && body.analysis.score <= 10);
  assert.ok(body.analysis.priorityFixes.length >= 1);
});

test('POST /api/analyze rejects unsupported file type', async () => {
  const form = new FormData();
  form.append('video', new Blob([Buffer.from('hello')], { type: 'text/plain' }), 'note.txt');
  const res = await fetch(`${baseUrl}/api/analyze`, { method: 'POST', body: form });
  assert.equal(res.status, 400);
});
