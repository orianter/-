import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { analyzeFunctionUrl, hasSupabaseConfig, supabaseHeaders } from '../api';
import {
  AnalysisSection,
  buildReportText,
  CategoryScores,
  PriorityFixes,
  ScoreRing,
  Timeline,
} from '../components/Report';

const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok', icon: '🎵', desc: 'טרנדים, hook מהיר' },
  { id: 'reels', label: 'Reels', icon: '📸', desc: 'אסתטיקה, סטוריטלינג' },
  { id: 'both', label: 'שניהם', icon: '✨', desc: 'אופטימיזציה כפולה' },
];

const STEPS = [
  { label: 'קורא פרטי סרטון', icon: '📤' },
  { label: 'דוגם פריימים', icon: '🎧' },
  { label: 'שולח ל-Supabase', icon: '🎞️' },
  { label: 'מחבר ל-OpenAI', icon: '💬' },
  { label: 'מנתח AI', icon: '🧠' },
  { label: 'מכין דוח', icon: '📋' },
];

const MAX_FILE_MB = 100;
const FRAME_SAMPLE_SIZE = 120;

function frameTimestamps(durationSec) {
  const duration = Math.min(Math.max(Number(durationSec) || 0, 0), 60);
  const points = new Set([0.2, 0.8, 1.5, 3]);
  if (duration > 6) points.add(Math.round(duration * 0.25));
  if (duration > 10) points.add(Math.round(duration * 0.5));
  if (duration > 14) points.add(Math.round(duration * 0.75));
  if (duration > 4) points.add(Math.max(0.2, duration - 1));

  return [...points]
    .filter((point) => point > 0 && point < duration)
    .sort((a, b) => a - b)
    .slice(0, 8);
}

function computeFrameMetrics(imageData, previousData) {
  const { data, width, height } = imageData;
  let luminanceSum = 0;
  let luminanceSqSum = 0;
  let edgeSum = 0;
  let colorDiffSum = 0;
  let darkPixels = 0;
  let brightPixels = 0;
  let sceneDiffSum = 0;
  let sceneSamples = 0;

  const luminanceAt = (idx) => 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const lum = luminanceAt(idx);
      luminanceSum += lum;
      luminanceSqSum += lum * lum;
      colorDiffSum += Math.abs(data[idx] - data[idx + 1]) + Math.abs(data[idx] - data[idx + 2]) + Math.abs(data[idx + 1] - data[idx + 2]);
      if (lum < 25) darkPixels += 1;
      if (lum > 235) brightPixels += 1;

      if (x > 0 && y > 0) {
        edgeSum += Math.abs(lum - luminanceAt(idx - 4));
        edgeSum += Math.abs(lum - luminanceAt(idx - width * 4));
      }

      if (previousData?.data) {
        sceneDiffSum +=
          Math.abs(data[idx] - previousData.data[idx]) +
          Math.abs(data[idx + 1] - previousData.data[idx + 1]) +
          Math.abs(data[idx + 2] - previousData.data[idx + 2]);
        sceneSamples += 3;
      }
    }
  }

  const pixels = width * height;
  const avgLum = luminanceSum / pixels;
  const variance = Math.max(0, luminanceSqSum / pixels - avgLum * avgLum);

  return {
    brightness: Math.round(avgLum),
    contrast: Math.round(Math.sqrt(variance)),
    sharpness: Math.round(edgeSum / pixels),
    colorfulness: Math.round(colorDiffSum / (pixels * 3)),
    darkRatio: Math.round((darkPixels / pixels) * 100),
    brightRatio: Math.round((brightPixels / pixels) * 100),
    sceneChange: sceneSamples ? Math.round((sceneDiffSum / sceneSamples / 255) * 100) : 0,
  };
}

