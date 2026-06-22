import { resolveShareUrl, extractShareUrlFromText, detectSharePlatform } from '../api/lib/resolveVideoUrl.js';

const url = process.argv[2] || 'https://www.tiktok.com/@scout2015/video/6718339390846394118';

console.log('input:', url);
console.log('extracted:', extractShareUrlFromText(url));
console.log('platform:', detectSharePlatform(url));

try {
  const result = await resolveShareUrl(url);
  console.log('OK', {
    directUrl: result.directUrl.slice(0, 120) + '...',
    fileName: result.fileName,
    platformHint: result.platformHint,
  });
} catch (err) {
  console.log('FAIL', err.message);
  process.exitCode = 1;
}
