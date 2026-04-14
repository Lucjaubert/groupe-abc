// run-ssr.mjs
//
// ✅ Fix "mismatch runtime" : NE PLUS dépendre de process.cwd()
// ➜ on utilise SSR_ROOT (env) ou, à défaut, le dossier du fichier run-ssr.mjs
//    SSR_ROOT doit contenir /browser et /server (dist Angular SSR)
//
// ✅ Fix Nginx fallback : en cas d'erreur SSR, renvoyer 503 (pas 200 + indexHtml)
// ➜ Nginx peut alors faire error_page 503 = @static_fallback et servir le vrai index CSR à jour.
//
// ✅ Fix Angular SSR crash "Cannot read properties of null (reading 'index')"
// ➜ patch runtime SSR-safe de l’injection Renderer2 (appendServerContextInfo -> injector.get(Renderer2))
//    via Object.defineProperty sur Renderer2.__NG_ELEMENT_ID__ (certaines versions le définissent non-writable).
//
// ✅ Sitemap dynamique : news + methods_asset (FR + EN)
// - news: /actualites-expertise-immobiliere/:slug
// - methods_asset: /methodes-evaluation-immobiliere/:slug + /en/valuation-methods-assets/:slug
//   EN peut être “traduit” via mapping côté Node (server/news-slugs.mjs) sinon fallback = slug WP.
//
// ✅ SEO SSR fallback “béton” : inject canonical + hreflang au niveau Node
// - reflète exactement tes routes Angular (FR/EN)
// - supprime les doublons si déjà présents
//
// ✅ Fix "Unable to locate stylesheet: /.../styles.<hash>.css"
// - certains moteurs "critical CSS" résolvent les assets depuis le CWD
// - on force donc le CWD sur BROWSER_DIR (où se trouvent réellement styles/main/runtime…)
//
// ✅ Fix “/en/main.<hash>.js” (assets demandés sous un préfixe de route)
// - si le browser demande /en/main.hash.js (ou /actualites…/main.hash.js),
//   on sert /main.hash.js depuis BROWSER_DIR si dispo.
//
// ✅ FIX URGENT : typo "main<hash>.js" (point manquant) dans le HTML SSR
// - corrige à la volée dans le HTML (runtime/polyfills/main/styles)
// - et ajoute un fallback serveur qui sert aussi /main<hash>.js => /main.<hash>.js
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
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname, extname, basename } from 'node:path';
import { createRequire } from 'node:module';
import * as nodeTimers from 'node:timers';

import express from 'express';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { CommonEngine } from '@angular/ssr';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

// ✅ NEW: mapping slugs news EN côté Node (pour sitemap FR/EN propre)
import { toNewsEnSlug } from './server/news-slugs.mjs';

const require = createRequire(import.meta.url);

// =====================================================
// 3.b) Build paths (NE PAS dépendre de process.cwd())
// =====================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// SSR_ROOT = dossier dist qui contient /browser et /server
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

const WP_INTERNAL_ORIGIN = (process.env.WP_INTERNAL_ORIGIN || `https://${PUBLIC_HOST}`)
  .replace(/\/$/, '');

const WP_API_BASE = (process.env.WP_API_BASE || `https://${PUBLIC_HOST}/wordpress`)
  .replace(/\/$/, '');

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

console.error('✅ [SSR] SSR_ROOT   =', SSR_ROOT);
console.error('✅ [SSR] BROWSER_DIR=', BROWSER_DIR);
console.error('✅ [SSR] SERVER_DIR =', SERVER_DIR);

// ✅ important: forcer le CWD sur BROWSER_DIR pour que les outils de résolution d'assets
// (critical CSS / beasties / etc.) trouvent styles.<hash>.css et les JS.
try {
  process.chdir(BROWSER_DIR);
  console.error('✅ [SSR] CWD forced to BROWSER_DIR =', process.cwd());
} catch (e) {
  console.error('⚠️ [SSR] cannot chdir to BROWSER_DIR:', e?.message || e);
}

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
// 10.c) ✅ SEO SSR fallback : canonical + hreflang injecté côté Node
// =====================================================

