const MAX_FILE_MB = 100;

const URL_IN_TEXT_RE =
  /https?:\/\/(?:www\.)?(?:tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com|instagram\.com|instagr\.am)[^\s<>"']+/gi;

export function extractShareUrlFromText(input) {
  const text = String(input || '').trim();
  if (!text) return '';
  const matches = text.match(URL_IN_TEXT_RE);
  if (matches?.length) return matches[0].replace(/[.,;:!?)]+$/, '');
  return text.split(/\s+/).find((part) => /^https?:\/\//i.test(part))?.replace(/[.,;:!?)]+$/, '') || text;
}

export function detectSharePlatform(input) {
  const url = extractShareUrlFromText(input);
  try {
    const { hostname } = new URL(url.trim());
    const host = hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    if (/tiktok\.com|vm\.tiktok|vt\.tiktok/.test(host)) return 'tiktok';
    if (/instagram\.com|instagr\.am/.test(host)) return 'instagram';
    if (/youtube\.com|youtu\.be/.test(host)) return 'youtube';
    if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return 'direct';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

const PLATFORM_LABELS = {
  tiktok: 'TikTok',
  instagram: 'Instagram Reels',
  youtube: 'YouTube',
  direct: 'קישור ישיר',
  unknown: 'קישור',
};

function formatLoadError(data, status) {
  if (data?.error) return data.error;
  if (status === 502) return 'ההורדה נכשלה מהמקור. שמור את הסרטון מהאפליקציה והעלה קובץ.';
  if (status >= 500) return 'שגיאת שרת זמנית. נסה שוב או העלה קובץ.';
  return 'לא הצלחנו לטעון את הקישור. נסה להעלות קובץ מהמכשיר.';
}

export async function loadVideoFromShareUrl(shareUrl) {
  const cleaned = extractShareUrlFromText(shareUrl);
  if (!cleaned) throw new Error('יש להדביק קישור לסרטון');

  const platform = detectSharePlatform(cleaned);
  if (platform === 'youtube') {
    throw new Error('YouTube עדיין לא נתמך בקישור — העלה את הקובץ או הדבק קישור TikTok/Reels.');
  }
  if (platform === 'unknown') {
    throw new Error('קישור לא מזוהה. הדבק קישור TikTok, Instagram Reels, או MP4 ישיר.');
  }

  const resolveRes = await fetch('/api/resolve-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: cleaned }),
  });
  const resolved = await resolveRes.json();
  if (!resolveRes.ok) {
    const label = PLATFORM_LABELS[platform] || 'הקישור';
    const base = resolved.error || formatLoadError(resolved, resolveRes.status);
    if (resolved.fallback === 'upload' && !base.includes('העלה')) {
      throw new Error(`${base} (${label})`);
    }
    throw new Error(base);
  }

  const videoRes = await fetch(resolved.proxyUrl);
  if (!videoRes.ok) {
    const err = await videoRes.json().catch(() => ({}));
    throw new Error(err.error || 'ההורדה נכשלה — שמור מהאפליקציה והעלה קובץ MP4.');
  }

  const blob = await videoRes.blob();
  if (blob.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error(`הסרטון גדול מדי (${(blob.size / 1024 / 1024).toFixed(0)}MB). המקסימום הוא ${MAX_FILE_MB}MB.`);
  }
  if (!blob.size) throw new Error('הקישור לא החזיר קובץ וידאו — נסה להעלות קובץ.');

  const fileName = resolved.fileName || 'shared-video.mp4';
  const file = new File([blob], fileName, {
    type: resolved.contentType || blob.type || 'video/mp4',
  });

  return {
    file,
    platformHint: resolved.platformHint,
    title: resolved.title || '',
    sourceUrl: resolved.sourceUrl || cleaned,
    platform: resolved.platform || platform,
  };
}

export function looksLikeShareUrl(value) {
  return detectSharePlatform(value) !== 'unknown';
}

export function sharePlatformLabel(value) {
  return PLATFORM_LABELS[detectSharePlatform(value)] || '';
}
