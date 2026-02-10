// run-ssr.mjs
//
// ✅ Fix "mismatch runtime" : NE PLUS dépendre de process.cwd()
// ➜ on utilise SSR_ROOT (env) ou, à défaut, le dossier du fichier run-ssr.mjs
//    SSR_ROOT doit contenir /browser et /server (dist Angular SSR)
//
// ✅ Fix Nginx fallback : en cas d'erreur SSR, renvoyer 503 (pas 200 + indexHtml)
// ➜ Nginx peut alors faire error_page 503 = @static_fallback et servir le vrai index CSR à jour.
//
// Exemple SSR_ROOT :
// /var/www/lucjaubert_c_usr14/data/www/groupe-abc.fr/groupe-abc_angular

// =====================================================
// 0) Zone flags AVANT zone.js
// =====================================================
globalThis.__Zone_disable_requestAnimationFrame = true;

// =====================================================
// 1) Node DNS : éviter IPv6-first
// =====================================================
import dns from 'node:dns';
try { dns.setDefaultResultOrder('ipv4first'); } catch {}

// =====================================================
// 1.b) "main" guard (évite EADDRINUSE quand tu fais node -e import(...))
// =====================================================
import { pathToFileURL, fileURLToPath } from 'node:url';
const IS_MAIN = (() => {
  try {
    // process.argv[1] est vide avec "node -e"
    if (!process.argv?.[1]) return false;
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

// =====================================================
// 2) Angular / SSR init
// =====================================================
import '@angular/compiler';
import '@angular/platform-server/init';
import 'zone.js/node';
import 'source-map-support/register.js';

// =====================================================
// 3) Node / ESM imports
// =====================================================
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import * as nodeTimers from 'node:timers';

import express from 'express';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser'; // ✅ parse cookies (req.cookies.lang)
import { CommonEngine } from '@angular/ssr';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

const require = createRequire(import.meta.url);

// =====================================================
// 3.b) Build paths (NE PAS dépendre de process.cwd())
// =====================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// SSR_ROOT = dossier dist qui contient /browser et /server
// Par défaut : le dossier de run-ssr.mjs (si run-ssr.mjs est posé à la racine dist)
const SSR_ROOT = (process.env.SSR_ROOT || resolve(__dirname)).replace(/\/$/, '');
const BROWSER_DIR = resolve(SSR_ROOT, 'browser');
const SERVER_DIR  = resolve(SSR_ROOT, 'server');

// =====================================================
// 4) ENV / constants
// =====================================================
const SSR_TIMEOUT_MS = parseInt(process.env.SSR_TIMEOUT_MS || '15000', 10);

const SSR_DEBUG_TIMERS = (process.env.SSR_DEBUG_TIMERS ?? '0') === '1';
const SSR_DEBUG_TIMERS_MAX = parseInt(process.env.SSR_DEBUG_TIMERS_MAX || '20', 10);

const SSR_DEBUG_HTTP = (process.env.SSR_DEBUG_HTTP ?? '0') === '1';
const SSR_DEBUG_HTTP_MAX = parseInt(process.env.SSR_DEBUG_HTTP_MAX || '20', 10);

const SSR_DISABLE_INTERVALS = (process.env.SSR_DISABLE_INTERVALS ?? '0') === '1';
const SSR_BLOCK_SELF_FETCH = (process.env.SSR_BLOCK_SELF_FETCH ?? '0') === '1';

const PUBLIC_HOST = (process.env.PUBLIC_HOST || 'groupe-abc.fr')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '');

// NOTE: on garde WP_INTERNAL_ORIGIN pour le "rewrite" fetch
const WP_INTERNAL_ORIGIN = (process.env.WP_INTERNAL_ORIGIN || `https://${PUBLIC_HOST}`)
  .replace(/\/$/, '');

// ✅ Base WordPress (celle qui marche chez toi)
const WP_API_BASE = (process.env.WP_API_BASE || `https://${PUBLIC_HOST}/wordpress`)
  .replace(/\/$/, '');

// Listen host/port
const LISTEN_HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PORT || '4000', 10);

// =====================================================
// 5) Logs global
// =====================================================
process.on('uncaughtException', (err) => {
  console.error('❌ [SSR] uncaughtException:', err?.stack || err);
});
process.on('unhandledRejection', (err) => {
  console.error('❌ [SSR] unhandledRejection:', err?.stack || err);
});

// (debug) vérifier les chemins réellement utilisés
console.error('✅ [SSR] SSR_ROOT   =', SSR_ROOT);
console.error('✅ [SSR] BROWSER_DIR=', BROWSER_DIR);
console.error('✅ [SSR] SERVER_DIR =', SERVER_DIR);

// =====================================================
// 6) index.html normalization (évite "match null index")
// =====================================================
function normalizeIndexHtml(html) {
  let out = String(html ?? '');

  if (!/<\/head\s*>/i.test(out)) {
    if (/<body[\s>]/i.test(out)) {
      out = out.replace(/<body/i, '</head><body');
    } else {
      out = out.replace(/<html[^>]*>/i, (m) => `${m}<head></head>`);
    }
  }

  if (!/<body[\s>]/i.test(out)) {
    out = out.replace(/<\/head\s*>/i, '</head><body>');
  }

  if (!/<\/body\s*>/i.test(out)) {
    if (/<\/html\s*>/i.test(out)) {
      out = out.replace(/<\/html\s*>/i, '</body></html>');
    } else {
      out += '</body>';
    }
  }

  if (!/<\/html\s*>/i.test(out)) out += '</html>';

  return out;
}

// =====================================================
// 7) DOM SHIM (Domino)
// =====================================================
const { createWindow } = require('domino');

let indexHtml = readFileSync(join(BROWSER_DIR, 'index.html'), 'utf8');
indexHtml = normalizeIndexHtml(indexHtml);

const win = createWindow(indexHtml);

globalThis.window = win;
globalThis.document = win.document;
globalThis.navigator = win.navigator ?? { userAgent: 'SSR' };
globalThis.location = win.location ?? new URL(`https://${PUBLIC_HOST}`);
globalThis.HTMLElement = win.HTMLElement;
globalThis.Event = win.Event;

globalThis.getComputedStyle = globalThis.getComputedStyle ?? (() => ({}));

/**
 * requestAnimationFrame / cancelAnimationFrame
 */
const _raf = (cb) => nodeTimers.setTimeout(() => {
  try { cb(Date.now()); } catch {}
}, 0);

const _caf = (id) => {
  try { nodeTimers.clearTimeout(id); } catch {}
};

globalThis.requestAnimationFrame = globalThis.requestAnimationFrame ?? _raf;
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame ?? _caf;
win.requestAnimationFrame = win.requestAnimationFrame ?? _raf;
win.cancelAnimationFrame = win.cancelAnimationFrame ?? _caf;

// requestIdleCallback
if (typeof win.requestIdleCallback !== 'function') {
  win.requestIdleCallback = (cb) => nodeTimers.setTimeout(() => {
    try { cb({ didTimeout: false, timeRemaining: () => 0 }); } catch {}
  }, 0);
}
if (typeof win.cancelIdleCallback !== 'function') {
  win.cancelIdleCallback = (id) => {
    try { nodeTimers.clearTimeout(id); } catch {}
  };
}
globalThis.requestIdleCallback = globalThis.requestIdleCallback ?? win.requestIdleCallback.bind(win);
globalThis.cancelIdleCallback = globalThis.cancelIdleCallback ?? win.cancelIdleCallback.bind(win);

// window.open
win.open = win.open ?? function () { return null; };

try {
  if (win.location && typeof win.location === 'object') {
    if (!('origin' in win.location)) win.location.origin = `https://${PUBLIC_HOST}`;
    if (!('pathname' in win.location)) win.location.pathname = '/';
  }
} catch {}

globalThis.matchMedia =
  globalThis.matchMedia ??
  (() => ({
    matches: false,
    media: '',
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false; },
  }));

