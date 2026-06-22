const shareUrl = process.argv[2] || 'https://www.tiktok.com/@scout2015/video/6718339390846394118';

const apis = [
  ['tiktokio', async () => {
    const r = await fetch('https://tiktokio.com/api/v1/tk-htmx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://tiktokio.com', Referer: 'https://tiktokio.com/' },
      body: `prefix=dtGslb&vid=${encodeURIComponent(shareUrl)}`,
    });
    return r.text();
  }],
  ['snaptik app', async () => {
    const r = await fetch(`https://snaptik.app/abc?url=dl&url=${encodeURIComponent(shareUrl)}`);
    return r.text();
  }],
  ['ssstik dl2', async () => {
    const r = await fetch('https://ssstik.io/abc?url=dl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Origin: 'https://ssstik.io',
        Referer: 'https://ssstik.io/en',
      },
      body: `id=${encodeURIComponent(shareUrl)}&locale=en&tt=RFBiYg%3D%3D`,
    });
    return r.text();
  }],
  ['tikcdn', async () => {
    const r = await fetch(`https://tikcdn.io/ssstik?url=${encodeURIComponent(shareUrl)}`);
    return r.text();
  }],
  ['tiktokdownload online', async () => {
    const r = await fetch('https://tiktokdownload.online/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: shareUrl }),
    });
    return r.text();
  }],
  ['lovetik api2', async () => {
    const r = await fetch('https://lovetik.app/api/ajaxSearch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://lovetik.app', Referer: 'https://lovetik.app/' },
      body: `query=${encodeURIComponent(shareUrl)}`,
    });
    return r.text();
  }],
];

for (const [name, fn] of apis) {
  try {
    const text = await fn();
    const dl = text.match(/href="(https:[^"]+)"/g) || [];
    const mp4 = text.match(/https:[^"'\s\\]+\.mp4[^"'\s\\]*/i);
    const without = text.match(/without[^"]*"([^"]+\.mp4[^"]*)"/i);
    console.log('\n===', name, 'len', text.length);
    if (mp4) console.log('mp4', mp4[0].slice(0, 150));
    if (without) console.log('without', without[1].slice(0, 150));
    const dlMatch = text.match(/download[^"]*"(https:[^"]+)"/i);
    if (dlMatch) console.log('dl', dlMatch[1].slice(0, 150));
    if (!mp4 && !without && !dlMatch) console.log(text.slice(0, 350));
  } catch (e) {
    console.log('\n===', name, 'ERR', e.message);
  }
}
