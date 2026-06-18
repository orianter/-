import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl } from '../api';
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
  { label: 'מעלה סרטון', icon: '📤' },
  { label: 'מחלץ אודיו', icon: '🎧' },
  { label: 'דוגם פריימים', icon: '🎞️' },
  { label: 'מתמלל', icon: '💬' },
  { label: 'מנתח AI', icon: '🧠' },
  { label: 'מכין דוח', icon: '📋' },
];

const MAX_FILE_MB = 100;

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
    fetch(apiUrl('/api/health'))
      .then((r) => r.json())
      .then(setApiReady)
      .catch(() => setApiReady({ ok: false, hasApiKey: false, unreachable: true }));
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

    const form = new FormData();
    form.append('video', file);
    form.append('platform', platform);
    form.append('goal', goal);
    form.append('problem', problem);

    try {
      const res = await fetch(apiUrl('/api/analyze'), { method: 'POST', body: form });
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
        <p>העלה רילס או טיקטוק (עד דקה) וקבל דוח מלא תוך כדקה</p>
      </div>

      {apiReady && apiReady.unreachable && (
        <div className="analyze-alert analyze-alert--error">
          <strong>השרת לא זמין כרגע.</strong> ודא שהשרת רץ (הפעל.bat) ונסה לרענן את הדף.
        </div>
      )}

      {apiReady && apiReady.demoMode && (
        <div className="analyze-alert analyze-alert--demo">
          <strong>מצב הדגמה פעיל:</strong> תקבל דוח לדוגמה המבוסס על נתוני הסרטון האמיתיים שלך
          (אורך, פורמט). לניתוח AI מלא — הוסף מפתח OpenAI בקובץ <code>server/.env</code>.
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
            disabled={!file || !apiReady || apiReady.unreachable}
            onClick={analyze}
          >
            {apiReady?.demoMode ? 'נתח את הסרטון (הדגמה) ←' : 'נתח את הסרטון ←'}
          </button>

          <p className="analyze-disclaimer">
            הסרטון נמחק מהשרת מיד אחרי הניתוח · לא נשמר ולא משותף
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
