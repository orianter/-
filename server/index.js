import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { analyzeVideo, analyzeVideoDemo } from './analyze.js';
import { normalizePlatform } from './lib/utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const MAX_FILE_BYTES = 100 * 1024 * 1024;

// Render/Proxies: needed for correct client IP in rate limiting.
app.set('trust proxy', 1);

const uploadDir = path.join(__dirname, 'uploads');
await fs.mkdir(uploadDir, { recursive: true });

function hasApiKey() {
  const k = (process.env.OPENAI_API_KEY || '').trim();
  if (!k || !k.startsWith('sk-')) return false;
  // Reject obvious placeholder values from example .env files.
  if (/your[-_]?api[-_]?key|your[-_]?key|here|xxx|placeholder|\.\.\./i.test(k)) return false;
  return k.length >= 20;
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (allowed.includes(file.mimetype) || /\.(mp4|webm|mov|avi)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      const e = new Error('סוג קובץ לא נתמך. העלה MP4, WebM או MOV.');
      e.status = 400;
      cb(e);
    }
  },
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (origin.startsWith('http://localhost:')) return callback(null, true);
      if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) return callback(null, true);
      if (origin.endsWith('.vercel.app')) return callback(null, true);
      return callback(null, true);
    },
  })
);
app.use(express.json({ limit: '1mb' }));

// Basic security headers (no extra deps).
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// ── Simple in-memory rate limiter (per IP) ──
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 8;
const hits = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_WINDOW_MS;
  }
  entry.count += 1;
  hits.set(ip, entry);
  if (entry.count > RATE_MAX) {
    const retry = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retry));
    return res.status(429).json({ error: `יותר מדי בקשות. נסה שוב בעוד ${retry} שניות.` });
  }
  next();
}

// Periodically clear stale rate-limit entries.
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of hits) if (now > e.resetAt) hits.delete(ip);
}, 5 * 60 * 1000).unref?.();

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'reel-analyzer-api' });
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasApiKey: hasApiKey(),
    demoMode: !hasApiKey(),
    maxDurationSec: 60,
    maxFileMb: 100,
    version: '2.0.0',
  });
});

app.post('/api/analyze', rateLimit, upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'לא הועלה סרטון' });
  }

  const platform = normalizePlatform(req.body?.platform);
  const goal = String(req.body?.goal || '').trim().slice(0, 300);
  const problem = String(req.body?.problem || '').trim().slice(0, 500);
  const demo = !hasApiKey();

  let workDir = null;
  try {
    workDir = path.join(uploadDir, `work-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(workDir, { recursive: true });

    const videoPath = path.join(workDir, 'input' + path.extname(req.file.originalname || '.mp4'));
    await fs.rename(req.file.path, videoPath);

    const result = demo
      ? await analyzeVideoDemo({ videoPath, platform, goal, problem })
      : await analyzeVideo({ videoPath, workDir, platform, goal, problem });

    res.json(result);
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: err.message || 'שגיאה בניתוח הסרטון' });
  } finally {
    if (workDir) {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    } else if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'הקובץ גדול מדי (מקסימום 100MB)' });
    }
    return res.status(400).json({ error: err.message });
  }
  res.status(err.status || 500).json({ error: err.message || 'שגיאת שרת' });
});

// Only start listening when run directly (so tests can import the app safely).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(hasApiKey() ? '✓ מצב מלא (OpenAI מחובר)' : '⚠ מצב הדגמה (אין מפתח OpenAI)');
  });
}

export { app, hasApiKey };
