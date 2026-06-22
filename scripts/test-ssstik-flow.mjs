const shareUrl = process.argv[2] || 'https://www.tiktok.com/@scout2015/video/6718339390846394118';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function ssstikFlow() {
  const home = await fetch('https://ssstik.io/en', { headers: { 'User-Agent': UA } });
  const html = await home.text();
  const ttMatch = html.match(/name="tt" value="([^"]+)"/);
  const tt = ttMatch?.[1] || 'YWJj';
  console.log('ssstik tt', tt);

  const res = await fetch('https://ssstik.io/abc?url=dl', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
      Origin: 'https://ssstik.io',
      Referer: 'https://ssstik.io/en',
    },
    body: `id=${encodeURIComponent(shareUrl)}&locale=en&tt=${encodeURIComponent(tt)}`,
  });
  const text = await res.text();
  console.log('status', res.status, 'len', text.length);
  const without = text.match(/href="(https:\/\/ssstik\.io\/abc\?url=dl[^"]+)"/);
  const direct = text.match(/href="(https:[^"]+\.mp4[^"]*)"/);
  const tikcdn = text.match(/href="(https:\/\/tikcdn\.io[^"]+)"/);
  console.log('without', without?.[1]?.slice(0, 120));
  console.log('direct mp4', direct?.[1]?.slice(0, 120));
  console.log('tikcdn', tikcdn?.[1]?.slice(0, 120));
  if (!without && !direct) console.log(text.slice(0, 500));
}

async function musicaldownFlow() {
  const home = await fetch('https://musicaldown.com/en', { headers: { 'User-Agent': UA } });
  const html = await home.text();
  const tokenMatch = html.match(/name="csrf-token" content="([^"]+)"/);
  const token = tokenMatch?.[1];
  console.log('musicaldown csrf', token?.slice(0, 20));

  const res = await fetch('https://musicaldown.com/download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
      Origin: 'https://musicaldown.com',
      Referer: 'https://musicaldown.com/en',
      ...(token ? { 'X-CSRF-TOKEN': token } : {}),
    },
    body: `link=${encodeURIComponent(shareUrl)}`,
  });
  const text = await res.text();
  console.log('musicaldown status', res.status, 'len', text.length);
  const mp4 = text.match(/href="(https:[^"]+\.mp4[^"]*)"/i);
  const btn = text.match(/href="([^"]+)"[^>]*>.*?Without watermark/i);
  console.log('mp4', mp4?.[1]?.slice(0, 150));
  console.log('btn', btn?.[1]?.slice(0, 150));
  if (!mp4 && !btn) {
    const dlLinks = [...text.matchAll(/href="(https:\/\/[^"]+)"/g)].slice(0, 8).map((m) => m[1]);
    console.log('links', dlLinks);
  }
}

await ssstikFlow();
console.log('\n---');
await musicaldownFlow();