const makeStore = () => {
  const s = new Map();
  return {
    getItem: (k) => (s.has(k) ? String(s.get(k)) : null),
    setItem: (k, v) => { s.set(k, String(v)); },
    removeItem: (k) => { s.delete(k); },
    clear: () => { s.clear(); },
    key: (i) => Array.from(s.keys())[i] ?? null,
    get length() { return s.size; },
  };
};
globalThis.localStorage = globalThis.localStorage ?? makeStore();
globalThis.sessionStorage = globalThis.sessionStorage ?? makeStore();

try {
  const HistoryCtor = win.History || (win.history && win.history.constructor);
  const HistoryProto = HistoryCtor ? HistoryCtor.prototype : Object.getPrototypeOf(win.history);
  const ensure = (name) => {
    if (typeof HistoryProto[name] !== 'function') {
      Object.defineProperty(HistoryProto, name, { value: function () {}, configurable: true });
    }
  };
  ensure('pushState'); ensure('replaceState'); ensure('back'); ensure('forward'); ensure('go');
} catch {}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof win.scrollTo !== 'function') win.scrollTo = function () {};
win.addEventListener = win.addEventListener ?? function () {};
win.removeEventListener = win.removeEventListener ?? function () {};

// Image stub
(() => {
  if (typeof globalThis.Image === 'undefined') {
    class SSRImage {
      constructor() {
        this._src = '';
        this.onload = null;
        this.onerror = null;
      }
      set src(v) {
        this._src = String(v ?? '');
        if (typeof this.onload === 'function') nodeTimers.setTimeout(() => this.onload(), 0);
      }
      get src() { return this._src; }
    }
    globalThis.Image = SSRImage;
    win.Image = SSRImage;
    globalThis.HTMLImageElement = globalThis.HTMLImageElement || SSRImage;
  }
})();

