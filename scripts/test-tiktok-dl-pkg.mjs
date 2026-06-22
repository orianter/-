import Tiktok from '@tobyg74/tiktok-api-dl';

const url = process.argv[2] || 'https://www.tiktok.com/@scout2015/video/6718339390846394118';

try {
  const result = await Tiktok.Downloader(url, { version: 'v1' });
  console.log('v1', JSON.stringify(result).slice(0, 800));
} catch (e) {
  console.log('v1 ERR', e.message);
}

try {
  const result = await Tiktok.Downloader(url, { version: 'v2' });
  console.log('v2', JSON.stringify(result).slice(0, 800));
} catch (e) {
  console.log('v2 ERR', e.message);
}

try {
  const result = await Tiktok.Downloader(url, { version: 'v3' });
  console.log('v3', JSON.stringify(result).slice(0, 800));
} catch (e) {
  console.log('v3 ERR', e.message);
}
