// server.ts
import 'zone.js/node';

import express from 'express';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

import { join } from 'path';
import { CommonEngine } from '@angular/ssr';
import { APP_BASE_HREF } from '@angular/common';

import cors from 'cors';
import cookieParser from 'cookie-parser';

type Lang = 'fr' | 'en';

/**
 * Dossiers de build, RELATIFS au bundle serveur.
 *
 * Si ton fichier compilé est : /var/www/.../groupe-abc_angular/server/server.cjs
 * alors __dirname = /var/www/.../groupe-abc_angular/server
 *
 * ➜ BROWSER_DIST = /var/www/.../groupe-abc_angular/browser
 * ➜ SSR_DIST     = /var/www/.../groupe-abc_angular/server
 */
const SSR_DIST = __dirname;
const BROWSER_DIST = join(__dirname, '..', 'browser');

// On charge le bundle SSR Angular (dist/groupe-abc/server/main.cjs)
const mainServer = require(join(SSR_DIST, 'main.cjs')).default;

const app = express();

// ✅ Helper : rend les handlers async compatibles avec Express typings (pas de Promise retournée)
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// (debug) marquer les réponses qui passent par le SSR
app.use((req, res, next) => {
  res.setHeader('x-ssr', 'on');
  next();
});

// Cookies (pour persister la langue côté SSR)
app.use(cookieParser());

// End-point de santé (utile pour tests et monitoring)
app.get('/healthz', (_req, res) => {
  res.status(200).type('text/plain').send('ok');
});

// CORS / JSON
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────
// LANG AUTO (IP/headers) + redirect vers /en (SEO-friendly)
// ─────────────────────────────────────────────
function isBot(req: Request): boolean {
  const ua = String(req.header('user-agent') || '').toLowerCase();
  return /(googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebookexternalhit|twitterbot)/.test(ua);
}

function isStaticLikePath(pathname: string): boolean {
  // évite de rediriger les assets, sitemap, robots, wp-json, etc.
  if (!pathname) return false;
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml' || pathname === '/healthz') return true;
  if (pathname.startsWith('/wp-json')) return true;
  if (pathname.startsWith('/wp-admin') || pathname.startsWith('/wp-content')) return true;
  // fichiers avec extension (js/css/png/ico/xml/...)
  return /\.[a-z0-9]{2,6}$/i.test(pathname);
}

function detectLangFromReq(req: Request): Lang {
  // 1) cookie user (prioritaire)
  const c = (req as any).cookies?.lang;
  if (c === 'fr' || c === 'en') return c;

  // 2) Pays via headers infra (Cloudflare / Vercel / autres)
  const country =
    String(req.header('cf-ipcountry') || req.header('x-vercel-ip-country') || '')
      .trim()
      .toUpperCase();

  const EN_COUNTRIES = new Set(['US', 'GB', 'IE', 'CA', 'AU', 'NZ']);
  if (country && EN_COUNTRIES.has(country)) return 'en';

  // 3) Fallback Accept-Language
  const al = String(req.header('accept-language') || '').toLowerCase();
  if (al.includes('en') && !al.includes('fr')) return 'en';

  return 'fr';
}

// Middleware langue AVANT statiques et AVANT SSR
app.use((req, res, next) => {
  const path = req.path || '/';
  const isEnUrl = path === '/en' || path.startsWith('/en/');

  const hasLangCookie = (req as any).cookies?.lang === 'fr' || (req as any).cookies?.lang === 'en';
  const lang = detectLangFromReq(req);

  (res.locals as any).serverLang = lang;
  res.setHeader('x-lang-detected', lang);

  // Redirect uniquement vers EN (pas de redirect vers FR)
  if (!isStaticLikePath(path) && !hasLangCookie && !isBot(req) && lang === 'en' && !isEnUrl) {
    const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    const target = '/en' + path + qs;
    return res.redirect(302, target);
  }

  next();
});

