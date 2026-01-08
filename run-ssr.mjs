// run-ssr.mjs

// ===== Angular / SSR init =====
import '@angular/compiler';
import '@angular/platform-server/init';
import 'zone.js/node';
import 'source-map-support/register.js';

// ===== Node / ESM imports =====
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

// Imports ESM
import express from 'express';
import compression from 'compression';
import morgan from 'morgan';
import { CommonEngine } from '@angular/ssr';

const require = createRequire(import.meta.url);

// ---------- DOM SHIM (Domino) ----------
const { createWindow } = require('domino');
const indexHtml = readFileSync(join(process.cwd(), 'browser', 'index.html'), 'utf8');
const win = createWindow(indexHtml);

// Expose de base
globalThis.window = win;
globalThis.document = win.document;
globalThis.navigator = win.navigator ?? { userAgent: 'SSR' };
globalThis.location = win.location ?? new URL('https://groupe-abc.fr');
globalThis.HTMLElement = win.HTMLElement;
globalThis.Event = win.Event;
globalThis.CSSStyleDeclaration = win.CSSStyleDeclaration;

// getComputedStyle / raf
globalThis.getComputedStyle =
  globalThis.getComputedStyle ?? (() => ({}));
globalThis.requestAnimationFrame =
  globalThis.requestAnimationFrame ?? (cb => setTimeout(cb, 0));
globalThis.cancelAnimationFrame =
  globalThis.cancelAnimationFrame ?? (id => clearTimeout(id));
globalThis.matchMedia = globalThis.matchMedia ?? (() => ({
  matches:false, media:'', onchange:null,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; }
}));

// Storages en mémoire
const makeStore = () => {
  const s = new Map();
  return {
    getItem: k => (s.has(k) ? String(s.get(k)) : null),
    setItem: (k,v) => { s.set(k, String(v)); },
    removeItem: k => { s.delete(k); },
    clear: () => { s.clear(); },
    key: i => Array.from(s.keys())[i] ?? null,
    get length() { return s.size; },
  };
};
globalThis.localStorage   = globalThis.localStorage   ?? makeStore();
globalThis.sessionStorage = globalThis.sessionStorage ?? makeStore();

// ---- PATCH HISTORY : ne pas réassigner l'objet, compléter son prototype
try {
  const HistoryCtor  = win.History || (win.history && win.history.constructor);
  const HistoryProto = HistoryCtor ? HistoryCtor.prototype : Object.getPrototypeOf(win.history);
  const ensure = (name) => {
    if (typeof HistoryProto[name] !== 'function') {
      Object.defineProperty(HistoryProto, name, { value: function(){}, configurable: true });
    }
  };
  ensure('pushState');
  ensure('replaceState');
  ensure('back');
  ensure('forward');
  ensure('go');
} catch { /* silencieux */ }

// ---- SHIMS navigateurs manquants
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}

if (typeof window.scrollTo !== 'function') {
  window.scrollTo = function () {}; // no-op SSR
}

// ---- Image stub ROBUSTE (global, window, HTMLImageElement)
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
        // Simule un succès asynchrone pour ne pas bloquer les promesses de preload
        if (typeof this.onload === 'function') {
          setTimeout(() => this.onload(), 0);
        }
      }
      get src() { return this._src; }
    }
    globalThis.Image = SSRImage;
    global.Image = SSRImage;
    if (globalThis.window) window.Image = SSRImage;
    globalThis.HTMLImageElement = globalThis.HTMLImageElement || SSRImage;
  } else {
    // S'assurer que window.Image pointe bien dessus et soit modifiable si nécessaire
    try {
      const desc = Object.getOwnPropertyDescriptor(window, 'Image');
      if (!desc || desc.writable === false || desc.configurable === false) {
        Object.defineProperty(window, 'Image', { value: globalThis.Image, writable: true, configurable: true });
      } else {
        window.Image = globalThis.Image;
      }
    } catch { /* no-op */ }
  }
})();

// ---- PATCH CSS Domino : éviter parse de valeurs undefined/null
try {
  const CSSDecl = win.CSSStyleDeclaration?.prototype;
  if (CSSDecl) {
    const _set = CSSDecl.setProperty;
    CSSDecl.setProperty = function (prop, value, priority) {
      if (value == null) value = '';
      return _set
        ? _set.call(this, String(prop ?? ''), String(value), priority ?? '')
        : undefined;
    };
    const _val = CSSDecl.value;
    if (typeof _val === 'function') {
      CSSDecl.value = function (v) {
        try {
          return _val.call(this, v == null ? '' : v);
        } catch (e) {
          // On absorbe l'erreur Domino CSS (TokenStream.type undefined)
          return '';
        }
      };
    }
  }
} catch { /* silencieux */ }

// Protéger add/removeEventListener s’ils n’existent pas
window.addEventListener = window.addEventListener ?? function(){};
window.removeEventListener = window.removeEventListener ?? function(){};

// ---------- CHARGEMENT DU BUNDLE SERVEUR + EXPRESS SSR ----------

// On charge le bundle SSR Angular compilé (CommonJS)
const serverBundle = require('./server/main.cjs');

// On cherche le "bootstrap token"
let bootstrapToken = null;
if (typeof serverBundle.default === 'function') {
  // Angular 17/18 standalone : export default function bootstrap() { ... }
  bootstrapToken = serverBundle.default;
} else if (serverBundle.AppServerModule) {
  bootstrapToken = serverBundle.AppServerModule;
} else if (serverBundle.AppComponent) {
  bootstrapToken = serverBundle.AppComponent;
}

if (!bootstrapToken) {
  console.error('❌ Aucun token de bootstrap trouvé dans ./server/main.cjs. Exports =', Object.keys(serverBundle));
  process.exit(1);
}

// Express app
const app = express();
app.disable('x-powered-by');
app.use(compression());
app.use(morgan('tiny'));

// Fichiers statiques Angular (dist/browser)
app.use(
  express.static(join(process.cwd(), 'browser'), {
    maxAge: '1y',
    index: false,
  })
);

// Healthcheck Node
app.get('/healthz-node', (_req, res) =>
  res.status(200).type('text/plain').send('ok')
);

// Angular SSR
const engine = new CommonEngine();

app.get('*', async (req, res) => {
  try {
    const html = await engine.render({
      bootstrap: bootstrapToken,
      document : indexHtml,
      url      : req.originalUrl,
      providers: [],
    });
    res.status(200).set('X-SSR', '1').send(html);
  } catch (err) {
    console.error('❌ Erreur SSR, fallback CSR', err?.message || err);
    res.status(200).set('X-SSR', '0').send(indexHtml);
  }
});

// Lancement HTTP sur 4300 (aligné avec Nginx)
const port = parseInt(process.env.PORT || '4300', 10);
app.listen(port, () => {
  console.log(`✅ [SSR] Groupe ABC en écoute sur http://localhost:${port} (bundle: ./server/main.cjs)`);
});
