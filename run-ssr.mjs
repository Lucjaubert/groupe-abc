// run-ssr.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
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
globalThis.getComputedStyle = globalThis.getComputedStyle ?? (() => ({}));
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame ?? (cb => setTimeout(cb, 0));
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame ?? (id => clearTimeout(id));
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
globalThis.localStorage  = globalThis.localStorage  ?? makeStore();
globalThis.sessionStorage = globalThis.sessionStorage ?? makeStore();

// ---- PATCH HISTORY : ne pas réassigner l'objet, compléter son prototype
try {
  const HistoryCtor = win.History || (win.history && win.history.constructor);
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
      return _set ? _set.call(this, String(prop ?? ''), String(value), priority ?? '') : undefined;
    };
    const _val = CSSDecl.value;
    if (typeof _val === 'function') {
      CSSDecl.value = function (v) {
        return _val.call(this, v == null ? '' : v);
      };
    }
  }
} catch { /* silencieux */ }

// Protéger add/removeEventListener s’ils n’existent pas
window.addEventListener = window.addEventListener ?? function(){};
window.removeEventListener = window.removeEventListener ?? function(){};

// ---------- CHARGEMENT DU BUNDLE SERVEUR ----------
const mod = require('./server/main.cjs');
const port = process.env.PORT || 4000;

(async () => {
  try {
    if (typeof mod.run === 'function') {
      console.log('[SSR] Using mod.run()');
      await mod.run();
      return;
    }
    if (typeof mod.app === 'function') {
      console.log('[SSR] Using mod.app()');
      const app = await mod.app();
      app.get?.('/healthz-node', (_req, res) => res.send('ok'));
      app.listen(port, () => console.log(`[SSR] listening on :${port}`));
      return;
    }
    if (typeof mod.default === 'function') {
      console.log('[SSR] Using default export');
      const ret = await mod.default(port);
      if (ret?.listen) {
        ret.get?.('/healthz-node', (_req, res) => res.send('ok'));
        ret.listen(port, () => console.log(`[SSR] listening on :${port}`));
      }
      return;
    }
    console.error('❌ Entrée serveur non reconnue. Exports =', Object.keys(mod));
    process.exit(1);
  } catch (err) {
    console.error('❌ SSR bootstrap failed:', err);
    process.exit(1);
  }
})();
