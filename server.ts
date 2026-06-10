import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import express, { type Request, type Response, type NextFunction } from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import bootstrap from './src/main.server';
import { toNewsEnSlug } from './src/server/news-slugs';

type Lang = 'fr' | 'en';

/* =========================================================
 * ENV / constants
 * ======================================================= */
const PUBLIC_HOST = (process.env['PUBLIC_HOST'] || 'groupe-abc.fr')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '');
const PUBLIC_BASE = (process.env['PUBLIC_BASE'] || `https://${PUBLIC_HOST}`).replace(/\/$/, '');
const WP_API_BASE = (process.env['WP_API_BASE'] || `https://${PUBLIC_HOST}/wordpress`).replace(/\/$/, '');
const SITEMAP_TTL_MS = parseInt(process.env['SITEMAP_TTL_MS'] || String(15 * 60 * 1000), 10);
const SSR_TIMEOUT_MS = parseInt(process.env['SSR_TIMEOUT_MS'] || '15000', 10);

/* =========================================================
 * Lang detection (cookie -> geo headers -> Accept-Language)
 * ======================================================= */
function isBot(req: Request): boolean {
  const ua = String(req.header('user-agent') || '').toLowerCase();
  return /(googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebookexternalhit|twitterbot)/.test(ua);
}

function isStaticLikePath(pathname: string): boolean {
  const p = String(pathname || '');
  if (!p) return false;
  if (p === '/robots.txt' || p === '/sitemap.xml' || p === '/healthz' || p === '/healthz-node') return true;
  if (p.startsWith('/wp-json') || p.startsWith('/wp-admin') || p.startsWith('/wp-content')) return true;
  return /\.[a-z0-9]{2,6}$/i.test(p);
}

function detectLangFromReq(req: Request): Lang {
  const c = req.cookies?.['lang'];
  if (c === 'fr' || c === 'en') return c;

  const country = String(req.header('cf-ipcountry') || req.header('x-vercel-ip-country') || '')
    .trim()
    .toUpperCase();
  const EN_COUNTRIES = new Set(['US', 'GB', 'IE', 'CA', 'AU', 'NZ']);
  if (country && EN_COUNTRIES.has(country)) return 'en';

  const al = String(req.header('accept-language') || '').toLowerCase();
  if (al.includes('en') && !al.includes('fr')) return 'en';

  return 'fr';
}

/* =========================================================
 * Sitemap (FR/EN hreflang + news + methods_asset), cached
 * ======================================================= */
let sitemapCache: { xml: string; expiresAt: number } | null = null;

