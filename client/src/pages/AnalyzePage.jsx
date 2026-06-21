import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { analyzeFunctionUrl, analyzeHeaders, hasSupabaseConfig } from '../api';
import { AiDisclaimer } from '../components/AiDisclaimer';
import {
  AnalysisSection,
  buildReportText,
  CategoryScores,
  DetailedFindings,
  ImprovementPlan,
  MeasuredEvidence,
  OnScreenText,
  PriorityFixes,
  ReportCostEstimate,
  ReportDataSources,
  ScoreRing,
  SpeechMetricsSummary,
  scoreColor,
  scoreVerdictLabel,
  Timeline,
} from '../components/Report';
import { extractAudioForWhisper } from '../lib/audioWhisper';
import { loadVideoFromShareUrl } from '../lib/videoFromUrl';

const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok', icon: '🎵', desc: 'טרנדים, hook מהיר' },
  { id: 'reels', label: 'Reels', icon: '📸', desc: 'אסתטיקה, סטוריטלינג' },
  { id: 'both', label: 'שניהם', icon: '✨', desc: 'אופטימיזציה כפולה' },
];

const STEPS = [
  { label: 'קורא פרטי סרטון', icon: '📤' },
  { label: 'דוגם פריימים', icon: '🎞️' },
  { label: 'מנתח אודיו', icon: '🎧' },
  { label: 'מתמלל (Whisper)', icon: '🎙️' },
  { label: 'מכין Vision', icon: '👁️' },
  { label: 'מנתח AI', icon: '🧠' },
  { label: 'מכין דוח', icon: '📋' },
];

const MAX_FILE_MB = 100;
const FRAME_SAMPLE_SIZE = 180;
const VISION_FRAME_SIZE = 640;
const VISION_FRAME_SIZE_HOOK = 768;

