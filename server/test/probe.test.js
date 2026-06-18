import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFfmpegMeta } from '../lib/probe.js';

const VERTICAL = `
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'input.mp4':
  Metadata:
    major_brand     : isom
  Duration: 00:00:24.50, start: 0.000000, bitrate: 1500 kb/s
  Stream #0:0[0x1](und): Video: h264 (High), yuv420p, 1080x1920 [SAR 1:1 DAR 9:16], 1400 kb/s, 30 fps
  Stream #0:1[0x2](und): Audio: aac (LC), 44100 Hz, stereo, fltp, 128 kb/s
`;

const HORIZONTAL_NO_AUDIO = `
  Duration: 00:01:05.00, start: 0.000000, bitrate: 800 kb/s
  Stream #0:0: Video: h264, yuv420p, 1920x1080, 30 fps
`;

test('parseFfmpegMeta: vertical with audio', () => {
  const m = parseFfmpegMeta(VERTICAL);
  assert.equal(m.durationSec, 24.5);
  assert.equal(m.width, 1080);
  assert.equal(m.height, 1920);
  assert.equal(m.isVertical, true);
  assert.equal(m.hasAudio, true);
  assert.equal(m.hasVideo, true);
});

test('parseFfmpegMeta: horizontal, no audio, over a minute', () => {
  const m = parseFfmpegMeta(HORIZONTAL_NO_AUDIO);
  assert.equal(m.durationSec, 65);
  assert.equal(m.width, 1920);
  assert.equal(m.height, 1080);
  assert.equal(m.isVertical, false);
  assert.equal(m.hasAudio, false);
  assert.equal(m.hasVideo, true);
});

test('parseFfmpegMeta: does not confuse DAR ratio with resolution', () => {
  const m = parseFfmpegMeta(VERTICAL);
  // 9:16 from DAR should not be parsed as resolution
  assert.notEqual(m.width, 9);
  assert.notEqual(m.height, 16);
});

test('parseFfmpegMeta: empty / garbage input is safe', () => {
  const m = parseFfmpegMeta('');
  assert.equal(m.durationSec, null);
  assert.equal(m.hasVideo, false);
  assert.equal(m.isVertical, null);
  assert.equal(parseFfmpegMeta(null).hasVideo, false);
});