async function sampleVideoFrames(file, durationSec) {
  const timestamps = frameTimestamps(durationSec);
  if (!timestamps.length) return [];

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const samples = [];
    let previousData = null;
    let index = 0;
    let finished = false;

    let timer = null;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(samples);
    };
    if (!ctx) {
      finish();
      return;
    }

    const captureCurrentFrame = () => {
      const sourceWidth = video.videoWidth || FRAME_SAMPLE_SIZE;
      const sourceHeight = video.videoHeight || FRAME_SAMPLE_SIZE;
      const scale = FRAME_SAMPLE_SIZE / Math.max(sourceWidth, sourceHeight);
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      samples.push({
        second: Math.round(timestamps[index] * 10) / 10,
        ...computeFrameMetrics(imageData, previousData),
      });
      previousData = imageData;
      index += 1;
      seekNextFrame();
    };

    const seekNextFrame = () => {
      if (index >= timestamps.length) {
        finish();
        return;
      }
      video.currentTime = timestamps[index];
    };

    timer = setTimeout(finish, 10000);
    video.muted = true;
    video.preload = 'metadata';
    video.onloadedmetadata = seekNextFrame;
    video.onseeked = captureCurrentFrame;
    video.onerror = finish;
    video.onended = finish;
    video.src = url;
  });
}

function readVideoMetadata(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;
    const done = (meta = {}) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    const timer = setTimeout(() => done(), 5000);

    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      done({
        durationSec: Number.isFinite(video.duration) ? video.duration : undefined,
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
      });
    };
    video.onerror = () => {
      clearTimeout(timer);
      done();
    };
    video.src = url;
  });
}

