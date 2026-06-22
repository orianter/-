const shareUrl = process.argv[2] || 'https://www.tiktok.com/@scout2015/video/6718339390846394118';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function follow(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  return r.url;
}

const final = await follow(shareUrl);
console.log('final', final);

const apis = [
  ['lovetik q', `q=${encodeURIComponent(final)}&lang=en`],
  ['lovetik query', `query=${encodeURIComponent(final)}`],
  ['lovetik url', `url=${encodeURIComponent(final)}`],
];

for (const [name, body] of apis) {
  const r = await fetch('https://lovetik.app/api/ajaxSearch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: 'https://lovetik.app',
      Referer: 'https://lovetik.app/',
      'User-Agent': UA,
    },
    body,
  });
  const text = await r.text();
  console.log('\n', name, r.status, text.slice(0, 400));
}

// tikwm with final url
const tw = await fetch('https://www.tikwm.com/api/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `url=${encodeURIComponent(final)}&hd=1`,
});
console.log('\ntikwm', await tw.text());

// RapidAPI free tier test endpoints
const rapidEndpoints = [
  'tiktok-video-no-watermark2.p.rapidapi.com',
  'tiktok-scraper7.p.rapidapi.com',
];
for (const host of rapidEndpoints) {
  const r = await fetch(`https://${host}/?url=${encodeURIComponent(final)}&hd=1`, {
    headers: process.env.RAPIDAPI_KEY ? { 'x-rapidapi-key': process.env.RAPIDAPI_KEY, 'x-rapidapi-host': host } : {},
  });
  console.log('\nrapid', host, r.status, (await r.text()).slice(0, 200));
}
