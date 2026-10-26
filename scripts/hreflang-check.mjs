// Usage: node scripts/hreflang-check.mjs <base>   (ex. https://groupe-abc.fr ou http://localhost:4000)
// Compare les hreflang de chaque page du sitemap à ceux du sitemap ; signale article-N / news.
const base = process.argv[2], PUBLIC = 'https://groupe-abc.fr';
const xml = await (await fetch(base + '/sitemap.xml')).text();
const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
  loc: m[1].match(/<loc>([^<]*)/)[1],
  alts: [...m[1].matchAll(/hreflang="([^"]*)" href="([^"]*)"/g)].map((a) => `${a[1]}=${a[2]}`).sort().join(' '),
}));
const bad = [];
for (const u of urls) {
  const html = await (await fetch(base + u.loc.replace(PUBLIC, ''), { headers: { 'user-agent': 'Googlebot' } })).text();
  const page = [...html.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)"/g)]
    .map((a) => `${a[1]}=${a[2].replace(/^https?:\/\/[^/]+/, PUBLIC)}`).sort().join(' ');
  if (page !== u.alts) bad.push(`${u.loc}\n  sitemap: ${u.alts}\n  page:    ${page}`);
}
console.log(bad.join('\n') || 'aucune divergence');
console.log(`${urls.length - bad.length}/${urls.length} hreflang page = sitemap`);
console.log('article-N / news dans le sitemap :', /\/(article-\d+|news)<\/loc>|\/(article-\d+|news)"/.test(xml));
