import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { analyzeVideoDemo } from '../analyze.js';

let tmpDir;
let verticalVideo;
let horizontalVideo;

function makeVideo(outPath, size, seconds) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-f', 'lavfi',
      '-i', `testsrc=size=${size}:rate=24:duration=${seconds}`,
      '-f', 'lavfi',
      '-i', `sine=frequency=440:duration=${seconds}`,
      '-shortest',
      '-pix_fmt', 'yuv420p',
      outPath,
    ];
    const proc = spawn(ffmpegPath, args, { stdio: 'ignore' });
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve(outPath) : reject(new Error(`ffmpeg exited ${code}`))));
  });
}

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reel-test-'));
  verticalVideo = path.join(tmpDir, 'vertical.mp4');
  horizontalVideo = path.join(tmpDir, 'horizontal.mp4');
  await makeVideo(verticalVideo, '360x640', 4);
  await makeVideo(horizontalVideo, '640x360', 4);
});

after(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test('analyzeVideoDemo: reads real metadata from a vertical video', async () => {
  const result = await analyzeVideoDemo({
    videoPath: verticalVideo,
    platform: 'tiktok',
    goal: 'בדיקה',
    problem: '',
  });

  assert.equal(result.demo, true);
  assert.ok(Math.abs(result.durationSec - 4) <= 1, `duration ~4, got ${result.durationSec}`);
  assert.equal(result.videoMeta.width, 360);
  assert.equal(result.videoMeta.height, 640);
  assert.equal(result.videoMeta.isVertical, true);
  assert.ok(result.analysis.score >= 1 && result.analysis.score <= 10);
  assert.ok(result.frameTimestamps.length >= 1);
});

test('analyzeVideoDemo: detects horizontal (non-ideal) format', async () => {
  const result = await analyzeVideoDemo({
    videoPath: horizontalVideo,
    platform: 'reels',
    goal: '',
    problem: '',
  });
  assert.equal(result.videoMeta.isVertical, false);
  assert.ok(JSON.stringify(result.analysis).includes('אנכי'));
});
