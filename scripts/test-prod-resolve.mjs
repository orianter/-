const url = 'https://www.tiktok.com/@scout2015/video/6718339390846394118';

const r = await fetch('https://reelzanalyze1.vercel.app/api/resolve-video', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url }),
});
const text = await r.text();
console.log('status', r.status);
console.log(text);