// =====================================================
// 8) Patch Domino CSS crash (robuste)
// =====================================================
function patchDominoCssHardening() {
  try {
    const cssparser = require('domino/lib/cssparser.js');
    const TokenStream = cssparser?.TokenStream;

    if (TokenStream?.prototype && typeof TokenStream.prototype.LA === 'function') {
      const orig = TokenStream.prototype.LA;
      TokenStream.prototype.LA = function (...args) {
        try { return orig.apply(this, args); } catch { return { type: 'EOF' }; }
      };
      console.error('✅ [SSR] cssparser patched: TokenStream.LA (safe)');
      return;
    }
  } catch {}

  try {
    const cssparser = require('domino/lib/cssparser.js');
    const Parser = cssparser?.Parser || cssparser?.default?.Parser;
    if (Parser?.prototype && typeof Parser.prototype.parseStyleAttribute === 'function') {
      const orig = Parser.prototype.parseStyleAttribute;
      Parser.prototype.parseStyleAttribute = function (...args) {
        try { return orig.apply(this, args); } catch { return []; }
      };
      console.error('✅ [SSR] cssparser patched: Parser.parseStyleAttribute (safe)');
      return;
    }
  } catch {}

  try {
    const mod = require('domino/lib/CSSStyleDeclaration.js');
    const parseStyles = mod?.parseStyles;

    if (typeof parseStyles === 'function') {
      mod.parseStyles = function (...args) {
        try { return parseStyles.apply(this, args); } catch { return {}; }
      };
      console.error('✅ [SSR] cssparser patched: CSSStyleDeclaration.parseStyles (safe)');
      return;
    }
  } catch {}

  try {
    const mod = require('domino/lib/CSSStyleDeclaration.js');
    const CSSStyleDeclaration = mod?.CSSStyleDeclaration || mod?.default || mod;
    const proto = CSSStyleDeclaration?.prototype;

    if (proto) {
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && typeof desc.get === 'function') {
        const origGet = desc.get;
        Object.defineProperty(proto, 'value', {
          configurable: true,
          enumerable: desc.enumerable,
          get() { try { return origGet.call(this); } catch { return ''; } },
        });
        console.error('✅ [SSR] cssparser patched: CSSStyleDeclaration.value getter (safe)');
        return;
      }
      if (typeof proto.value === 'function') {
        const orig = proto.value;
        proto.value = function (...args) {
          try { return orig.apply(this, args); } catch { return ''; }
        };
        console.error('✅ [SSR] cssparser patched: CSSStyleDeclaration.value fn (safe)');
        return;
      }
    }

    console.error('⚠️ [SSR] cssparser patch: aucun point de patch trouvé (TokenStream/Parser/parseStyles/value)');
  } catch (e) {
    console.error('⚠️ [SSR] cssparser patch failed:', e?.stack || e);
  }
}
patchDominoCssHardening();