function average(items, key) {
  const values = items.map((item) => Number(item[key])).filter(Number.isFinite);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function frameTimestamps(durationSec) {
  const duration = Math.min(Math.max(Number(durationSec) || 0, 0), 60);
  const points = new Set([0.15, 0.5, 1, 1.5, 2, 3, 4, 5]);

  for (let t = 6; t < duration - 1; t += 3) {
    points.add(t);
  }
  if (duration > 6) points.add(Math.round(duration * 0.25 * 10) / 10);
  if (duration > 10) points.add(Math.round(duration * 0.5 * 10) / 10);
  if (duration > 14) points.add(Math.round(duration * 0.75 * 10) / 10);
  if (duration > 4) points.add(Math.max(0.2, duration - 1.5));
  if (duration > 8) points.add(Math.max(0.5, duration - 0.5));

  return [...points]
    .filter((point) => point > 0 && point < duration)
    .sort((a, b) => a - b)
    .slice(0, 14);
}

function visionFrameTimestamps(durationSec) {
  const duration = Math.min(Math.max(Number(durationSec) || 0, 0), 60);
  const points = [0.3, 1, 3];
  if (duration > 10) points.push(Math.round(duration * 0.45 * 10) / 10);
  if (duration > 6) points.push(Math.max(1, duration - 1.5));
  return [...new Set(points.filter((p) => p > 0 && p < duration))].slice(0, 5);
}

function allSampleTimestamps(durationSec) {
  return [...new Set([...frameTimestamps(durationSec), ...visionFrameTimestamps(durationSec)])]
    .sort((a, b) => a - b)
    .slice(0, 18);
}

function visionLabel(second, durationSec) {
  if (second <= 1) return 'פריים ראשון — Hook';
  if (second <= 3) return '3 שניות ראשונות — Hook';
  if (second >= (durationSec || 60) * 0.65) return 'סיום — CTA';
  return 'אמצע הסרטון';
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

function drawScaledFrame(video, canvas, ctx, targetSize) {
  const sourceWidth = video.videoWidth || targetSize;
  const sourceHeight = video.videoHeight || targetSize;
  const scale = targetSize / Math.max(sourceWidth, sourceHeight);
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
}

function canvasToJpegBase64(canvas, quality = 0.68) {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
}

async function analyzeAudio(file, durationSec) {
  const maxSec = Math.min(Number(durationSec) || 60, 60);
  try {
    const buffer = await file.arrayBuffer();
    const ctx = new AudioContext();
    const audioBuffer = await Promise.race([
      ctx.decodeAudioData(buffer.slice(0)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
    ]);
    await ctx.close();

    const channel = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const windowSec = 0.5;
    const windowSize = Math.floor(sampleRate * windowSec);
    const windows = [];

    for (let start = 0; start < channel.length; start += windowSize) {
      const end = Math.min(start + windowSize, channel.length);
      let sumSq = 0;
      for (let i = start; i < end; i += 1) sumSq += channel[i] * channel[i];
      const rms = Math.sqrt(sumSq / Math.max(1, end - start));
      windows.push({
        second: Math.round((start / sampleRate) * 10) / 10,
        rms: Math.round(rms * 1000) / 1000,
      });
      if (start / sampleRate > maxSec) break;
    }

    if (!windows.length) return { analyzed: false };

    const hookWindows = windows.filter((w) => w.second <= 3);
    const avgRms = average(windows, 'rms') ?? 0;
    const hookRms = average(hookWindows, 'rms') ?? avgRms;
    const silentThreshold = 0.012;
    const silentRatio = Math.round((windows.filter((w) => w.rms < silentThreshold).length / windows.length) * 100);
    const hookSilentRatio = hookWindows.length
      ? Math.round((hookWindows.filter((w) => w.rms < silentThreshold).length / hookWindows.length) * 100)
      : 0;
    const loudest = windows.reduce((best, w) => (w.rms > best.rms ? w : best), windows[0]);

    return {
      analyzed: true,
      hasAudio: avgRms >= silentThreshold,
      avgVolume: Math.round(avgRms * 1000) / 1000,
      hookVolume: Math.round(hookRms * 1000) / 1000,
      silentRatio,
      hookSilentRatio,
      loudestAtSec: loudest.second,
      openingWeak: hookRms < avgRms * 0.6,
      mostlySilent: silentRatio > 45,
      rmsWindows: windows.slice(0, 80),
    };
  } catch {
    return { analyzed: false };
  }
}

function buildAnalysisDigest(frameMetrics, videoMeta, audioMetrics) {
  const width = Number(videoMeta?.width);
  const height = Number(videoMeta?.height);
  const durationSec = Number(videoMeta?.durationSec) || 60;
  const ratio = width && height ? height / width : null;
  const near916 = ratio ? Math.abs(ratio - 16 / 9) < 0.12 : null;
  const hookFrames = frameMetrics.filter((f) => Number(f.second) <= 3);
  const hookChange = average(hookFrames.slice(1), 'sceneChange');
  const hookSharpness = average(hookFrames, 'sharpness');
  const hookBrightness = average(hookFrames, 'brightness');
  const avgChange = average(frameMetrics.slice(1), 'sceneChange');
  const avgBrightness = average(frameMetrics, 'brightness');
  const avgSharpness = average(frameMetrics, 'sharpness');
  const findings = [];

  if (ratio !== null) {
    findings.push(height > width
      ? (near916 ? 'פורמט אנכי 9:16 — מתאים לרילס/טיקטוק' : `פורמט אנכי (${width}×${height}) — לא בדיוק 9:16`)
      : `פורמט לא אנכי (${width}×${height}) — פוגע בפיד`);
  }
  if (durationSec > 35) findings.push(`אורך ${durationSec.toFixed(0)} שניות — ארוך יחסית לרילס`);
  if (hookChange !== null && hookChange < 7) findings.push(`ב-Hook (0-3 שנ') שינוי ויזואלי ${Math.round(hookChange)}% — נמוך`);
  if (hookSharpness !== null && hookSharpness < 10) findings.push(`חדות בפתיחה ${Math.round(hookSharpness)} — רכה/מטושטשת`);
  if (hookBrightness !== null && hookBrightness < 70) findings.push(`בהירות בפתיחה ${Math.round(hookBrightness)} — חשוך`);
  if (avgChange !== null && avgChange < 6) findings.push(`קצב ויזואלי ממוצע ${Math.round(avgChange)}% — איטי`);
  if (avgBrightness !== null && avgBrightness < 70) findings.push(`בהירות ממוצעת ${Math.round(avgBrightness)} — חשוך`);
  if (avgSharpness !== null && avgSharpness < 10) findings.push(`חדות ממוצעת ${Math.round(avgSharpness)} — נמוכה`);
  if (audioMetrics?.analyzed) {
    if (!audioMetrics.hasAudio) findings.push('כמעט אין אודיו מזוהה');
    else if (audioMetrics.openingWeak) findings.push('עוצמת האודיו בפתיחה חלשה יחסית לשאר הסרטון');
    else if (audioMetrics.hookSilentRatio > 50) findings.push('יש שקט משמעותי ב-3 השניות הראשונות');
  }

  let longestStaticSec = 0;
  let staticStart = null;
  for (let i = 1; i < frameMetrics.length; i += 1) {
    const prev = frameMetrics[i - 1];
    const curr = frameMetrics[i];
    const gap = Number(curr.second) - Number(prev.second);
    if ((Number(curr.sceneChange) || 0) < 6 && gap >= 1.5) {
      if (staticStart === null) staticStart = Number(prev.second);
      longestStaticSec = Math.max(longestStaticSec, Number(curr.second) - staticStart);
    } else {
      staticStart = null;
    }
  }
  if (longestStaticSec >= 3.5) findings.push(`קטע סטטי של ~${Math.round(longestStaticSec)} שניות`);

  return {
    frameCount: frameMetrics.length,
    durationSec,
    aspectRatio: ratio ? Number(ratio.toFixed(2)) : null,
    isVertical916: near916 === true,
    hookSceneChange: hookChange !== null ? Math.round(hookChange) : null,
    avgSceneChange: avgChange !== null ? Math.round(avgChange) : null,
    longestStaticSec: longestStaticSec ? Math.round(longestStaticSec * 10) / 10 : null,
    avgBrightness: avgBrightness !== null ? Math.round(avgBrightness) : null,
    avgSharpness: avgSharpness !== null ? Math.round(avgSharpness) : null,
    audio: audioMetrics?.analyzed ? {
      hasAudio: audioMetrics.hasAudio,
      hookSilentRatio: audioMetrics.hookSilentRatio,
      openingWeak: audioMetrics.openingWeak,
    } : null,
    findings,
  };
}

async function sampleVideoFrames(file, durationSec) {
  const timestamps = allSampleTimestamps(durationSec);
  const visionTimes = visionFrameTimestamps(durationSec);
  if (!timestamps.length) return { frameMetrics: [], frameImages: [] };

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const visionCanvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const visionCtx = visionCanvas.getContext('2d');
    const samples = [];
    const frameImages = [];
    const visionTargets = visionTimes.map((t) => Math.round(t * 10) / 10);
    let previousData = null;
    let index = 0;
    let finished = false;

    let timer = null;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve({ frameMetrics: samples, frameImages });
    };
    if (!ctx) {
      finish();
      return;
    }

    const captureVision = (second) => {
      if (!visionCtx) return;
      const isHook = second <= 1;
      const size = isHook ? VISION_FRAME_SIZE_HOOK : VISION_FRAME_SIZE;
      drawScaledFrame(video, visionCanvas, visionCtx, size);
      const base64 = canvasToJpegBase64(visionCanvas, isHook ? 0.75 : 0.68);
      if (base64) {
        frameImages.push({
          second,
          label: visionLabel(second, durationSec),
          isHook,
          base64,
        });
      }
    };

    const captureCurrentFrame = () => {
      const second = Math.round(timestamps[index] * 10) / 10;
      drawScaledFrame(video, canvas, ctx, FRAME_SAMPLE_SIZE);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      samples.push({
        second,
        ...computeFrameMetrics(imageData, previousData),
      });
      previousData = imageData;

      const visionIdx = visionTargets.indexOf(second);
      if (visionIdx !== -1) {
        captureVision(second);
        visionTargets.splice(visionIdx, 1);
      }

      index += 1;
      seekNextFrame();
    };

    const seekNextFrame = () => {
      if (index >= timestamps.length) {
        if (visionTargets.length && visionCtx) {
          captureAtVisionOnly(0);
          return;
        }
        finish();
        return;
      }
      video.currentTime = timestamps[index];
    };

    const captureAtVisionOnly = (visionIndex) => {
      if (visionIndex >= visionTargets.length) {
        finish();
        return;
      }
      video.onseeked = () => {
        captureVision(visionTargets[visionIndex]);
        captureAtVisionOnly(visionIndex + 1);
      };
      video.currentTime = visionTargets[visionIndex];
    };

    timer = setTimeout(finish, 20000);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadedmetadata = seekNextFrame;
    video.onseeked = captureCurrentFrame;
    video.onerror = finish;
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
  const [audience, setAudience] = useState('');
  const [niche, setNiche] = useState('');
  const [contentBrief, setContentBrief] = useState('');
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [apiReady, setApiReady] = useState(null);
  const [copied, setCopied] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [videoLink, setVideoLink] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [freeBlocked, setFreeBlocked] = useState(false);
  const fileInputRef = useRef(null);
  const stepTimerRef = useRef(null);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setApiReady({ ok: false, missingConfig: true });
      return undefined;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    analyzeHeaders()
      .then((headers) => fetch(analyzeFunctionUrl(), {
        signal: ctrl.signal,
        headers,
        credentials: 'include',
      }))
      .then((r) => r.json())
      .then((data) => {
        setApiReady(data);
        if (data.freeRemaining === 0) setFreeBlocked(true);
      })
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
    setVideoLink('');
    setVideoSource('upload');
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(selected);
    });
  }, []);

  const handleLoadLink = async () => {
    if (!videoLink.trim() || linkLoading) return;
    setLinkLoading(true);
    setError(null);
    setResult(null);
    try {
      const { file: loadedFile, platformHint, sourceUrl } = await loadVideoFromShareUrl(videoLink);
      if (platformHint === 'tiktok') setPlatform('tiktok');
      if (platformHint === 'reels') setPlatform('reels');
      setFile(loadedFile);
      setVideoSource(sourceUrl);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(loadedFile);
      });
    } catch (err) {
      setError(err.message);
      setFile(null);
      setVideoSource('');
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } finally {
      setLinkLoading(false);
    }
  };

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
    }, 3200);

    try {
      const videoMeta = await readVideoMetadata(file);
      if (videoMeta.durationSec && videoMeta.durationSec > 65) {
        throw new Error('הסרטון ארוך מדי. המקסימום הוא דקה אחת.');
      }
      const [{ frameMetrics, frameImages }, audioMetrics, whisperAudio] = await Promise.all([
        sampleVideoFrames(file, videoMeta.durationSec),
        analyzeAudio(file, videoMeta.durationSec),
        extractAudioForWhisper(file, videoMeta.durationSec),
      ]);
      const analysisDigest = buildAnalysisDigest(frameMetrics, videoMeta, audioMetrics);
      const payload = {
        platform,
        goal,
        problem,
        audience,
        niche,
        contentBrief,
        fileName: file.name,
        fileType: file.type,
        fileSizeMb: Math.round((file.size / 1024 / 1024) * 10) / 10,
        ...videoMeta,
        frameMetrics,
        frameImages,
        audioMetrics,
        analysisDigest,
      };
      if (whisperAudio?.available && whisperAudio.base64) {
        payload.audioWavBase64 = whisperAudio.base64;
      }
      const headers = await analyzeHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch(analyzeFunctionUrl(), {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'FREE_LIMIT_EXCEEDED' || res.status === 402) {
          setFreeBlocked(true);
          setApiReady((prev) => ({ ...(prev || {}), freeRemaining: 0 }));
        }
        throw new Error(data.error || 'שגיאה בניתוח');
      }
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
    setAudience('');
    setNiche('');
    setContentBrief('');
    setVideoLink('');
    setVideoSource('');
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
    <div className={`analyze-page ${result ? 'analyze-page--report' : ''}`}>
      <div className="analyze-page__head">
        <h1>{result ? 'הדוח שלך מוכן' : 'נתח את הסרטון שלך'}</h1>
        <p>
          {result
            ? 'משוב AI מבוסס דגימות מהסרטון — לא הבטחת תוצאות'
            : 'העלה רילס, מלא פרטים, וקבל משוב AI עם ציונים והמלצות מדויקות'}
        </p>
      </div>

      {apiReady && apiReady.ok && apiReady.freeRemaining === 1 && !apiReady.demoMode && !loading && !result && !freeBlocked && (
        <div className="analyze-alert analyze-alert--ok">
          <strong>✓ המערכת מוכנה.</strong> יש לך ניתוח חינמי אחד — העלה סרטון, מלא את הפרטים, והניתוח יתחיל. זמן משוער: 30–60 שניות.
        </div>
      )}

      {freeBlocked && !loading && !result && (
        <div className="analyze-alert analyze-alert--warn" role="alert">
          <strong>הניתוח החינמי כבר נוצל.</strong>{' '}
          כדי לנתח סרטון נוסף —{' '}
          <Link to="/#pricing">בחר מסלול</Link>.
        </div>
      )}

      {apiReady && apiReady.ok && apiReady.freeRemaining !== 1 && !apiReady.demoMode && !loading && !result && !freeBlocked && (
        <div className="analyze-alert analyze-alert--ok">
          <strong>✓ המערכת מוכנה.</strong> העלה סרטון, מלא את הפרטים — והניתוח יתחיל. זמן משוער: 30–60 שניות.
        </div>
      )}

      {apiReady && apiReady.missingConfig && (
        <div className="analyze-alert analyze-alert--error">
          <strong>הגדרות חסרות.</strong> ודא שה-API מוגדר נכון (Vercel / Supabase).
        </div>
      )}

      {apiReady && apiReady.unreachable && (
        <div className="analyze-alert analyze-alert--error">
          <strong>שירות הניתוח לא זמין כרגע.</strong> נסה שוב בעוד דקה. אם הבעיה נמשכת — רענן את הדף.
        </div>
      )}

      {apiReady && apiReady.demoMode && (
        <div className="analyze-alert analyze-alert--demo">
          <strong>מצב הדגמה:</strong> תקבל דוח לדוגמה על בסיס נתוני הסרטון (אורך, פורמát). לניתוח AI מלא — ודא ש-OPENAI_API_KEY מוגדר.
        </div>
      )}

      {loading && (
        <div className="loading-panel" role="status" aria-live="polite" aria-busy="true">
          <div className="loading-panel__spinner" />
          <h2>מנתח את הסרטון...</h2>
          <p>בדרך כלל 30–60 שניות. אל תסגור את הדף.</p>
          <div className="loading-panel__progress">
            <div
              className="loading-panel__progress-bar"
              style={{ width: `${Math.round(((stepIndex + 1) / STEPS.length) * 100)}%` }}
            />
          </div>
          <p className="loading-panel__pct">{Math.round(((stepIndex + 1) / STEPS.length) * 100)}% הושלם</p>
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
          <div className="analyze-tips">
            <div className="analyze-tip analyze-tip--highlight">
              <strong>📝 מה קורה בסרטון</strong>
              הכי חשוב! כתוב עם שניות: "0-2 שנ: אני אומר...", "בסוף: CTA"
            </div>
            <div className="analyze-tip">
              <strong>🎯 למה הסרטון</strong>
              לידים, מכירות, חשיפה — ממקד את הניתוח
            </div>
            <div className="analyze-tip">
              <strong>🔗 קישור שיתוף</strong>
              TikTok / Reels — הדבק קישור במקום להעלות קובץ
            </div>
            <div className="analyze-tip">
              <strong>👥 למי מיועד</strong>
              קהל ספציפי = המלצות מדויקות יותר
            </div>
          </div>

          <div className="analyze-checklist">
            <p className="analyze-checklist__title">מה תקבל בדוח:</p>
            <ul>
              <li>Whisper + מדדי דיבור (Hook, WPM, CTA)</li>
              <li>6 ציונים + ממצאים עם ראיה ותיקון מדויק</li>
              <li>טקסט על המסך, תסריט משופר ותוכנית שיפור</li>
            </ul>
          </div>

          <div className="url-import">
            <div className="url-import__divider">
              <span>או הדבק קישור שיתוף</span>
            </div>
            <label className="url-import__label" htmlFor="video-link-input">
              קישור TikTok / Instagram Reels
            </label>
            <div className="url-import__row">
              <input
                id="video-link-input"
                type="url"
                inputMode="url"
                placeholder="https://www.tiktok.com/... או https://www.instagram.com/reel/..."
                value={videoLink}
                onChange={(e) => setVideoLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLoadLink();
                  }
                }}
                disabled={linkLoading || loading}
              />
              <button
                type="button"
                className="btn-action btn-action--primary url-import__btn"
                onClick={handleLoadLink}
                disabled={!videoLink.trim() || linkLoading || loading}
              >
                {linkLoading ? 'טוען...' : 'טען סרטון'}
              </button>
            </div>
            <p className="url-import__hint">
              כמו שיתוף רגיל — הקישור לא נשמר, רק משמש להורדה זמנית לניתוח
            </p>
          </div>

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
                <p className="dropzone__sub">או לחץ לבחירת קובץ מהמכשיר</p>
                <span className="dropzone__hint">MP4 · MOV · WebM · עד 60 שניות</span>
              </>
            )}
          </div>

          {file && (
            <p className="file-name">
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
              {videoSource && videoSource.startsWith('http') && (
                <span className="file-name__source"> · נטען מקישור</span>
              )}
            </p>
          )}

          <div className="form-grid">
            <span className="form-section-label">פרטי הסרטון</span>

            <fieldset className="platform-picker">
              <legend>לאיזו פלטפורמה?</legend>
              <div className="platform-picker__options" role="radiogroup" aria-label="בחירת פלטפורמה">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={platform === p.id}
                    onClick={() => setPlatform(p.id)}
                    className={`platform-btn ${platform === p.id ? 'platform-btn--active' : ''}`}
                  >
                    <span className="platform-btn__icon">{p.icon}</span>
                    <span className="platform-btn__label">{p.label}</span>
                    <span className="platform-btn__desc">{p.desc}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <span className="form-section-label">לניתוח מדויק יותר</span>

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
              למי הסרטון מיועד? <span className="label-hint">(מומלץ)</span>
              <input
                type="text"
                placeholder="בעלי עסקים, כלות, מתאמנים, הורים צעירים..."
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              />
            </label>

            <label>
              נישה / תחום <span className="label-hint">(מומלץ)</span>
              <input
                type="text"
                placeholder="נדל״ן, כושר, SaaS, מסעדות, יופי..."
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
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

            <label>
              מה קורה / נאמר בסרטון? <span className="label-hint">(חובה לדיוק מקסימלי)</span>
              <textarea
                rows={4}
                placeholder="ככל שתפרט יותר — הניתוח יהיה מדויק יותר. לדוגמה: '0-2 שנ: אני מסתכל למצלמה ואומר...', 'יש טקסט על המסך: ...', 'בסוף: כתוב לי X'"
                value={contentBrief}
                onChange={(e) => setContentBrief(e.target.value)}
              />
            </label>
          </div>

          {error && (
            <div className="analyze-alert analyze-alert--error" role="alert" aria-live="assertive">
              {error}
              {freeBlocked && (
                <>
                  {' '}
                  <Link to="/#pricing">בחר מסלול ←</Link>
                </>
              )}
            </div>
          )}

          <AiDisclaimer variant="short" className="analyze-ai-note" />

          <button
            className="btn-analyze"
            disabled={!file || linkLoading || freeBlocked || !apiReady || apiReady.unreachable || apiReady.missingConfig}
            onClick={analyze}
            aria-describedby="analyze-help"
          >
            {freeBlocked
              ? 'הניתוח החינמי נוצל — בחר מסלול'
              : apiReady?.demoMode
                ? 'נתח את הסרטון (הדגמה) ←'
                : 'קבל משוב AI לסרטון ←'}
          </button>

          <p id="analyze-help" className="analyze-disclaimer">
            {!file && !linkLoading && 'העלה סרטון או הדבק קישור שיתוף. '}
            הסרטון/קישור לא נשמר · נשלחים מדדי פריימים, אודיו ל-Whisper, ועד 5 תמונות ל-Vision · הדוח הוא המלצת AI (OpenAI)
          </p>
        </div>
      )}

      {result && analysis && (
        <div id="report" className="report" aria-labelledby="report-heading">
          <h2 id="report-heading" className="visually-hidden">דוח ניתוח AI</h2>
          <div className="report__top">
            {result.demo && (
              <div className="report__demo-badge">
                דוח הדגמה · מבוסס על נתוני הסרטון האמיתיים שלך
              </div>
            )}
            <AiDisclaimer variant="short" />
            <ReportDataSources sources={result.dataSources} whisperUsed={result.whisperUsed} />
            <ReportCostEstimate estimate={result.costEstimate} />
            <SpeechMetricsSummary metrics={result.speechMetrics} />
            <div className="report__verdict-wrap">
              <ScoreRing score={analysis.score} />
              <div className="report__score-block">
                <p className="report__verdict-label">ציון AI משוער</p>
                <span
                  className="report__score-badge"
                  style={{ color: scoreColor(analysis.score), borderColor: `${scoreColor(analysis.score)}44` }}
                >
                  {scoreVerdictLabel(analysis.score)}
                </span>
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

          <ImprovementPlan
            priorityFixes={analysis.priorityFixes}
            whatToChange={analysis.whatToChange}
            howToImprove={analysis.howToImprove}
          />
          <DetailedFindings items={analysis.detailedFindings} />
          <OnScreenText items={analysis.onScreenText} />
          <MeasuredEvidence items={analysis.measuredEvidence} />
          <PriorityFixes items={analysis.priorityFixes} />
          <CategoryScores categories={analysis.categories} />
          <Timeline items={analysis.timeline} />

          <div className="report__sections">
            <AnalysisSection
              title="למה לא עבד"
              subtitle="סיבות ספציפיות לפי הנתונים"
              items={analysis.whyItFailed}
              variant="fail"
              icon="✕"
            />
            <AnalysisSection
              title="מה לשנות"
              subtitle="שינויים קונקרטיים לסרטון הבא"
              items={analysis.whatToChange}
              variant="change"
              icon="✎"
            />
            <AnalysisSection
              title="איך להפוך לטוב"
              subtitle="עקרונות לשיפור מתמשך"
              items={analysis.howToImprove}
              variant="improve"
              icon="↑"
            />
            <AnalysisSection
              title="טיפים לפלטפורמה"
              subtitle={`מותאם ל-${platformLabel}`}
              items={analysis.platformTips}
              variant="tips"
              icon="★"
            />
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

          {result.transcript && !result.transcript.startsWith('(') && (
            <details className="transcript">
              <summary>תמלול Whisper</summary>
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