export default function AnalyzePage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [platform, setPlatform] = useState('tiktok');
  const [goal, setGoal] = useState('');
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [apiReady, setApiReady] = useState(null);
  const [copied, setCopied] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const stepTimerRef = useRef(null);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setApiReady({ ok: false, missingConfig: true });
      return undefined;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch(analyzeFunctionUrl(), { signal: ctrl.signal, headers: supabaseHeaders() })
      .then((r) => r.json())
      .then(setApiReady)
      .catch(() => setApiReady({ ok: false, hasApiKey: false, unreachable: true }))
      .finally(() => clearTimeout(timer));
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const clearStepTimer = () => {
    if (stepTimerRef.current) {
      clearInterval(stepTimerRef.current);
      stepTimerRef.current = null;
    }
  };

  const handleFile = useCallback((selected) => {
    if (!selected) return;
    const isVideo =
      selected.type.startsWith('video/') || /\.(mp4|webm|mov|avi)$/i.test(selected.name);
    if (!isVideo) {
      setError('יש להעלות קובץ וידאו (MP4, WebM, MOV)');
      return;
    }
    if (selected.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`הקובץ גדול מדי (${(selected.size / 1024 / 1024).toFixed(0)}MB). המקסימום הוא ${MAX_FILE_MB}MB.`);
      return;
    }
    setFile(selected);
    setError(null);
    setResult(null);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(selected);
    });
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setStepIndex(0);
    stepTimerRef.current = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 3500);

    try {
      const videoMeta = await readVideoMetadata(file);
      if (videoMeta.durationSec && videoMeta.durationSec > 65) {
        throw new Error('הסרטון ארוך מדי. המקסימום הוא דקה אחת.');
      }
      const frameMetrics = await sampleVideoFrames(file, videoMeta.durationSec);
      const res = await fetch(analyzeFunctionUrl(), {
        method: 'POST',
        headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          platform,
          goal,
          problem,
          fileName: file.name,
          fileType: file.type,
          fileSizeMb: Math.round((file.size / 1024 / 1024) * 10) / 10,
          ...videoMeta,
          frameMetrics,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בניתוח');
      setStepIndex(STEPS.length - 1);
      setResult(data);
      setTimeout(() => {
        document.getElementById('report')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } catch (err) {
      setError(err.message);
    } finally {
      clearStepTimer();
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setGoal('');
    setProblem('');
    setCopied(false);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const copyReport = async () => {
    const label = PLATFORMS.find((p) => p.id === result.platform)?.label || '';
    await navigator.clipboard.writeText(buildReportText({ result, platformLabel: label }));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadReport = () => {
    const label = PLATFORMS.find((p) => p.id === result.platform)?.label || '';
    const text = buildReportText({ result, platformLabel: label });
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reel-analyzer-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { analysis } = result || {};
  const platformLabel = PLATFORMS.find((p) => p.id === result?.platform)?.label;

  return (
    <div className="analyze-page">
      <div className="analyze-page__head">
        <h1>נתח את הסרטון שלך</h1>
        <p>בחר רילס או טיקטוק וקבל דוח AI שמבוסס על דגימות אמיתיות מהסרטון</p>
      </div>

      {apiReady && apiReady.missingConfig && (
        <div className="analyze-alert analyze-alert--error">
          <strong>Supabase לא מוגדר.</strong> הוסף ל-frontend את <code>VITE_SUPABASE_URL</code> ואת <code>VITE_SUPABASE_ANON_KEY</code>.
        </div>
      )}

      {apiReady && apiReady.unreachable && (
        <div className="analyze-alert analyze-alert--error">
          <strong>Supabase Function לא עונה.</strong> ודא שהפונקציה <code>analyze</code> נפרסה ושיש בה secret בשם <code>OPENAI_API_KEY</code>.
        </div>
      )}

      {apiReady && apiReady.demoMode && (
        <div className="analyze-alert analyze-alert--demo">
          <strong>מצב הדגמה פעיל:</strong> תקבל דוח לדוגמה המבוסס על נתוני הסרטון האמיתיים שלך
          (אורך, פורמט). לניתוח AI מלא — הוסף את <code>OPENAI_API_KEY</code> ב-Supabase Secrets.
        </div>
      )}

      {loading && (
        <div className="loading-panel">
          <div className="loading-panel__spinner" />
          <h2>מנתח את הסרטון...</h2>
          <p>בדרך כלל 30–60 שניות. אל תסגור את הדף.</p>
          <div className="steps">
            {STEPS.map((step, i) => (
              <div
                key={step.label}
                className={`step ${i < stepIndex ? 'step--done' : ''} ${i === stepIndex ? 'step--active' : ''}`}
              >
                <span className="step__icon">{i < stepIndex ? '✓' : step.icon}</span>
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="analyze-panel">
          <div
            className={`dropzone ${file ? 'dropzone--has-file' : ''} ${dragActive ? 'dropzone--drag' : ''}`}
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onClick={() => !file && fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (!file && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={file ? -1 : 0}
            aria-label="העלאת סרטון — גרור לכאן או לחץ לבחירה"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => handleFile(e.target.files[0])}
            />
            {preview ? (
              <div className="dropzone__preview">
                <video src={preview} controls onClick={(e) => e.stopPropagation()} />
                <button
                  type="button"
                  className="dropzone__change"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                >
                  החלף סרטון
                </button>
              </div>
            ) : (
              <>
                <div className="dropzone__upload-icon">
                  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="dropzone__title">גרור סרטון לכאן</p>
                <p className="dropzone__sub">או לחץ לבחירה מהמחשב</p>
                <span className="dropzone__hint">MP4 · MOV · WebM · עד 60 שניות</span>
              </>
            )}
          </div>

          {file && (
            <p className="file-name">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>
          )}

          <div className="form-grid">
            <fieldset className="platform-picker">
              <legend>לאיזו פלטפורמה?</legend>
              <div className="platform-picker__options">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`platform-btn ${platform === p.id ? 'platform-btn--active' : ''}`}
                    onClick={() => setPlatform(p.id)}
                  >
                    <span className="platform-btn__icon">{p.icon}</span>
                    <span className="platform-btn__label">{p.label}</span>
                    <span className="platform-btn__desc">{p.desc}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <label>
              מה המטרה? <span className="label-hint">(מומלץ)</span>
              <input
                type="text"
                placeholder="מכירות, חשיפה, לידים, מיתוג..."
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </label>

            <label>
              מה לא עבד? <span className="label-hint">(אופציונלי)</span>
              <textarea
                rows={2}
                placeholder="מעט צפיות, אין לייקים, אנשים יוצאים מהר..."
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
              />
            </label>
          </div>

          {error && <div className="analyze-alert analyze-alert--error">{error}</div>}

          <button
            className="btn-analyze"
            disabled={!file || !apiReady || apiReady.unreachable || apiReady.missingConfig}
            onClick={analyze}
          >
            {apiReady?.demoMode ? 'נתח את הסרטון (הדגמה) ←' : 'נתח את הסרטון ←'}
          </button>

          <p className="analyze-disclaimer">
            הסרטון המלא לא נשלח לשרת · נשלחים רק פרטי הטופס ומדדי פריימים שנדגמו בדפדפן
          </p>
        </div>
      )}

      {result && analysis && (
        <div id="report" className="report">
          <div className="report__top">
            {result.demo && (
              <div className="report__demo-badge">
                דוח הדגמה · מבוסס על נתוני הסרטון האמיתיים שלך
              </div>
            )}
            <div className="report__verdict-wrap">
              <ScoreRing score={analysis.score} />
              <div>
                <p className="report__verdict-label">ציון כללי</p>
                {analysis.verdict && <p className="report__verdict">"{analysis.verdict}"</p>}
                <p className="report__meta">
                  {platformLabel} · {result.durationSec} שניות
                  {result.videoMeta?.width && <> · {result.videoMeta.width}×{result.videoMeta.height}</>}
                  {result.videoMeta?.isVertical === false && (
                    <span className="report__warn-tag">לא אנכי — בעיה לרילס</span>
                  )}
                </p>
              </div>
            </div>
            <p className="report__summary">{analysis.summary}</p>
            <div className="report__actions">
              <button type="button" className="btn-action btn-action--primary" onClick={copyReport}>
                {copied ? '✓ הועתק' : 'העתק דוח'}
              </button>
              <button type="button" className="btn-action" onClick={downloadReport}>
                הורד כקובץ
              </button>
              <button type="button" className="btn-action" onClick={reset}>
                סרטון חדש
              </button>
            </div>
          </div>

          <PriorityFixes items={analysis.priorityFixes} />
          <CategoryScores categories={analysis.categories} />
          <Timeline items={analysis.timeline} />

          <div className="report__sections">
            <AnalysisSection title="למה לא עבד" items={analysis.whyItFailed} variant="fail" icon="✕" />
            <AnalysisSection title="מה לשנות" items={analysis.whatToChange} variant="change" icon="✎" />
            <AnalysisSection title="איך להפוך לטוב" items={analysis.howToImprove} variant="improve" icon="↑" />
            <AnalysisSection title="טיפים לפלטפורמה" items={analysis.platformTips} variant="tips" icon="★" />
          </div>

          {analysis.hookSuggestion && (
            <section className="report-section report-section--hook">
              <h3>פתיחה מוצעת (Hook)</h3>
              <p className="hook-text">"{analysis.hookSuggestion}"</p>
            </section>
          )}

          {analysis.scriptSuggestion && (
            <section className="report-section report-section--script">
              <h3>תסריט משופר</h3>
              <pre>{analysis.scriptSuggestion}</pre>
            </section>
          )}

          {result.transcript && (
            <details className="transcript">
              <summary>תמלול הסרטון</summary>
              <pre>{result.transcript}</pre>
            </details>
          )}

          <div className="report__bottom-cta">
            <p>עזר? שתף עם מי שמעלה רילסים</p>
            <Link to="/" className="btn-action">חזרה לדף הבית</Link>
          </div>
        </div>
      )}
    </div>
  );
}