function xmlEscape(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toIsoDate(d: string | null): string | null {
  if (!d) return null;
  try {
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
  } catch {
    return null;
  }
}

function minimalSitemapXml(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <url><loc>${PUBLIC_BASE}/</loc></url>\n` +
    `</urlset>\n`
  );
}

const METHODS_CANONICAL_TO_EN: Record<string, string> = {
  'expertise-credit-bail': 'leasehold-financing',
  'expertise-bureaux-locaux-professionnels': 'offices-professional-premises',
  'expertise-locaux-commerciaux': 'retail-commercial-premises',
  'expertise-biens-residentiels': 'residential-assets',
};

function toMethodsEnSlug(canonicalSlug: string): string {
  const s = String(canonicalSlug || '').trim().toLowerCase();
  return METHODS_CANONICAL_TO_EN[s] || s;
}

async function fetchWpCollectionAll(endpointName: string, perPage = 100, maxPages = 50): Promise<any[]> {
  const out: any[] = [];
  let page = 1;
  while (page <= maxPages) {
    const endpoint =
      `${WP_API_BASE}/wp-json/wp/v2/${endpointName}` +
      `?per_page=${perPage}&page=${page}&_fields=slug,modified_gmt`;

    const res = await fetch(endpoint, { headers: { accept: 'application/json' } });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`WP_${endpointName.toUpperCase()}_FETCH_FAILED status=${res.status} body=${text.slice(0, 200)}`);
    }

    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) break;

    out.push(...arr);
    if (arr.length < perPage) break;
    page += 1;
  }
  return out;
}

interface SitemapEntry {
  frPath: string;
  enPath: string;
  xDefaultPath: string;
  lastmod: string | null;
  priority: string | null;
  changefreq: string | null;
}

function pageEntry(o: {
  frPath: string;
  enPath: string;
  lastmod?: string | null;
  priority?: string | null;
  changefreq?: string | null;
  xDefault?: Lang;
}): SitemapEntry {
  return {
    frPath: o.frPath,
    enPath: o.enPath,
    xDefaultPath: o.xDefault === 'en' ? o.enPath : o.frPath,
    lastmod: o.lastmod ?? null,
    priority: o.priority ?? null,
    changefreq: o.changefreq ?? null,
  };
}

function renderSitemapUrl(e: SitemapEntry, currentLang: Lang): string {
  const abs = (p: string) => `${PUBLIC_BASE}${p}`;
  const loc = currentLang === 'en' ? abs(e.enPath) : abs(e.frPath);
  const lastmodXml = e.lastmod ? `\n    <lastmod>${xmlEscape(e.lastmod)}</lastmod>` : '';
  const changefreqXml = e.changefreq ? `\n    <changefreq>${xmlEscape(e.changefreq)}</changefreq>` : '';
  const priorityXml = e.priority != null ? `\n    <priority>${xmlEscape(e.priority)}</priority>` : '';

  return [
    '  <url>',
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmodXml || null,
    changefreqXml || null,
    priorityXml || null,
    `    <xhtml:link rel="alternate" hreflang="fr" href="${xmlEscape(abs(e.frPath))}"/>`,
    `    <xhtml:link rel="alternate" hreflang="en" href="${xmlEscape(abs(e.enPath))}"/>`,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(abs(e.xDefaultPath))}"/>`,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

async function buildSitemapXml(): Promise<string> {
  const fixedPages: SitemapEntry[] = [
    pageEntry({ frPath: '/', enPath: '/en', changefreq: 'weekly', priority: '1.0', xDefault: 'fr' }),
    pageEntry({ frPath: '/expert-immobilier-reseau-national', enPath: '/en/expert-network-chartered-valuers', changefreq: 'monthly', priority: '0.8' }),
    pageEntry({ frPath: '/expertise-immobiliere-services', enPath: '/en/real-estate-valuation-services', changefreq: 'monthly', priority: '0.8' }),
    pageEntry({ frPath: '/methodes-evaluation-immobiliere', enPath: '/en/valuation-methods-assets', changefreq: 'monthly', priority: '0.7' }),
    pageEntry({ frPath: '/experts-immobiliers-agrees', enPath: '/en/chartered-valuers-team', changefreq: 'monthly', priority: '0.7' }),
    pageEntry({ frPath: '/actualites-expertise-immobiliere', enPath: '/en/real-estate-valuation-news', changefreq: 'weekly', priority: '0.7' }),
    pageEntry({ frPath: '/contact-expert-immobilier', enPath: '/en/contact-chartered-valuers', changefreq: 'monthly', priority: '0.6' }),
    pageEntry({ frPath: '/mentions-legales', enPath: '/en/legal-notice', changefreq: 'yearly', priority: '0.5' }),
  ];

  let wpNews: any[] = [];
  try {
    wpNews = await fetchWpCollectionAll('news');
  } catch (e) {
    console.error('[SITEMAP] WP news fetch failed:', (e as Error)?.message || e);
    wpNews = [];
  }
  const newsEntries = wpNews
    .filter((n) => n && typeof n.slug === 'string' && n.slug.trim())
    .map((n) => {
      const canonical = String(n.slug).trim().toLowerCase();
      return pageEntry({
        frPath: `/actualites-expertise-immobiliere/${encodeURIComponent(canonical)}`,
        enPath: `/en/real-estate-valuation-news/${encodeURIComponent(toNewsEnSlug(canonical))}`,
        lastmod: toIsoDate(n.modified_gmt ? `${n.modified_gmt}Z` : null),
        changefreq: 'monthly',
        priority: '0.6',
      });
    });

  let wpMethods: any[] = [];
  try {
    wpMethods = await fetchWpCollectionAll('methods_asset');
  } catch (e) {
    console.error('[SITEMAP] WP methods fetch failed:', (e as Error)?.message || e);
    wpMethods = [];
  }
  const methodsEntries = wpMethods
    .filter((m) => m && typeof m.slug === 'string' && m.slug.trim())
    .map((m) => {
      const canonical = String(m.slug).trim().toLowerCase();
      return pageEntry({
        frPath: `/methodes-evaluation-immobiliere/${encodeURIComponent(canonical)}`,
        enPath: `/en/valuation-methods-assets/${encodeURIComponent(toMethodsEnSlug(canonical))}`,
        lastmod: toIsoDate(m.modified_gmt ? `${m.modified_gmt}Z` : null),
        changefreq: 'monthly',
        priority: '0.6',
      });
    });

  const entries = [...fixedPages, ...newsEntries, ...methodsEntries];

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
    `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    entries.map((e) => [renderSitemapUrl(e, 'fr'), renderSitemapUrl(e, 'en')].join('\n')).join('\n') +
    `\n</urlset>\n`
  );
}

/* =========================================================
 * SSR render timeout guard (-> 503 instead of 200 empty)
 * ======================================================= */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timeoutId!: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('SSR_TIMEOUT')), ms);
  });
  return Promise.race([p, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

/* =========================================================
 * Express app
 * ======================================================= */
export function app(): express.Express {
  const server = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  const browserDistFolder = resolve(serverDistFolder, '../browser');
  const indexHtml = join(serverDistFolder, 'index.server.html');

  const commonEngine = new CommonEngine();

  server.disable('x-powered-by');
  server.set('view engine', 'html');
  server.set('views', browserDistFolder);

  server.use(compression());
  server.use(cookieParser());

  // Health (non-SSR)
  server.get('/healthz', (_req, res) => { res.status(200).type('text/plain').send('ok'); });
  server.get('/healthz-node', (_req, res) => { res.status(200).type('text/plain').send('ok'); });

  // Safety: WP routes are handled by nginx, must never hit SSR node
  server.get(['/wp-json/*', '/wp-admin/*', '/wp-content/*'], (_req, res) => {
    res.status(502).type('text/plain').send('WP routes should not hit SSR node');
  });

  // Lang auto-redirect (302 -> /en) + expose detected lang for SSR
  server.use((req: Request, res: Response, next: NextFunction) => {
    const path = req.path || '/';
    const isEnUrl = path === '/en' || path.startsWith('/en/');
    const lang = detectLangFromReq(req);

    res.locals['serverLang'] = lang;
    res.setHeader('X-LANG-DETECTED', lang);

    const hasLangCookie = req.cookies?.['lang'] === 'fr' || req.cookies?.['lang'] === 'en';

    if (!isStaticLikePath(path) && !hasLangCookie && !isBot(req) && lang === 'en' && !isEnUrl) {
      const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
      res.redirect(302, '/en' + path + qs);
      return;
    }

    next();
  });

  // robots.txt (dynamic)
  server.get('/robots.txt', (_req, res) => {
    res.status(200).type('text/plain; charset=UTF-8');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('X-ROBOTS-HIT', '1');
    res.send(`User-agent: *\nAllow: /\n\nSitemap: ${PUBLIC_BASE}/sitemap.xml\n`);
  });

  // sitemap.xml (dynamic, cached, WP-driven)
  server.get('/sitemap.xml', (_req, res) => {
    res.type('application/xml; charset=UTF-8');
    res.setHeader('X-SITEMAP-HIT', '1');

    const now = Date.now();
    if (sitemapCache && sitemapCache.expiresAt > now) {
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.status(200).send(sitemapCache.xml);
      return;
    }

    buildSitemapXml()
      .then((xml) => {
        sitemapCache = { xml, expiresAt: Date.now() + SITEMAP_TTL_MS };
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.status(200).send(xml);
      })
      .catch((e) => {
        console.error('[SITEMAP] fatal error:', e?.stack || e);
        res.setHeader('Cache-Control', 'public, max-age=60');
        res.status(200).send(sitemapCache?.xml || minimalSitemapXml());
      });
  });

  // Serve static files from /browser
  server.get('**', express.static(browserDistFolder, {
    maxAge: '1y',
    index: 'index.html',
  }));

  // All regular routes use the Angular engine (SSR)
  server.get('**', (req: Request, res: Response) => {
    const t0 = Date.now();
    const { protocol, originalUrl, baseUrl, headers } = req;

    withTimeout(
      commonEngine.render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        publicPath: browserDistFolder,
        providers: [
          { provide: APP_BASE_HREF, useValue: baseUrl },
          { provide: 'SERVER_LANG', useValue: res.locals['serverLang'] ?? 'fr' },
          { provide: 'SSR_REQUEST', useValue: req },
          { provide: 'SSR_RESPONSE', useValue: res },
        ],
      }),
      SSR_TIMEOUT_MS,
    )
      .then((html) => {
        // Do NOT force status 200: keep any status set during render
        // (e.g. NotFoundComponent sets 404 via SSR_RESPONSE).
        res.set('X-SSR', '1').set('X-SSR-TTFB-MS', String(Date.now() - t0)).send(html);
      })
      .catch((err) => {
        const code = err?.message === 'SSR_TIMEOUT' ? 'SSR_TIMEOUT' : (err?.message || 'SSR_ERROR');
        console.error('[SSR] render error:', err?.stack || err);
        res
          .status(503)
          .set('X-SSR', '0')
          .set('X-SSR-ERR', String(code))
          .set('X-SSR-TTFB-MS', String(Date.now() - t0))
          .type('text/plain; charset=utf-8')
          .send('SSR_FAILED');
      });
  });

  return server;
}

function run(): void {
  const port = process.env['PORT'] || 4000;

  // Start up the Node server
  const server = app();
  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

run();
