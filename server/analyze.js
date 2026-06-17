import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PLATFORM_LABELS = {
  tiktok: 'TikTok',
  reels: 'Instagram Reels',
  both: 'TikTok ו-Reels',
};

function getVideoMetadata(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams?.find((s) => s.codec_type === 'video');
      const duration = metadata.format?.duration || 60;
      const width = videoStream?.width;
      const height = videoStream?.height;
      resolve({
        durationSec: duration,
        width,
        height,
        isVertical: height && width ? height > width : null,
        fps: videoStream?.r_frame_rate,
      });
    });
  });
}

function extractAudio(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

function extractFrame(videoPath, timestamp, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: [timestamp],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '720x?',
      })
      .on('end', () => resolve(outputPath))
      .on('error', reject);
  });
}

function buildFrameTimestamps(durationSec) {
  const d = Math.min(durationSec, 60);
  const points = new Set([0, 0.5, 1, 2, 3, 5]);

  if (d > 8) points.add(Math.round(d * 0.2));
  if (d > 10) points.add(Math.round(d * 0.4));
  if (d > 14) points.add(Math.round(d * 0.6));
  if (d > 18) points.add(Math.round(d * 0.8));
  if (d > 4) points.add(Math.max(0, Math.round(d - 2)));

  return [...points]
    .filter((t) => t >= 0 && t <= d)
    .sort((a, b) => a - b)
    .slice(0, 10);
}

async function transcribeAudio(audioPath) {
  const audioFile = await toFile(
    await fs.readFile(audioPath),
    'audio.mp3',
    { type: 'audio/mpeg' }
  );

  return openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
  });
}

async function extractFrames(videoPath, workDir, durationSec) {
  const timestamps = buildFrameTimestamps(durationSec);
  const frames = [];

  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const framePath = path.join(workDir, `frame-${i}.jpg`);
    await extractFrame(videoPath, ts, framePath);
    const buffer = await fs.readFile(framePath);
    frames.push({ timestamp: ts, base64: buffer.toString('base64') });
  }

  return frames;
}

function formatTranscript(transcription) {
  if (!transcription.segments?.length) {
    return transcription.text || '(ללא דיבור מזוהה)';
  }
  return transcription.segments
    .map((s) => `[${s.start.toFixed(1)}s–${s.end.toFixed(1)}s] ${s.text.trim()}`)
    .join('\n');
}

function formatVideoMeta(meta) {
  const parts = [];
  if (meta.width && meta.height) {
    parts.push(`${meta.width}×${meta.height}`);
    parts.push(meta.isVertical ? 'אנכי (9:16)' : 'אופקי — לא אידיאלי לרילס');
  }
  return parts.join(' · ') || 'לא זוהה';
}

function buildAnalysisPrompt({ platform, goal, problem, durationSec, transcript, frameCount, videoMeta }) {
  const platformLabel = PLATFORM_LABELS[platform] || 'TikTok';

  return `אתה מומחה בכיר לתוכן ויראלי קצר ב-${platformLabel} עם ניסיון בעריכה, קופירייטינג ואלגוריתמים.
נתח את הסרטון בצורה ביקורתית אך בונה. תן משוב ספציפי ופרקטי — לא כלליות.

## פרטי הסרטון
- פלטפורמה: ${platformLabel}
- אורך: ${durationSec.toFixed(1)} שניות
- וידאו: ${formatVideoMeta(videoMeta)}
- מטרת היוצר: ${goal || 'לא צוין'}
- מה לא עבד (לדברי היוצר): ${problem || 'לא צוין'}
- פריימים לניתוח: ${frameCount}

## תמלול (חותמות זמן)
${transcript}

## קריטריונים
1. Hook (0–3 שניות) — עוצר גלילה? curiosity gap?
2. קצב ועריכה — dead air, jump cuts, אנרגיה
3. מסר ו-CTA — ברור למי? מה לעשות בסוף?
4. ויזואל — תאורה, יציבות, טקסט על המסך, framing
5. אודיו — דיבור ברור, מוזיקה, עוצמות
6. התאמה ל-${platformLabel} — אורך, פורמט, retention

החזר JSON בלבד (ללא markdown) במבנה המדויק:
{
  "score": <1-10>,
  "verdict": "<משפט אחד — פסק דין קצר, למשל: פתיחה חזקה אבל CTA חסר>",
  "summary": "<2-3 משפטים>",
  "categories": {
    "hook": { "score": <1-10>, "label": "פתיחה (Hook)", "note": "<משפט>" },
    "pacing": { "score": <1-10>, "label": "קצב ועריכה", "note": "<משפט>" },
    "message": { "score": <1-10>, "label": "מסר ו-CTA", "note": "<משפט>" },
    "visual": { "score": <1-10>, "label": "ויזואל", "note": "<משפט>" },
    "audio": { "score": <1-10>, "label": "אודיו", "note": "<משפט>" },
    "platformFit": { "score": <1-10>, "label": "התאמה לפלטפורמה", "note": "<משפט>" }
  },
  "priorityFixes": ["<התיקון הכי דחוף #1>", "<#2>", "<#3>"],
  "whyItFailed": ["<סיבה>", ...],
  "whatToChange": ["<שינוי קונקרטי>", ...],
  "howToImprove": ["<המלצה>", ...],
  "hookSuggestion": "<פתיחה חלופית — 1-2 משפטים>",
  "scriptSuggestion": "<תסריט/outline משופר>",
  "platformTips": ["<טיפ>", ...],
  "timeline": [{ "second": <number>, "note": "<מה קורה כאן ולמה זה חשוב>" }]
}`;
}

async function analyzeWithVision({ frames, prompt }) {
  const imageParts = frames.flatMap((frame) => [
    { type: 'text', text: `פריים ב-${frame.timestamp} שניות:` },
    {
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${frame.base64}`, detail: 'low' },
    },
  ]);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'אתה אנליסט תוכן ויראלי מקצועי. עונה תמיד בעברית. משוב ישיר, ספציפי ומעשי. JSON תקין בלבד.',
      },
      {
        role: 'user',
        content: [{ type: 'text', text: prompt }, ...imageParts],
      },
    ],
    max_tokens: 3000,
    temperature: 0.4,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('לא התקבלה תשובה מהמודל');

  return JSON.parse(content);
}

export async function analyzeVideo({ videoPath, workDir, platform, goal, problem }) {
  const videoMeta = await getVideoMetadata(videoPath);
  const durationSec = videoMeta.durationSec;

  if (durationSec > 65) {
    throw new Error('הסרטון ארוך מדי. מקסימום דקה אחת (60 שניות).');
  }

  const audioPath = path.join(workDir, 'audio.mp3');
  await extractAudio(videoPath, audioPath);

  const [transcription, frames] = await Promise.all([
    transcribeAudio(audioPath).catch((err) => {
      console.warn('Transcription failed:', err.message);
      return { text: '(לא ניתן לתמלל — ייתכן שאין דיבור)', segments: [] };
    }),
    extractFrames(videoPath, workDir, durationSec),
  ]);

  const transcript = formatTranscript(transcription);
  const prompt = buildAnalysisPrompt({
    platform,
    goal,
    problem,
    durationSec,
    transcript,
    frameCount: frames.length,
    videoMeta,
  });

  const analysis = await analyzeWithVision({ frames, prompt });

  return {
    durationSec: Math.round(durationSec * 10) / 10,
    platform,
    videoMeta: {
      width: videoMeta.width,
      height: videoMeta.height,
      isVertical: videoMeta.isVertical,
    },
    transcript,
    frameTimestamps: frames.map((f) => f.timestamp),
    analysis,
  };
}
