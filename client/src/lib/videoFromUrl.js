const MAX_FILE_MB = 100;

export async function loadVideoFromShareUrl(shareUrl) {
  const trimmed = String(shareUrl || '').trim();
  if (!trimmed) throw new Error('יש להדביק קישור לסרטון');

  const resolveRes = await fetch('/api/resolve-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: trimmed }),
  });
  const resolved = await resolveRes.json();
  if (!resolveRes.ok) throw new Error(resolved.error || 'לא הצלחנו לטעון את הקישור');

  const videoRes = await fetch(resolved.proxyUrl);
  if (!videoRes.ok) {
    const err = await videoRes.json().catch(() => ({}));
    throw new Error(err.error || 'לא הצלחנו להוריד את הסרטון');
  }

  const blob = await videoRes.blob();
  if (blob.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error(`הסרטון גדול מדי (${(blob.size / 1024 / 1024).toFixed(0)}MB). המקסימום הוא ${MAX_FILE_MB}MB.`);
  }
  if (!blob.size) throw new Error('הקישור לא החזיר קובץ וידאו');

  const fileName = resolved.fileName || 'shared-video.mp4';
  const file = new File([blob], fileName, {
    type: resolved.contentType || blob.type || 'video/mp4',
  });

  return {
    file,
    platformHint: resolved.platformHint,
    title: resolved.title || '',
    sourceUrl: resolved.sourceUrl || trimmed,
  };
}

export function looksLikeShareUrl(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  return /^https?:\/\//i.test(text)
    || /tiktok\.com|instagram\.com|instagr\.am|vm\.tiktok|vt\.tiktok|youtu\.be|youtube\.com/i.test(text);
}
