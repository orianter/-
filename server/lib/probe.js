import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

// Parse ffmpeg's stderr banner into structured metadata.
// We avoid ffprobe entirely because ffmpeg-static does NOT bundle ffprobe,
// which would otherwise break metadata reading in production (e.g. Render).
export function parseFfmpegMeta(stderr) {
  const text = String(stderr || '');

  let durationSec = null;
  const dur = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (dur) {
    durationSec = Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]);
  }

  let width = null;
  let height = null;
  // Find the first video stream line and pull its WxH (avoid matching SAR/DAR ratios).
  const videoLine = text.split('\n').find((l) => /Stream #\d+:\d+.*: Video:/.test(l));
  if (videoLine) {
    const res = videoLine.match(/,\s*(\d{2,5})x(\d{2,5})\b/) || videoLine.match(/\b(\d{2,5})x(\d{2,5})\b/);
    if (res) {
      width = Number(res[1]);
      height = Number(res[2]);
    }
  }

  const hasAudio = /Stream #\d+:\d+.*: Audio:/.test(text);
  const hasVideo = Boolean(videoLine);

  return {
    durationSec,
    width,
    height,
    isVertical: width && height ? height > width : null,
    hasAudio,
    hasVideo,
  };
}

export function probeVideo(videoPath) {
  return new Promise((resolve, reject) => {
    // `ffmpeg -i file` with no output prints metadata to stderr and exits with code 1.
    const proc = spawn(ffmpegPath, ['-hide_banner', '-i', videoPath]);
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', () => reject(new Error('לא ניתן להפעיל את מנוע הווידאו (ffmpeg).')));
    proc.on('close', () => {
      const meta = parseFfmpegMeta(stderr);
      if (!meta.hasVideo || meta.durationSec == null) {
        return reject(new Error('לא ניתן לקרוא את קובץ הווידאו. ודא שזה קובץ תקין.'));
      }
      resolve(meta);
    });
  });
}
