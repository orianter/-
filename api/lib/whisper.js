export function formatTranscript(transcription) {
  if (!transcription) return '(ללא דיבור מזוהה)';
  if (typeof transcription === 'string') return transcription.trim() || '(ללא דיבור מזוהה)';

  const text = typeof transcription.text === 'string' ? transcription.text.trim() : '';
  const segments = Array.isArray(transcription.segments) ? transcription.segments : [];

  if (segments.length) {
    return segments
      .filter((seg) => seg && typeof seg.text === 'string' && seg.text.trim())
      .map((seg) => {
        const start = Math.max(0, Math.round(Number(seg.start) || 0));
        return `[${start}s] ${seg.text.trim()}`;
      })
      .join('\n');
  }

  return text || '(ללא דיבור מזוהה)';
}

export async function transcribeAudioBase64(base64, apiKey, { language = 'he' } = {}) {
  if (!base64?.trim()) return null;

  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) return null;

  const blob = new Blob([buffer], { type: 'audio/wav' });
  const form = new FormData();
  form.append('file', blob, 'reel-audio.wav');
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  if (language) form.append('language', language);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error?.message || 'שגיאה בתמלול Whisper');
  }

  return json;
}

export function estimateAnalysisCostUsd(durationSec = 30, { hasVision = false, hasWhisper = true } = {}) {
  const minutes = Math.min(Math.max(Number(durationSec) || 30, 5), 60) / 60;
  const whisper = hasWhisper ? minutes * 0.006 : 0;
  const gptInput = hasVision ? 0.025 + minutes * 0.015 : 0.008 + minutes * 0.004;
  const gptOutput = hasVision ? 0.022 : 0.012;
  const total = whisper + gptInput + gptOutput;
  return {
    whisperUsd: Math.round(whisper * 1000) / 1000,
    gptUsd: Math.round((gptInput + gptOutput) * 1000) / 1000,
    totalUsd: Math.round(total * 1000) / 1000,
    totalIls: Math.round(total * 3.7 * 100) / 100,
  };
}
