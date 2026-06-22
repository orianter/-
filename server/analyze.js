import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import {
  buildFrameTimestamps,
  formatTranscript,
  formatVideoMeta,
  MAX_DURATION_SEC,
  normalizeAnalysis,
  parseModelJson,
  PLATFORM_LABELS,
} from './lib/utils.js';
import { buildDemoAnalysis } from './lib/demo.js';
import { probeVideo } from './lib/probe.js';

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

let _openai = null;
function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

async function getVideoMetadata(videoPath) {
  const meta = await probeVideo(videoPath);
  return {
    durationSec: meta.durationSec || 60,
    width: meta.width,
    height: meta.height,
    isVertical: meta.isVertical,
    hasAudio: meta.hasAudio,
  };
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

async function transcribeAudio(audioPath) {
  const audioFile = await toFile(await fs.readFile(audioPath), 'audio.mp3', { type: 'audio/mpeg' });
  return getOpenAI().audio.transcriptions.create({
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
    try {
      await extractFrame(videoPath, ts, framePath);
      const buffer = await fs.readFile(framePath);
      frames.push({ timestamp: ts, base64: buffer.toString('base64') });
    } catch {
      // Skip frames that fail (e.g. timestamp past EOF) — keep the rest.
    }
  }
  return frames;
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
  "verdict": "<משפט אחד — פסק דין קצר>",
  "summary": "<2-3 משפטים>",
  "categories": {
    "hook": { "score": <1-10>, "label": "פתיחה (Hook)", "note": "<משפט>" },
    "pacing": { "score": <1-10>, "label": "קצב ועריכה", "note": "<משפט>" },
    "message": { "score": <1-10>, "label": "מסר ו-CTA", "note": "<משפט>" },
    "visual": { "score": <1-10>, "label": "ויזואל", "note": "<משפט>" },
    "audio": { "score": <1-10>, "label": "אודיו", "note": "<משפט>" },
    "platformFit": { "score": <1-10>, "label": "התאמה לפלטפורמה", "note": "<משפט>" }
  },
  "priorityFixes": ["<#1>", "<#2>", "<#3>"],
  "whyItFailed": ["<סיבה>"],
  "whatToChange": ["<שינוי קונקרטי>"],
  "howToImprove": ["<המלצה>"],
  "hookSuggestion": "<פתיחה חלופית>",
  "scriptSuggestion": "<תסריט/outline משופר>",
  "platformTips": ["<טיפ>"],
  "timeline": [{ "second": <number>, "note": "<מה קורה ולמה חשוב>" }]
}`;
}

async function analyzeWithVision({ frames, prompt }) {
  const imageParts = frames.flatMap((frame) => [
    { type: 'text', text: `פריים ב-${frame.timestamp} שניות:` },
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${frame.base64}`, detail: 'low' } },
  ]);

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'אתה אנליסט תוכן ויראלי מקצועי. עונה תמיד בעברית. משוב ישיר, ספציפי ומעשי. JSON תקין בלבד.',
      },
      { role: 'user', content: [{ type: 'text', text: prompt }, ...imageParts] },
    ],
    max_tokens: 3000,
    temperature: 0.4,
  });

  const content = response.choices[0]?.message?.content;
  return normalizeAnalysis(parseModelJson(content));
}

function publicMeta(videoMeta) {
  return {
    width: videoMeta.width,
    height: videoMeta.height,
    isVertical: videoMeta.isVertical,
  };
}

// Demo path: reads REAL metadata via ffmpeg, returns a labeled mock analysis.
// Lets the whole app work end-to-end without an OpenAI key.
export async function analyzeVideoDemo({ videoPath, platform, goal, problem }) {
  const videoMeta = await getVideoMetadata(videoPath);
  if (videoMeta.durationSec > MAX_DURATION_SEC) {
    throw new Error('הסרטון ארוך מדי. המקסימום הוא 2 דקות (120 שניות).');
  }
  return {
    demo: true,
    durationSec: Math.round(videoMeta.durationSec * 10) / 10,
    platform,
    videoMeta: publicMeta(videoMeta),
    transcript: '(מצב הדגמה — תמלול אמיתי זמין לאחר חיבור מפתח OpenAI)',
    frameTimestamps: buildFrameTimestamps(videoMeta.durationSec),
    analysis: buildDemoAnalysis(videoMeta, { platform, goal, problem }),
  };
}

export async function analyzeVideo({ videoPath, workDir, platform, goal, problem }) {
  const videoMeta = await getVideoMetadata(videoPath);
  const durationSec = videoMeta.durationSec;

  if (durationSec > MAX_DURATION_SEC) {
    throw new Error('הסרטון ארוך מדי. המקסימום הוא 2 דקות (120 שניות).');
  }

  const audioPath = path.join(workDir, 'audio.mp3');
  const audioPromise = videoMeta.hasAudio
    ? extractAudio(videoPath, audioPath).then(() => transcribeAudio(audioPath)).catch((err) => {
        console.warn('Transcription failed:', err.message);
        return { text: '(לא ניתן לתמלל — ייתכן שאין דיבור)', segments: [] };
      })
    : Promise.resolve({ text: '(אין ערוץ אודיו בסרטון)', segments: [] });

  const [transcription, frames] = await Promise.all([
    audioPromise,
    extractFrames(videoPath, workDir, durationSec),
  ]);

  if (!frames.length) {
    throw new Error('לא ניתן לחלץ תמונות מהסרטון. נסה קובץ אחר.');
  }

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
    demo: false,
    durationSec: Math.round(durationSec * 10) / 10,
    platform,
    videoMeta: publicMeta(videoMeta),
    transcript,
    frameTimestamps: frames.map((f) => f.timestamp),
    analysis,
  };
}
