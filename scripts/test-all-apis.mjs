const shareUrl = process.argv[2] || 'https://www.tiktok.com/@scout2015/video/6718339390846394118';

const tests = [
  ['tikwm POST', async () => {
    const r = await fetch('https://www.tikwm.com/api/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
      body: `url=${encodeURIComponent(shareUrl)}&hd=1`,
    });
    return r.text();
  }],
  ['tikwm GET', async () => {
    const r = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(shareUrl)}&hd=1`);
    return r.text();
  }],
  ['cobalt', async () => {
    const r = await fetch('https://api.cobalt.tools/', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: shareUrl, videoQuality: '720', downloadMode: 'auto' }),
    });
    return r.text();
  }],
  ['ssstik', async () => {
    const r = await fetch('https://ssstik.io/abc?url=dl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0',
        Origin: 'https://ssstik.io',
        Referer: 'https://ssstik.io/',
      },
      body: `id=${encodeURIComponent(shareUrl)}&locale=en&tt=YWJj`,
    });
    return r.text();
  }],
  ['musicaldown', async () => {
    const r = await fetch('https://musicaldown.com/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0',
        Origin: 'https://musicaldown.com',
        Referer: 'https://musicaldown.com/',
      },
      body: `link=${encodeURIComponent(shareUrl)}`,
    });
    return r.text();
  }],
  ['tikmate', async () => {
    const r = await fetch('https://api.tikmate.app/api/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: shareUrl }),
    });
    return r.text();
  }],
  ['douyin-wtf', async () => {
    const r = await fetch(`https://api.douyin.wtf/api?url=${encodeURIComponent(shareUrl)}`);
    return r.text();
  }],
  ['savefrom', async () => {
    const r = await fetch(`https://worker-savefrom-net.vercel.app/api/convert?url=${encodeURIComponent(shareUrl)}`);
    return r.text();
  }],
  ['tiktok-scraper7', async () => {
    const r = await fetch(`https://tiktok-scraper7.p.rapidapi.com/?url=${encodeURIComponent(shareUrl)}&hd=1`, {
      headers: process.env.RAPIDAPI_KEY ? { 'x-rapidapi-key': process.env.RAPIDAPI_KEY, 'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com' } : {},
    });
    return r.text();
  }],
];

for (const [name, fn] of tests) {
  try {
    const text = await fn();
    const mp4 = text.match(/https:[^"'\s\\]+\.mp4[^"'\s\\]*/i)
      || text.match(/"play":"(https:[^"]+)"/)
      || text.match(/"url":"(https:[^"]+\.mp4[^"]*)"/)
      || text.match(/download_url[^"]*"([^"]+)"/);
    console.log('\n===', name, 'len', text.length);
    console.log(text.slice(0, 400));
    if (mp4) console.log('FOUND:', (mp4[1] || mp4[0]).slice(0, 150));
  } catch (e) {
    console.log('\n===', name, 'ERR', e.message);
  }
}
