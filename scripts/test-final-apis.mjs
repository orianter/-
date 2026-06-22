const ig = process.argv[2] || 'https://www.instagram.com/reel/DCqVQx1P0y2/';
const shareUrl = process.argv[3] || 'https://www.tiktok.com/@scout2015/video/6718339390846394118';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function test(name, fn) {
  try {
    const text = await fn();
    const mp4 = text.match(/"video_url":"(https:[^"]+)"/)
      || text.match(/href="(https:[^"]+\.mp4[^"]*)"/)
      || text.match(/"url":"(https:[^"]+\.mp4[^"]*)"/)
      || text.match(/(https:[^"'\s]+cdninstagram[^"'\s]+\.mp4[^"'\s]*)/);
    console.log('\n===', name, 'len', text.length, mp4 ? 'FOUND' : 'no');
    if (mp4) console.log((mp4[1] || mp4[0]).slice(0, 180));
    else console.log(text.slice(0, 250));
  } catch (e) {
    console.log('\n===', name, 'ERR', e.message);
  }
}

await test('sssinstagram', async () => {
  const r = await fetch('https://sssinstagram.com/api/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://sssinstagram.com', Referer: 'https://sssinstagram.com/' },
    body: JSON.stringify({ url: ig }),
  });
  return r.text();
});

await test('snapinsta.to', async () => {
  const r = await fetch('https://snapinsta.to/api/ajaxSearch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://snapinsta.to', Referer: 'https://snapinsta.to/' },
    body: `q=${encodeURIComponent(ig)}&t=media&lang=en`,
  });
  return r.text();
});

await test('insta downloader net', async () => {
  const r = await fetch('https://instadownloader.co/api/ajaxSearch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://instadownloader.co', Referer: 'https://instadownloader.co/' },
    body: `q=${encodeURIComponent(ig)}&t=media&lang=en`,
  });
  return r.text();
});

await test('m tiktok', async () => {
  const id = shareUrl.match(/video\/(\d+)/)?.[1];
  const r = await fetch(`https://m.tiktok.com/v/${id}.html`, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  return r.text();
});

await test('lovetik m url', async () => {
  const id = shareUrl.match(/video\/(\d+)/)?.[1];
  const murl = `https://m.tiktok.com/v/${id}.html`;
  const r = await fetch('https://lovetik.app/api/ajaxSearch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://lovetik.app', Referer: 'https://lovetik.app/' },
    body: `q=${encodeURIComponent(murl)}&lang=en`,
  });
  return r.text();
});

await test('tiktok api ssut', async () => {
  const mod = await import('@ssut/tiktok-api');
  const TikTok = mod.default || mod;
  const result = await TikTok.getVideoMeta(shareUrl);
  return JSON.stringify(result);
});
