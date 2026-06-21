const STORAGE_KEY = 'ra_device_fp_v1';

function randomHex(bytes = 16) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashParts(parts) {
  const raw = parts.filter(Boolean).join('|');
  const encoded = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function buildFingerprintSeed() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const scr = typeof screen !== 'undefined' ? screen : {};
  const parts = [
    nav.userAgent || '',
    nav.language || '',
    nav.platform || '',
    String(nav.hardwareConcurrency || ''),
    String(scr.width || ''),
    String(scr.height || ''),
    String(scr.colorDepth || ''),
    String(new Date().getTimezoneOffset()),
  ];
  return hashParts(parts);
}

export async function getDeviceFingerprint() {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && /^[a-f0-9-]{16,64}$/.test(existing)) {
      return existing;
    }
    const seed = await buildFingerprintSeed();
    const fp = `${seed.slice(0, 32)}-${randomHex(8)}`;
    localStorage.setItem(STORAGE_KEY, fp);
    return fp;
  } catch {
    return randomHex(16);
  }
}
