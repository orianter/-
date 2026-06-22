const ig = process.argv[2] || 'https://www.instagram.com/reel/DCqVQx1P0y2/';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const tests = [
  ['ddinstagram', async () => {
    const shortcode = ig.match(/reel\/([^/?]+)/)?.[1];
    const r = await fetch(`https://www.ddinstagram.com/reel/${shortcode}/`, { headers: { 'User-Agent': DESKTOP } });
    return r.text();
  }],
  ['insta-save', async () => {
    const r = await fetch('https://insta-save.net/api/ajaxSearch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://insta-save.net', Referer: 'https://insta-save.net/' },
      body: `q=${encodeURIComponent(ig)}&t=media&lang=en`,
    });
    return r.text();
  }],
  ['saveig', async () => {
    const r = await fetch('https://saveig.app/api/ajaxSearch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://saveig.app', Referer: 'https://saveig.app/' },
      body: `q=${encodeURIComponent(ig)}&t=media&lang=en`,
    });
    return r.text();
  }],
  ['snapinsta ig', async () => {
    const r = await fetch('https://snapinsta.app/api/ajaxSearch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://snapinsta.app', Referer: 'https://snapinsta.app/' },
      body: `q=${encodeURIComponent(ig)}&t=media&lang=en`,
    });
    return r.text();
  }],
  ['insta loader', async () => {
    const shortcode = ig.match(/reel\/([^/?]+)/)?.[1];
    const r = await fetch(`https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`, {
      headers: { 'User-Agent': DESKTOP, 'X-IG-App-ID': '936619743392459' },
    });
    return r.text();
  }],
  ['graph ql embed', async () => {
    const shortcode = ig.match(/reel\/([^/?]+)/)?.[1];
    const r = await fetch(`https://www.instagram.com/reel/${shortcode}/embed/`, { headers: { 'User-Agent': DESKTOP } });
    return r.text();
  }],
];

function findMp4(text) {
  const patterns = [
    /"video_url":"(https:[^"]+)"/,
    /property="og:video" content="([^"]+)"/,
    /"contentUrl":"(https:[^"]+\.mp4[^"]*)"/,
    /href="(https:[^"]+\.mp4[^"]*)"/,
    /(https:[^"'\s]+\.mp4[^"'\s]*)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return (m[1] || m[0]).replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
  }
  return null;
}

for (const [name, fn] of tests) {
  try {
    const text = await fn();
    const mp4 = findMp4(text);
    console.log('\n===', name, 'len', text.length, mp4 ? 'FOUND' : 'no');
    if (mp4) console.log(mp4.slice(0, 180));
    else console.log(text.slice(0, 200));
  } catch (e) {
    console.log('\n===', name, 'ERR', e.message);
  }
}