// Mapping canonique FR ⇄ EN (tes routes)
const ALT_MAP = [
  { fr: '/', en: '/en' },

  { fr: '/expert-immobilier-reseau-national', en: '/en/expert-network-chartered-valuers' },
  { fr: '/expertise-immobiliere-services',   en: '/en/real-estate-valuation-services' },

  { fr: '/methodes-evaluation-immobiliere',  en: '/en/valuation-methods-assets' },
  { fr: '/experts-immobiliers-agrees',       en: '/en/chartered-valuers-team' },

  { fr: '/actualites-expertise-immobiliere', en: '/en/real-estate-valuation-news' },

  { fr: '/contact-expert-immobilier',        en: '/en/contact-chartered-valuers' },
  { fr: '/mentions-legales',                 en: '/en/legal-notice' },
];

function stripQueryHash(u = '/') {
  return (String(u || '/').split(/[?#]/)[0] || '/');
}

function normPath(p = '/') {
  let s = stripQueryHash(p);
  if (!s.startsWith('/')) s = '/' + s;
  s = s.replace(/\/{2,}/g, '/');
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return s || '/';
}

// Construit fr/en/x-default pour un path donné (listing + détails)
function buildAltForPath(path) {
  const clean = normPath(path);

  // 1) exact map
  const direct = ALT_MAP.find(x => x.fr === clean || x.en === clean);
  if (direct) {
    const isEn = clean === direct.en;
    return {
      frPath: direct.fr,
      enPath: direct.en,
      xDefaultPath: isEn ? direct.en : direct.fr,
    };
  }

  // 2) methods detail
  if (clean.startsWith('/methodes-evaluation-immobiliere/')) {
    const slug = clean.replace('/methodes-evaluation-immobiliere/', '').replace(/^\/+/, '');
    if (slug) {
      return {
        frPath: `/methodes-evaluation-immobiliere/${slug}`,
        enPath: `/en/valuation-methods-assets/${slug}`,
        xDefaultPath: `/methodes-evaluation-immobiliere/${slug}`,
      };
    }
  }
  if (clean.startsWith('/en/valuation-methods-assets/')) {
    const slug = clean.replace('/en/valuation-methods-assets/', '').replace(/^\/+/, '');
    if (slug) {
      return {
        frPath: `/methodes-evaluation-immobiliere/${slug}`,
        enPath: `/en/valuation-methods-assets/${slug}`,
        xDefaultPath: `/methodes-evaluation-immobiliere/${slug}`,
      };
    }
  }

  // 3) news detail
  if (clean.startsWith('/actualites-expertise-immobiliere/')) {
    const slug = clean.replace('/actualites-expertise-immobiliere/', '').replace(/^\/+/, '');
    if (slug) {
      return {
        frPath: `/actualites-expertise-immobiliere/${slug}`,
        enPath: `/en/real-estate-valuation-news/${slug}`,
        xDefaultPath: `/actualites-expertise-immobiliere/${slug}`,
      };
    }
  }
  if (clean.startsWith('/en/real-estate-valuation-news/')) {
    const slug = clean.replace('/en/real-estate-valuation-news/', '').replace(/^\/+/, '');
    if (slug) {
      return {
        frPath: `/actualites-expertise-immobiliere/${slug}`,
        enPath: `/en/real-estate-valuation-news/${slug}`,
        xDefaultPath: `/actualites-expertise-immobiliere/${slug}`,
      };
    }
  }

  // 4) fallback générique : /en + même path
  const isEn = clean === '/en' || clean.startsWith('/en/');
  const frPath = isEn ? (clean.replace(/^\/en(\/|$)/, '/') || '/') : clean;
  const enPath = isEn ? clean : (clean === '/' ? '/en' : `/en${clean}`);
  return {
    frPath,
    enPath,
    xDefaultPath: isEn ? enPath : frPath,
  };
}

function absUrlFromReq(req, path) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host  = String(req.headers['x-forwarded-host'] || req.headers['host'] || PUBLIC_HOST).split(',')[0].trim();
  const origin = `${proto}://${host}`.replace(/\/$/, '');
  return new URL(path, origin).toString();
}

function injectCanonicalHreflang(html, req) {
  let out = String(html || '');

  const rawPath = req.originalUrl || req.url || '/';
  const path = normPath(rawPath);

  const alt = buildAltForPath(path);

  const canonical = absUrlFromReq(req, path);
  const frHref    = absUrlFromReq(req, alt.frPath);
  const enHref    = absUrlFromReq(req, alt.enPath);
  const xDefHref  = absUrlFromReq(req, alt.xDefaultPath);

  const links =
    `\n<link rel="canonical" href="${canonical}">\n` +
    `<link rel="alternate" hreflang="fr" href="${frHref}">\n` +
    `<link rel="alternate" hreflang="en" href="${enHref}">\n` +
    `<link rel="alternate" hreflang="x-default" href="${xDefHref}">\n`;

  // purge existing canonical + alternates to avoid duplicates
  out = out.replace(/<link[^>]+rel=["']canonical["'][^>]*>\s*/gi, '');
  out = out.replace(/<link[^>]+rel=["']alternate["'][^>]*hreflang=["'][^"']+["'][^>]*>\s*/gi, '');

  // inject into <head>
  if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `${links}</head>`);
  }

  return out;
}

// =====================================================
// 10.d) ✅ FIX HTML bundles : "main<hash>.js" -> "main.<hash>.js"
// (et runtime/polyfills/styles)
// =====================================================
function fixHashedAssetTyposInHtml(html) {
  let out = String(html || '');

  // src="main<hash>.js" => src="main.<hash>.js"
  out = out.replace(/src="(main|runtime|polyfills)([a-f0-9]{8,}\.js)"/gi, 'src="$1.$2"');

  // href="styles<hash>.css" => href="styles.<hash>.css"
  out = out.replace(/href="(styles)([a-f0-9]{8,}\.css)"/gi, 'href="$1.$2"');

  return out;
}

// =====================================================
// 10.b) Angular SSR workaround: Renderer2 injection can crash on server
// =====================================================
async function patchRenderer2InjectorForSSR() {
  try {
    const ngCore = await import('@angular/core');
    const Renderer2 = ngCore?.Renderer2;

    if (!Renderer2) {
      console.error('⚠️ [SSR] Renderer2 not found (skip patch)');
      return;
    }

    const origDesc = Object.getOwnPropertyDescriptor(Renderer2, '__NG_ELEMENT_ID__');
    const origFn = origDesc?.value;

    if (typeof origFn !== 'function') {
      console.error('⚠️ [SSR] Renderer2.__NG_ELEMENT_ID__ not found (skip patch)');
      return;
    }

    const fallbackRenderer = {
      setAttribute(el, name, value) { try { el?.setAttribute?.(name, value); } catch {} },
      removeAttribute(el, name) { try { el?.removeAttribute?.(name); } catch {} },
      setProperty(el, name, value) { try { if (el) el[name] = value; } catch {} },
      addClass() {},
      removeClass() {},
      setStyle() {},
      removeStyle() {},
      listen() { return () => {}; },
      destroy() {},
      createElement() { return null; },
      createComment() { return null; },
      createText() { return null; },
      appendChild() {},
      insertBefore() {},
      removeChild() {},
      selectRootElement() { return null; },
      parentNode() { return null; },
      nextSibling() { return null; },
      setValue() {},
    };

    Object.defineProperty(Renderer2, '__NG_ELEMENT_ID__', {
      configurable: true,
      enumerable: origDesc?.enumerable ?? false,
      writable: true,
      value: function (...args) {
        try {
          return origFn.apply(this, args);
        } catch {
          return fallbackRenderer;
        }
      },
    });

    console.error('✅ [SSR] Renderer2 injector patched (defineProperty, SSR-safe)');
  } catch (e) {
    console.error('⚠️ [SSR] Renderer2 patch failed:', e?.stack || e);
  }
}
await patchRenderer2InjectorForSSR();

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

// Health (non-SSR)
app.get('/healthz-node', (_req, res) => res.status(200).type('text/plain').send('ok'));
app.get('/healthz', (_req, res) => res.status(200).type('text/plain').send('ok'));

// =====================================================
// 12.a) ✅ ASSET FALLBACK (évite /en/main.hash.js -> SSR HTML)
//      + ✅ fix typo /main<hash>.js -> /main.<hash>.js
// =====================================================
const ASSET_EXTS = new Set([
  '.js','.mjs','.css',
  '.png','.jpg','.jpeg','.gif','.webp','.svg','.ico',
  '.woff','.woff2','.ttf','.eot',
  '.json','.map','.txt'
]);

function sendBrowserFile(res, relPath) {
  const abs = join(BROWSER_DIR, relPath.replace(/^\/+/, ''));
  if (!existsSync(abs)) return false;
  res.sendFile(abs, {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-ASSET-FALLBACK': '1',
    }
  });
  return true;
}

function fixMainDotTyposPath(p) {
  // /main<hash>.js => /main.<hash>.js (idem runtime/polyfills/styles)
  const m = String(p || '').match(/^\/(main|runtime|polyfills|styles)([a-f0-9]{8,})\.(js|css)$/i);
  if (!m) return null;
  return `/${m[1]}.${m[2]}.${m[3]}`;
}

// Si on te demande /en/<asset> ou /quelquechose/<asset>, on tente de servir /<asset>
app.get('*', (req, res, next) => {
  const original = String(req.path || '/');
  const ext = extname(original).toLowerCase();
  if (!ext || !ASSET_EXTS.has(ext)) return next();

  // candidates (du + strict au + permissif)
  const candidates = [];

  // 0) path tel quel
  candidates.push(original);

  // 0.b) correction typo main<hash>.js / styles<hash>.css
  const fixed0 = fixMainDotTyposPath(original);
  if (fixed0) candidates.push(fixed0);

  // 1) strip /en/
  const strippedEn = original.replace(/^\/en\//, '/');
  if (strippedEn !== original) {
    candidates.push(strippedEn);
    const fixed1 = fixMainDotTyposPath(strippedEn);
    if (fixed1) candidates.push(fixed1);
  }

  // 2) strip 1er segment de route (ex: /actualites-.../main.hash.js -> /main.hash.js)
  const oneSegStripped = original.replace(/^\/[^/]+\//, '/');
  if (oneSegStripped !== original) {
    candidates.push(oneSegStripped);
    const fixed2 = fixMainDotTyposPath(oneSegStripped);
    if (fixed2) candidates.push(fixed2);
  }

  // 3) si on est sur /en/... et que ça finit par un nom de fichier, tenter aussi /<basename>
  const base = basename(original);
  if (base && base.includes('.') && base.startsWith('main')) {
    candidates.push('/' + base);
    const fixed3 = fixMainDotTyposPath('/' + base);
    if (fixed3) candidates.push(fixed3);
  }

  // send first match
  for (const c of candidates) {
    if (sendBrowserFile(res, c)) return;
  }

  return next();
});

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
  if (p === '/robots.txt' || p === '/sitemap.xml' || p === '/healthz-node' || p === '/healthz') return true;
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

// =====================================================
// 12.x.a) Mapping EN "propre" pour methods_asset (optionnel)
// =====================================================
const METHODS_CANONICAL_TO_EN = {
  'expertise-credit-bail': 'leasehold-financing',
  'expertise-bureaux-locaux-professionnels': 'offices-professional-premises',
  'expertise-locaux-commerciaux': 'retail-commercial-premises',
  'expertise-biens-residentiels': 'residential-assets',
};

function toMethodsEnSlug(canonicalSlug) {
  const s = String(canonicalSlug || '').trim().toLowerCase();
  return METHODS_CANONICAL_TO_EN[s] || s;
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

async function fetchWpMethodsAssetsAll({ perPage = 100, maxPages = 50 } = {}) {
  const urls = [];
  let page = 1;

  while (page <= maxPages) {
    const endpoint =
      `${WP_API_BASE}/wp-json/wp/v2/methods_asset` +
      `?per_page=${perPage}&page=${page}` +
      `&_fields=slug,modified_gmt`;

    if (SSR_DEBUG_HTTP) console.error(`🌐 [SITEMAP] WP fetch -> ${endpoint}`);

    const res = await fetch(endpoint, { headers: { accept: 'application/json' } });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`WP_METHODS_FETCH_FAILED status=${res.status} body=${text.slice(0, 200)}`);
    }

    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) break;

    urls.push(...arr);
    if (arr.length < perPage) break;
    page += 1;
  }

  return urls;
}

// ✅ NEW: sitemap FR/EN complet avec hreflang + lastmod + pages fixes + news + methods
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

    // =========================
    // Helpers sitemap hreflang
    // =========================
    const pageEntry = ({
      frPath,
      enPath,
      lastmod = null,
      priority = null,
      changefreq = null,
      xDefault = 'fr',
    }) => ({
      frPath,
      enPath,
      xDefaultPath: xDefault === 'en' ? enPath : frPath,
      lastmod,
      priority,
      changefreq,
    });

    const abs = (path) => `${PUBLIC_BASE}${path}`;

    const renderUrl = (e, currentLang = 'fr') => {
      const loc = currentLang === 'en' ? abs(e.enPath) : abs(e.frPath);
      const frHref = abs(e.frPath);
      const enHref = abs(e.enPath);
      const xDefHref = abs(e.xDefaultPath);

      const lastmodXml = e.lastmod ? `\n    <lastmod>${xmlEscape(e.lastmod)}</lastmod>` : '';
      const changefreqXml = e.changefreq ? `\n    <changefreq>${xmlEscape(e.changefreq)}</changefreq>` : '';
      const priorityXml = e.priority != null ? `\n    <priority>${xmlEscape(String(e.priority))}</priority>` : '';

      return [
        '  <url>',
        `    <loc>${xmlEscape(loc)}</loc>`,
        lastmodXml || null,
        changefreqXml || null,
        priorityXml || null,
        `    <xhtml:link rel="alternate" hreflang="fr" href="${xmlEscape(frHref)}"/>`,
        `    <xhtml:link rel="alternate" hreflang="en" href="${xmlEscape(enHref)}"/>`,
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(xDefHref)}"/>`,
        '  </url>',
      ].filter(Boolean).join('\n');
    };

    // =========================
    // 1) Pages fixes canoniques FR/EN
    // =========================
    const fixedPages = [
      pageEntry({ frPath: '/', enPath: '/en', changefreq: 'weekly', priority: '1.0', xDefault: 'fr' }),

      pageEntry({
        frPath: '/expert-immobilier-reseau-national',
        enPath: '/en/expert-network-chartered-valuers',
        changefreq: 'monthly',
        priority: '0.8',
      }),
      pageEntry({
        frPath: '/expertise-immobiliere-services',
        enPath: '/en/real-estate-valuation-services',
        changefreq: 'monthly',
        priority: '0.8',
      }),
      pageEntry({
        frPath: '/methodes-evaluation-immobiliere',
        enPath: '/en/valuation-methods-assets',
        changefreq: 'monthly',
        priority: '0.7',
      }),
      pageEntry({
        frPath: '/experts-immobiliers-agrees',
        enPath: '/en/chartered-valuers-team',
        changefreq: 'monthly',
        priority: '0.7',
      }),
      pageEntry({
        frPath: '/actualites-expertise-immobiliere',
        enPath: '/en/real-estate-valuation-news',
        changefreq: 'weekly',
        priority: '0.7',
      }),
      pageEntry({
        frPath: '/contact-expert-immobilier',
        enPath: '/en/contact-chartered-valuers',
        changefreq: 'monthly',
        priority: '0.6',
      }),
      pageEntry({
        frPath: '/mentions-legales',
        enPath: '/en/legal-notice',
        changefreq: 'yearly',
        priority: '0.5',
      }),
    ];

    // =========================
    // 2) News (FR + EN mappé/fallback via server/news-slugs.mjs)
    // =========================
    let wpNews = [];
    try {
      wpNews = await fetchWpNewsAll({ perPage: 100, maxPages: 50 });
      console.error(`✅ [SITEMAP] WP news fetched: ${wpNews.length} items via ${WP_API_BASE}`);
    } catch (e) {
      console.error('⚠️ [SITEMAP] WP news fetch failed:', e?.message || e);
      wpNews = [];
    }

    const newsEntries = wpNews
      .filter((n) => n && typeof n.slug === 'string' && n.slug.trim())
      .map((n) => {
        const canonical = String(n.slug).trim().toLowerCase();
        const enSlug = toNewsEnSlug(canonical); // ✅ mapping EN si connu, sinon fallback = canonical
        const lastmod = toIsoDate(n.modified_gmt ? `${n.modified_gmt}Z` : null) || null;

        return pageEntry({
          frPath: `/actualites-expertise-immobiliere/${encodeURIComponent(canonical)}`,
          enPath: `/en/real-estate-valuation-news/${encodeURIComponent(enSlug)}`,
          lastmod,
          changefreq: 'monthly',
          priority: '0.6',
        });
      });

    // =========================
    // 3) Methods assets (FR + EN mappé/fallback)
    // =========================
    let wpMethods = [];
    try {
      wpMethods = await fetchWpMethodsAssetsAll({ perPage: 100, maxPages: 50 });
      console.error(`✅ [SITEMAP] WP methods fetched: ${wpMethods.length} items via ${WP_API_BASE}`);
    } catch (e) {
      console.error('⚠️ [SITEMAP] WP methods fetch failed:', e?.message || e);
      wpMethods = [];
    }

    const methodsEntries = wpMethods
      .filter((m) => m && typeof m.slug === 'string' && m.slug.trim())
      .map((m) => {
        const canonical = String(m.slug).trim().toLowerCase();
        const enSlug = toMethodsEnSlug(canonical);
        const lastmod = toIsoDate(m.modified_gmt ? `${m.modified_gmt}Z` : null) || null;

        return pageEntry({
          frPath: `/methodes-evaluation-immobiliere/${encodeURIComponent(canonical)}`,
          enPath: `/en/valuation-methods-assets/${encodeURIComponent(enSlug)}`,
          lastmod,
          changefreq: 'monthly',
          priority: '0.6',
        });
      });

    // =========================
    // 4) XML final
    // - 1 <url> FR + 1 <url> EN par entrée
    // - chacun contient les alternates hreflang
    // =========================
    const entries = [...fixedPages, ...newsEntries, ...methodsEntries];

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
      `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
      entries.map((e) => [renderUrl(e, 'fr'), renderUrl(e, 'en')].join('\n')).join('\n') +
      `\n</urlset>\n`;

    sitemapCache = { xml, expiresAt: now + SITEMAP_TTL_MS };

    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(sitemapCache.xml);
  } catch (e) {
    console.error('❌ [SITEMAP] fatal error:', e?.stack || e);

    // fallback : dernier cache si dispo
    if (sitemapCache?.xml) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.send(sitemapCache.xml);
    }

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

const engine = new CommonEngine({
  publicPath: BROWSER_DIR,
  inlineCriticalCss: false,
});

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

    let html = await withTimeout(renderPromise, SSR_TIMEOUT_MS);

    // ✅ Canonical + hreflang SSR fallback (robuste)
    html = injectCanonicalHreflang(html, req);

    // ✅ FIX URGENT : corrige "main<hash>.js" (point manquant) + styles/runtime/polyfills
    html = fixHashedAssetTyposInHtml(html);

    res
      .status(200)
      .set('X-SSR', '1')
      .set('X-SSR-TTFB-MS', String(Date.now() - t0))
      .send(html);
  } catch (err) {
    const code = err?.message === 'SSR_TIMEOUT' ? 'SSR_TIMEOUT' : (err?.message || 'SSR_ERROR');
    console.error('❌ Erreur SSR:', err?.stack || err);
    dumpActiveHandles(code);

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
const NO_LISTEN = (process.env.SSR_NO_LISTEN ?? '0') === '1';

if (!NO_LISTEN) {
  app.listen(PORT, LISTEN_HOST, () => {
    console.log(`✅ [SSR] Groupe ABC écoute sur http://localhost:${PORT} (bind=${LISTEN_HOST}) public=${PUBLIC_HOST}`);
    console.log(`ℹ️ [SSR] Timeout sécurité = ${SSR_TIMEOUT_MS}ms (env SSR_TIMEOUT_MS)`);
    console.log(`ℹ️ [SSR] WP_INTERNAL_ORIGIN = ${WP_INTERNAL_ORIGIN}`);
    console.log(`ℹ️ [SSR] WP_API_BASE = ${WP_API_BASE}`);
    console.log(`ℹ️ [SSR] IS_MAIN = ${IS_MAIN}`);
  });
} else {
  console.log('ℹ️ [SSR] SSR_NO_LISTEN=1 -> server not listening (import mode)');
}

// Export optionnel (utile si tu veux tester sans listen)
export { app };