// =====================================================
// 9) Timers : bypass Zone + option disableIntervals (PM2-safe)
// =====================================================
function installNodeTimersBypassZone() {
  const nativeSetTimeout = nodeTimers.setTimeout;
  const nativeClearTimeout = nodeTimers.clearTimeout;
  const nativeSetInterval = nodeTimers.setInterval;
  const nativeClearInterval = nodeTimers.clearInterval;

  globalThis.setTimeout = function (fn, ms, ...args) {
    return nativeSetTimeout(fn, ms, ...args);
  };
  globalThis.clearTimeout = function (id) {
    try { nativeClearTimeout(id); } catch {}
  };

  globalThis.setInterval = function (fn, ms, ...args) {
    const id = nativeSetInterval(fn, ms, ...args);

    if (SSR_DISABLE_INTERVALS) {
      if (typeof id?.unref === 'function') id.unref();
      nativeClearInterval(id);
      return id;
    }

    return id;
  };

  globalThis.clearInterval = function (id) {
    try { nativeClearInterval(id); } catch {}
  };

  console.error(`✅ [SSR] Timers Node natifs installés (bypass Zone) disableIntervals=${SSR_DISABLE_INTERVALS}`);
}
installNodeTimersBypassZone();

// Debug timers (sur timers BYPASS Zone)
function installTimerDebug() {
  if (!SSR_DEBUG_TIMERS) return;

  let n = 0;
  const _setTimeout = globalThis.setTimeout.bind(globalThis);
  const _setInterval = globalThis.setInterval.bind(globalThis);

  globalThis.setTimeout = function (fn, ms, ...args) {
    if (n < SSR_DEBUG_TIMERS_MAX) {
      n++;
      console.error(`🧪 [SSR] setTimeout(ms=${ms}) #${n}\n${new Error().stack}`);
    }
    return _setTimeout(fn, ms, ...args);
  };

  globalThis.setInterval = function (fn, ms, ...args) {
    if (n < SSR_DEBUG_TIMERS_MAX) {
      n++;
      console.error(`🧪 [SSR] setInterval(ms=${ms}) #${n}\n${new Error().stack}`);
    }
    return _setInterval(fn, ms, ...args);
  };

  console.error(`✅ [SSR] Timer debug installed (max=${SSR_DEBUG_TIMERS_MAX})`);
}
installTimerDebug();

// =====================================================
// 10) Réseau : debug + réécriture WP externe -> interne
// =====================================================
function isSelfHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  return h === PUBLIC_HOST || h === `www.${PUBLIC_HOST}` || h === '127.0.0.1' || h === 'localhost';
}

function isWpPath(pathname) {
  const p = String(pathname || '');
  return p.startsWith('/wordpress/wp-json') || p.startsWith('/wordpress/wp-content') || p.startsWith('/wordpress/wp-admin');
}

function looksLikeFrontPath(pathname) {
  const p = String(pathname || '');
  if (p.startsWith('/wp-json') || p.startsWith('/wp-admin') || p.startsWith('/wp-content')) return false;
  return true;
}

function rewriteToInternalWp(urlObj) {
  if (isSelfHost(urlObj.hostname) && isWpPath(urlObj.pathname)) {
    const newUrl = new URL(WP_INTERNAL_ORIGIN);
    newUrl.pathname = urlObj.pathname;
    newUrl.search = urlObj.search;
    return newUrl;
  }
  return urlObj;
}

