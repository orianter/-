import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeVideo } from './analyze.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

const uploadDir = path.join(__dirname, 'uploads');
await fs.mkdir(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(mp4|webm|mov|avi)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('סוג קובץ לא נתמך. העלה MP4, WebM או MOV.'));
    }
  },
});

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.startsWith('http://localhost:')) return callback(null, true);
    if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) return callback(null, true);
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    callback(null, true);
  },
}));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.post('/api/analyze', upload.single('video'), async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: 'חסר OPENAI_API_KEY בקובץ .env',
    });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'לא הועלה סרטון' });
  }

  const { platform = 'tiktok', goal = '', problem = '' } = req.body;
  const validPlatforms = ['tiktok', 'reels', 'both'];
  const selectedPlatform = validPlatforms.includes(platform) ? platform : 'tiktok';

  let workDir = null;

  try {
    workDir = path.join(uploadDir, `work-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(workDir, { recursive: true });

    const videoPath = path.join(workDir, 'input' + path.extname(req.file.originalname || '.mp4'));
    await fs.rename(req.file.path, videoPath);

    const result = await analyzeVideo({
      videoPath,
      workDir,
      platform: selectedPlatform,
      goal: goal.trim(),
      problem: problem.trim(),
    });

    res.json(result);
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({
      error: err.message || 'שגיאה בניתוח הסרטון',
    });
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
  res.status(500).json({ error: err.message || 'שגיאת שרת' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