// ─────────────────────────────────────────────
// Proxy vers l’API WordPress (avant SSR)
// ─────────────────────────────────────────────
app.use(
  '/wp-json',
  asyncHandler(async (req, res) => {
    try {
      // ✅ Node 18/20 : fetch natif
      const response = await fetch(`https://wordpress.groupe-abc.fr/wp-json${req.url}`, {
        headers: { accept: 'application/json' },
      });

      if (!response.ok) {
        const txt = await response.text().catch(() => '');
        res
          .status(response.status)
          .type('application/json; charset=UTF-8')
          .send(JSON.stringify({ error: `WP API error ${response.status}`, body: txt.slice(0, 500) }));
        return;
      }

      const data = await response.json();
      res.status(200).json(data);
    } catch (error) {
      console.error('❌ Erreur API WordPress:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des données WordPress' });
    }
  })
);

// ─────────────────────────────────────────────
// SITEMAP + ROBOTS dynamiques (routes + news WP)
// IMPORTANT : doit être AVANT les statiques et AVANT le catch-all SSR
// + SÉCURITÉ : ne JAMAIS renvoyer du HTML sur /sitemap.xml, même si un bug survient
// ─────────────────────────────────────────────
const PUBLIC_BASE = (process.env['PUBLIC_BASE'] || 'https://groupe-abc.fr').replace(/\/$/, '');
const WP_API_BASE = (process.env['WP_API_BASE'] || 'https://wordpress.groupe-abc.fr').replace(/\/$/, '');

const NEWS_PUBLIC_PREFIX = process.env['NEWS_PUBLIC_PREFIX'] || '/actualites-expertise-immobiliere/';

// Cache mémoire simple
let sitemapCache: { xml: string; expiresAt: number } | null = null;
const SITEMAP_TTL_MS = parseInt(process.env['SITEMAP_TTL_MS'] || String(15 * 60 * 1000), 10);

// Fallback XML minimal (anti-HTML)
function minimalSitemapXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <url><loc>${PUBLIC_BASE}/</loc></url>\n` +
    `</urlset>\n`;
}

function escapeXml(v: string) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toLastmodDate(iso: string | undefined | null): string | null {
  if (!iso) return null;
  const d = iso.split('T')[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

async function fetchAllNews(): Promise<Array<{ slug: string; modified_gmt?: string; modified?: string }>> {
  const perPage = 100;
  let page = 1;
  const all: Array<{ slug: string; modified_gmt?: string; modified?: string }> = [];

  while (true) {
    const url =
      `${WP_API_BASE}/wp-json/wp/v2/news` +
      `?status=publish&per_page=${perPage}&page=${page}` +
      `&_fields=slug,modified_gmt,modified`;

    const resp = await fetch(url, { headers: { accept: 'application/json' } });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`WP news fetch failed ${resp.status}: ${txt.slice(0, 300)}`);
    }

    const items = (await resp.json()) as Array<{ slug: string; modified_gmt?: string; modified?: string }>;
    all.push(...items);

    const totalPagesHeader = resp.headers.get('x-wp-totalpages');
    const totalPages = totalPagesHeader ? parseInt(totalPagesHeader, 10) : 1;

    // Si le header n’existe pas, on stop quand on reçoit moins que perPage
    if (!totalPagesHeader) {
      if (items.length < perPage) break;
    } else {
      if (page >= totalPages) break;
    }

    page += 1;
  }

  return all;
}

// robots.txt
app.get('/robots.txt', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  res.status(200).send(`User-agent: *
Allow: /