// Patch fetch : rewrite WP + block front (optionnel)
if (typeof globalThis.fetch === 'function' && (SSR_DEBUG_HTTP || SSR_BLOCK_SELF_FETCH || WP_INTERNAL_ORIGIN)) {
  const _fetch = globalThis.fetch.bind(globalThis);
  let n = 0;

  globalThis.fetch = async (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? new URL(input) : new URL(input.url);
      const rewritten = rewriteToInternalWp(url);

      if (
        SSR_BLOCK_SELF_FETCH &&
        isSelfHost(rewritten.hostname) &&
        looksLikeFrontPath(rewritten.pathname) &&
        !isWpPath(rewritten.pathname)
      ) {
        console.error(`🛑 [SSR] BLOCK fetch -> ${rewritten.hostname}${rewritten.pathname}`);
        throw new Error('SSR_BLOCK_SELF_FETCH');
      }

      if (SSR_DEBUG_HTTP && n < SSR_DEBUG_HTTP_MAX) {
        n++;
        console.error(`🌐 [SSR] fetch -> ${rewritten.toString()}`);
      }

      if (rewritten.toString() !== url.toString()) {
        return _fetch(rewritten.toString(), init);
      }
    } catch {
      // URL non parseable => passthrough
    }
    return _fetch(input, init);
  };

  console.error('✅ [SSR] fetch patched (rewrite WP + optional block)');
}

// =====================================================
// 11) Charger bundle SSR Angular (CHEMIN ABSOLU)
// =====================================================
const serverBundle = require(join(SERVER_DIR, 'main.cjs'));

let bootstrapToken = null;
if (typeof serverBundle.default === 'function') bootstrapToken = serverBundle.default;
else if (serverBundle.AppServerModule) bootstrapToken = serverBundle.AppServerModule;
else if (serverBundle.AppComponent) bootstrapToken = serverBundle.AppComponent;

if (!bootstrapToken) {
  console.error('❌ Aucun token de bootstrap trouvé dans server/main.cjs. Exports =', Object.keys(serverBundle));
  process.exit(1);
}

// =====================================================
// 12) Express + SSR (routes ROBOTS/SITEMAP AVANT static, AVANT catch-all)
// =====================================================
const app = express();
app.disable('x-powered-by');
app.use(compression());
app.use(morgan('tiny'));
app.use(cookieParser());

// Safety : si jamais nginx envoie wp-json vers node, on ne doit PAS SSR dessus
app.get(['/wp-json/*', '/wp-admin/*', '/wp-content/*'], (_req, res) => {
  res.status(502).type('text/plain').send('WP routes should not hit SSR node');
});

// Health
app.get('/healthz-node', (_req, res) => res.status(200).type('text/plain').send('ok'));

// =====================================================
// 12.y) LANG AUTO (cookie + Geo headers + Accept-Language) + redirect /en
// =====================================================
function isBot(req) {
  const ua = String(req.header('user-agent') || '').toLowerCase();
  return /(googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebookexternalhit|twitterbot)/.test(ua);
}

function isStaticLikePath(pathname) {
  const p = String(pathname || '');
  if (!p) return false;
  if (p === '/robots.txt' || p === '/sitemap.xml' || p === '/healthz-node') return true;
  if (p.startsWith('/wp-json') || p.startsWith('/wp-admin') || p.startsWith('/wp-content')) return true;
  return /\.[a-z0-9]{2,6}$/i.test(p);
}

function detectLangFromReq(req) {
  const c = req.cookies?.lang;
  if (c === 'fr' || c === 'en') return c;

  const country = String(
    req.header('cf-ipcountry') ||
    req.header('x-vercel-ip-country') ||
    ''
  ).trim().toUpperCase();

  const EN_COUNTRIES = new Set(['US', 'GB', 'IE', 'CA', 'AU', 'NZ']);
  if (country && EN_COUNTRIES.has(country)) return 'en';

  const al = String(req.header('accept-language') || '').toLowerCase();
  if (al.includes('en') && !al.includes('fr')) return 'en';

  return 'fr';
}

