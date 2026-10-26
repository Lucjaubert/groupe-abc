// Usage: node scripts/check-seo.mjs <base> [--sitemap | /chemin ...]   (ex. https://groupe-abc.fr --sitemap)
// Pour chaque URL : statut, canonical, hreflang, robots ; signale canonical != URL servie.
const [base, ...rest] = process.argv.slice(2);
const PUBLIC = 'https://groupe-abc.fr';
const UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

async function get(path) {
  const res = await fetch(base + path, { redirect: 'manual', headers: { 'user-agent': UA } });
  const html = res.status === 200 ? await res.text() : '';
  const pick = (re) => [...html.matchAll(re)].map((m) => m[1]);
  return {
    status: res.status,
    location: res.headers.get('location') || '',
    canonical: pick(/<link rel="canonical" href="([^"]*)"/g),
    hreflang: pick(/<link rel="alternate" hreflang="([^"]*" href="[^"]*)"/g).map((s) => s.replace('" href="', '=')),
    robots: pick(/<meta name="robots" content="([^"]*)"/g),
  };
}

let paths = rest.filter((p) => p !== '--sitemap');
if (rest.includes('--sitemap')) {
  const xml = await (await fetch(base + '/sitemap.xml')).text();
  paths = [...new Set([...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1].replace(PUBLIC, '')))];
  console.log(`sitemap: ${paths.length} URL`);
}

let bad = 0;
for (const p of paths) {
  const r = await get(p);
  const self = PUBLIC + p;
  const ok = r.status === 200 && r.canonical.length === 1 && r.canonical[0] === self;
  if (!ok) bad++;
  if (!rest.includes('--sitemap') || !ok) {
    console.log(`${ok ? 'OK ' : 'KO '} ${r.status} ${p}${r.location ? ' -> ' + r.location : ''}`);
    console.log(`     canonical: ${r.canonical.join(' | ') || '(aucun)'}  robots: ${r.robots.join(' | ')}`);
    if (r.hreflang.length) console.log(`     hreflang: ${r.hreflang.join('  ')}`);
  }
}
console.log(`\n${paths.length - bad}/${paths.length} OK (200 + canonical = URL servie)`);