Sitemap: ${PUBLIC_BASE}/sitemap.xml
`);
});

// ✅ sitemap.xml : handler async typé correctement via asyncHandler
app.get(
  '/sitemap.xml',
  asyncHandler(async (_req, res) => {
    // IMPORTANT : toujours XML
    res.setHeader('Content-Type', 'application/xml; charset=UTF-8');

    try {
      const now = Date.now();

      // Cache
      if (sitemapCache && sitemapCache.expiresAt > now) {
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.status(200).send(sitemapCache.xml);
        return;
      }

      // Routes statiques (reprend ton sitemap actuel)
      const staticUrls: Array<{
        loc: string;
        changefreq?: string;
        priority?: string;
        alternates?: Array<{ hreflang: string; href: string }>;
      }> = [
        // Accueil
        {
          loc: `${PUBLIC_BASE}/`,
          changefreq: 'weekly',
          priority: '1.0',
          alternates: [
            { hreflang: 'fr', href: `${PUBLIC_BASE}/` },
            { hreflang: 'en', href: `${PUBLIC_BASE}/en` },
            { hreflang: 'x-default', href: `${PUBLIC_BASE}/` },
          ],
        },

        // FR canoniques
        {
          loc: `${PUBLIC_BASE}/expert-immobilier-reseau-national`,
          changefreq: 'monthly',
          priority: '0.8',
          alternates: [
            { hreflang: 'fr', href: `${PUBLIC_BASE}/expert-immobilier-reseau-national` },
            { hreflang: 'en', href: `${PUBLIC_BASE}/en/expert-network-chartered-valuers` },
            { hreflang: 'x-default', href: `${PUBLIC_BASE}/expert-immobilier-reseau-national` },
          ],
        },
        {
          loc: `${PUBLIC_BASE}/expertise-immobiliere-services`,
          changefreq: 'monthly',
          priority: '0.8',
          alternates: [
            { hreflang: 'fr', href: `${PUBLIC_BASE}/expertise-immobiliere-services` },
            { hreflang: 'en', href: `${PUBLIC_BASE}/en/real-estate-valuation-services` },
            { hreflang: 'x-default', href: `${PUBLIC_BASE}/expertise-immobiliere-services` },
          ],
        },
        {
          loc: `${PUBLIC_BASE}/methodes-evaluation-immobiliere`,
          changefreq: 'monthly',
          priority: '0.7',
          alternates: [
            { hreflang: 'fr', href: `${PUBLIC_BASE}/methodes-evaluation-immobiliere` },
            { hreflang: 'en', href: `${PUBLIC_BASE}/en/valuation-methods-assets` },
            { hreflang: 'x-default', href: `${PUBLIC_BASE}/methodes-evaluation-immobiliere` },
          ],
        },
        {
          loc: `${PUBLIC_BASE}/experts-immobiliers-agrees`,
          changefreq: 'monthly',
          priority: '0.7',
          alternates: [
            { hreflang: 'fr', href: `${PUBLIC_BASE}/experts-immobiliers-agrees` },
            { hreflang: 'en', href: `${PUBLIC_BASE}/en/chartered-valuers-team` },
            { hreflang: 'x-default', href: `${PUBLIC_BASE}/experts-immobiliers-agrees` },
          ],
        },
        {
          loc: `${PUBLIC_BASE}/actualites-expertise-immobiliere`,
          changefreq: 'weekly',
          priority: '0.7',
          alternates: [
            { hreflang: 'fr', href: `${PUBLIC_BASE}/actualites-expertise-immobiliere` },
            { hreflang: 'en', href: `${PUBLIC_BASE}/en/real-estate-valuation-news` },
            { hreflang: 'x-default', href: `${PUBLIC_BASE}/actualites-expertise-immobiliere` },
          ],
        },
        {
          loc: `${PUBLIC_BASE}/contact-expert-immobilier`,
          changefreq: 'monthly',
          priority: '0.6',
          alternates: [
            { hreflang: 'fr', href: `${PUBLIC_BASE}/contact-expert-immobilier` },
            { hreflang: 'en', href: `${PUBLIC_BASE}/en/contact-chartered-valuers` },
            { hreflang: 'x-default', href: `${PUBLIC_BASE}/contact-expert-immobilier` },
          ],
        },
        {
          loc: `${PUBLIC_BASE}/mentions-legales`,
          changefreq: 'yearly',
          priority: '0.5',
          alternates: [
            { hreflang: 'fr', href: `${PUBLIC_BASE}/mentions-legales` },
            { hreflang: 'en', href: `${PUBLIC_BASE}/en/legal-notice` },
            { hreflang: 'x-default', href: `${PUBLIC_BASE}/mentions-legales` },
          ],
        },

        // EN canoniques
        {
          loc: `${PUBLIC_BASE}/en`,
          changefreq: 'weekly',
          priority: '0.9',
          alternates: [
            { hreflang: 'fr', href: `${PUBLIC_BASE}/` },
            { hreflang: 'en', href: `${PUBLIC_BASE}/en` },
            { hreflang: 'x-default', href: `${PUBLIC_BASE}/` },
          ],
        },
        {
          loc: `${PUBLIC_BASE}/en/expert-network-chartered-valuers`,
          changefreq: 'monthly',
          priority: '0.8',
          alternates: [
            { hreflang: 'fr', href: `${PUBLIC_BASE}/expert-immobilier-reseau-national` },
            { hreflang: 'en', href: `${PUBLIC_BASE}/en/expert-network-chartered-valuers` },
            { hreflang: 'x-default', href: `${PUBLIC_BASE}/expert-immobilier-reseau-national` },
          ],
        },
        {
          loc: `${PUBLIC_BASE}/en/real-estate-valuation-services`,
          changefreq: 'monthly',
          priority: '0.8',
          alternates: [
            { hreflang: 'fr', href: `${PUBLIC_BASE}/expertise-immobiliere-services` },
            { hreflang: 'en', href: `${PUBLIC_BASE}/en/real-estate-valuation-services` },
            { hreflang: 'x-default', href: `${PUBLIC_BASE}/expertise-immobiliere-services` },
          ],
        },
        {
          loc: `${PUBLIC_BASE}/en/valuation-methods-assets`,
          changefreq: 'monthly',
          priority: '0.7',
          alternates: [
            { hreflang: 'fr', href: `${PUBLIC_BASE}/methodes-evaluation-immobiliere` },
            { hreflang: 'en', href: `${PUBLIC_BASE}/en/valuation-methods-assets` },
            { hreflang: 'x-default', href: `${PUBLIC_BASE}/methodes-evaluation-immobiliere` },
          ],
        },
        {
          loc: `${PUBLIC_BASE}/en/chartered-valuers-team`,
          changefreq: 'monthly',
          priority: '0.7',
          alternates: [
            { hreflang: 'fr', href: `${PUBLIC_BASE}/experts-immobiliers-agrees` },
            { hreflang: 'en', href: `${PUBLIC_BASE}/en/chartered-valuers-team` },
            { hreflang: 'x-default', href: `${PUBLIC_BASE}/experts-immobiliers-agrees` },
          ],
        },
        {
          loc: `${PUBLIC_BASE}/en/real-estate-valuation-news`,
          changefreq: 'weekly',
          priority: '0.7',
          alternates: [
            { hreflang: 'fr', href: `${PUBLIC_BASE}/actualites-expertise-immobiliere` },
            { hreflang: 'en', href: `${PUBLIC_BASE}/en/real-estate-valuation-news` },
            { hreflang: 'x-default', href: `${PUBLIC_BASE}/actualites-expertise-immobiliere` },
          ],
        },
        {
          loc: `${PUBLIC_BASE}/en/contact-chartered-valuers`,
          changefreq: 'monthly',
          priority: '0.6',
          alternates: [
            { hreflang: 'fr', href: `${PUBLIC_BASE}/contact-expert-immobilier` },
            { hreflang: 'en', href: `${PUBLIC_BASE}/en/contact-chartered-valuers` },
            { hreflang: 'x-default', href: `${PUBLIC_BASE}/contact-expert-immobilier` },
          ],
        },
        {
          loc: `${PUBLIC_BASE}/en/legal-notice`,
          changefreq: 'yearly',
          priority: '0.5',
          alternates: [
            { hreflang: 'fr', href: `${PUBLIC_BASE}/mentions-legales` },
            { hreflang: 'en', href: `${PUBLIC_BASE}/en/legal-notice` },
            { hreflang: 'x-default', href: `${PUBLIC_BASE}/mentions-legales` },
          ],
        },
      ];

      // Articles (CPT news) depuis WP
      const news = await fetchAllNews();
      const newsUrls = news.map((n) => {
        const loc = `${PUBLIC_BASE}${NEWS_PUBLIC_PREFIX}${encodeURIComponent(n.slug)}`;
        const lastmod = toLastmodDate(n.modified_gmt || n.modified);
        return { loc, lastmod };
      });

      // XML
      const urlsXml: string[] = [];

      for (const u of staticUrls) {
        const alternates = (u.alternates || [])
          .map(
            (a) =>
              `    <xhtml:link rel="alternate" hreflang="${escapeXml(a.hreflang)}" href="${escapeXml(a.href)}"/>`
          )
          .join('\n');

        urlsXml.push(
          [
            '  <url>',
            `    <loc>${escapeXml(u.loc)}</loc>`,
            u.changefreq ? `    <changefreq>${escapeXml(u.changefreq)}</changefreq>` : '',
            u.priority ? `    <priority>${escapeXml(u.priority)}</priority>` : '',
            alternates || '',
            '  </url>',
          ]
            .filter(Boolean)
            .join('\n')
        );
      }

      // Articles : pas d’alternates EN ici (ajoute si tu as une route EN par article)
      for (const n of newsUrls) {
        urlsXml.push(
          [
            '  <url>',
            `    <loc>${escapeXml(n.loc)}</loc>`,
            n.lastmod ? `    <lastmod>${escapeXml(n.lastmod)}</lastmod>` : '',
            '    <changefreq>monthly</changefreq>',
            '    <priority>0.6</priority>',
            '  </url>',
          ]
            .filter(Boolean)
            .join('\n')
        );
      }

      const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
        `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n\n` +
        urlsXml.join('\n\n') +
        `\n\n</urlset>\n`;

      sitemapCache = { xml, expiresAt: now + SITEMAP_TTL_MS };

      res.setHeader('Cache-Control', 'public, max-age=300');
      res.status(200).send(xml);
    } catch (e) {
      console.error('❌ sitemap.xml error (fallback minimal)', e);
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.status(200).send(minimalSitemapXml());
    }
  })
);

// Fichiers statiques Angular (assets, *.js, *.css, etc.)
app.get(
  '*.*',
  express.static(BROWSER_DIST, {
    maxAge: '1y',
    immutable: true,
  })
);

// ─────────────────────────────────────────────
// SSR : on délègue le rendu à Angular Universal
// ─────────────────────────────────────────────
app.get(
  '*',
  asyncHandler(async (req, res) => {
    const engine = new CommonEngine();

    const html = await engine.render({
      bootstrap: mainServer,
      documentFilePath: join(BROWSER_DIST, 'index.html'),
      url: req.originalUrl,
      publicPath: BROWSER_DIST,
      providers: [
        { provide: APP_BASE_HREF, useValue: req.baseUrl },
        { provide: 'SSR_REQUEST', useValue: req },
        { provide: 'SSR_RESPONSE', useValue: res },
        { provide: 'SERVER_LANG', useValue: (res.locals as any).serverLang ?? 'fr' },
      ],
    });

    if (!res.headersSent) res.status(200).send(html);
  })
);

// ✅ Error handler Express (à la fin)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Express error:', err?.stack || err);
  if (!res.headersSent) res.status(500).type('text/plain').send('Server error');
});

// Port : aligne avec Nginx (proxy_pass -> 127.0.0.1:4300)
const PORT = parseInt(process.env['PORT'] ?? '4300', 10);

app.listen(PORT, () => {
  console.log(`✅ Serveur Node SSR en cours sur http://localhost:${PORT}`);
});