app.use((req, res, next) => {
  const path = req.path || '/';
  const isEnUrl = path === '/en' || path.startsWith('/en/');

  const lang = detectLangFromReq(req);
  res.locals.serverLang = lang;
  res.setHeader('X-LANG-DETECTED', lang);

  const hasLangCookie = req.cookies?.lang === 'fr' || req.cookies?.lang === 'en';

  if (
    !isStaticLikePath(path) &&
    !hasLangCookie &&
    !isBot(req) &&
    lang === 'en' &&
    !isEnUrl
  ) {
    const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    return res.redirect(302, '/en' + path + qs);
  }

  next();
});

// =====================================================
// 12.x) ROBOTS + SITEMAP
// =====================================================
const PUBLIC_BASE = (process.env.PUBLIC_BASE || `https://${PUBLIC_HOST}`).replace(/\/$/, '');
const SITEMAP_TTL_MS = parseInt(process.env.SITEMAP_TTL_MS || String(15 * 60 * 1000), 10);

let sitemapCache = null; // { xml, expiresAt }

function minimalSitemapXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <url><loc>${PUBLIC_BASE}/</loc></url>\n` +
    `</urlset>\n`;
}

app.get('/robots.txt', (_req, res) => {
  res.status(200);
  res.type('text/plain; charset=UTF-8');
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  res.setHeader('X-ROBOTS-HIT', '1');
  return res.send(`User-agent: *\nAllow: /\n\nSitemap: ${PUBLIC_BASE}/sitemap.xml\n`);
});

function xmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toIsoDate(d) {
  try {
    const dt = (d instanceof Date) ? d : new Date(d);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
  } catch {
    return null;
  }
}

async function fetchWpNewsAll({ perPage = 100, maxPages = 50 } = {}) {
  const urls = [];
  let page = 1;

  while (page <= maxPages) {
    const endpoint =
      `${WP_API_BASE}/wp-json/wp/v2/news` +
      `?per_page=${perPage}&page=${page}` +
      `&_fields=slug,modified_gmt`;

    if (SSR_DEBUG_HTTP) console.error(`🌐 [SITEMAP] WP fetch -> ${endpoint}`);

    const res = await fetch(endpoint, { headers: { accept: 'application/json' } });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`WP_NEWS_FETCH_FAILED status=${res.status} body=${text.slice(0, 200)}`);
    }

    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) break;

    urls.push(...arr);
    if (arr.length < perPage) break;
    page += 1;
  }

  return urls;
}

app.get('/sitemap.xml', async (_req, res) => {
  res.status(200);
  res.type('application/xml; charset=UTF-8');
  res.setHeader('X-SITEMAP-HIT', '1');

  try {
    const now = Date.now();

    if (sitemapCache && sitemapCache.expiresAt > now) {
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.send(sitemapCache.xml);
    }

    const staticUrls = [
      { loc: `${PUBLIC_BASE}/` },
      { loc: `${PUBLIC_BASE}/actualites-expertise-immobiliere` },
    ];

    let wpNews = [];
    try {
      wpNews = await fetchWpNewsAll({ perPage: 100, maxPages: 50 });
      console.error(`✅ [SITEMAP] WP news fetched: ${wpNews.length} items via ${WP_API_BASE}`);
    } catch (e) {
      console.error('⚠️ [SITEMAP] WP fetch failed, fallback sitemap minimal:', e?.message || e);
      wpNews = [];
    }

    const newsUrls = wpNews
      .filter((n) => n && typeof n.slug === 'string' && n.slug.length > 0)
      .map((n) => ({
        loc: `${PUBLIC_BASE}/actualites-expertise-immobiliere/${encodeURIComponent(n.slug)}`,
        lastmod: toIsoDate(n.modified_gmt ? `${n.modified_gmt}Z` : null) || null,
      }));

    const all = [...staticUrls, ...newsUrls];

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      all.map((u) => {
        const loc = xmlEscape(u.loc);
        const lastmod = u.lastmod ? `<lastmod>${xmlEscape(u.lastmod)}</lastmod>` : '';
        return `  <url><loc>${loc}</loc>${lastmod}</url>`;
      }).join('\n') +
      `\n</urlset>\n`;

    sitemapCache = { xml, expiresAt: now + SITEMAP_TTL_MS };

    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(xml);
  } catch {
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.send(minimalSitemapXml());
  }
});

// Static (APRÈS robots/sitemap) — ✅ chemin ABSOLU
app.use(
  express.static(BROWSER_DIR, {
    maxAge: '1y',
    index: false,
  })
);

const engine = new CommonEngine();

function dumpActiveHandles(tag = 'DUMP') {
  try {
    const handles = process._getActiveHandles?.() ?? [];
    const reqs = process._getActiveRequests?.() ?? [];
    const names = handles.map((h) => h?.constructor?.name || typeof h);
    const agg = names.reduce((acc, name) => (acc[name] = (acc[name] || 0) + 1, acc), {});
    console.error(`⚠️ [SSR] ${tag} activeHandles=${handles.length} activeRequests=${reqs.length} agg=`, agg);
  } catch (e) {
    console.error('⚠️ [SSR] dumpActiveHandles failed:', e?.message || e);
  }
}

function withTimeout(promise, ms) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = globalThis.setTimeout(() => reject(new Error('SSR_TIMEOUT')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => globalThis.clearTimeout(timeoutId));
}

// Catch-all SSR
app.get('*', async (req, res) => {
  const t0 = Date.now();
  try {
    const renderPromise = engine.render({
      bootstrap: bootstrapToken,
      document: indexHtml,
      url: req.originalUrl,
      providers: [
        provideNoopAnimations(),
        { provide: 'SERVER_LANG', useValue: res.locals?.serverLang ?? 'fr' },
        { provide: 'SSR_REQUEST', useValue: req },
        { provide: 'SSR_RESPONSE', useValue: res },
      ],
    });

    const html = await withTimeout(renderPromise, SSR_TIMEOUT_MS);

    res
      .status(200)
      .set('X-SSR', '1')
      .set('X-SSR-TTFB-MS', String(Date.now() - t0))
      .send(html);
  } catch (err) {
    const code = err?.message === 'SSR_TIMEOUT' ? 'SSR_TIMEOUT' : (err?.message || 'SSR_ERROR');
    console.error('❌ Erreur SSR:', err?.stack || err);
    dumpActiveHandles(code);

    // ✅ IMPORTANT : renvoyer 503 pour que Nginx fasse le fallback vers le vrai index CSR (/browser/index.html)
    // (via error_page 503 = @static_fallback)
    return res
      .status(503)
      .set('X-SSR', '0')
      .set('X-SSR-ERR', String(code))
      .set('X-SSR-TTFB-MS', String(Date.now() - t0))
      .type('text/plain; charset=utf-8')
      .send('SSR_FAILED');
  }
});

// =====================================================
// 13) Listen (PM2-safe)
// =====================================================

// ✅ Par défaut on écoute.
// ✅ Pour faire "import sans listen" : SSR_NO_LISTEN=1 node -e "import('./run-ssr.mjs')"
const NO_LISTEN = (process.env.SSR_NO_LISTEN ?? '0') === '1';

if (!NO_LISTEN) {
  app.listen(PORT, LISTEN_HOST, () => {
    console.log(`✅ [SSR] Groupe ABC écoute sur http://localhost:${PORT} (bind=${LISTEN_HOST}) public=${PUBLIC_HOST}`);
    console.log(`ℹ️ [SSR] Timeout sécurité = ${SSR_TIMEOUT_MS}ms (env SSR_TIMEOUT_MS)`);
    console.log(`ℹ️ [SSR] WP_INTERNAL_ORIGIN = ${WP_INTERNAL_ORIGIN}`);
    console.log(`ℹ️ [SSR] WP_API_BASE = ${WP_API_BASE}`);
  });
} else {
  console.log('ℹ️ [SSR] SSR_NO_LISTEN=1 -> server not listening (import mode)');
}

// Export optionnel (utile si tu veux tester sans listen)
export { app };
