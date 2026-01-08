/* ===== SSR launcher – Groupe ABC (Angular 18) ===== */
import '@angular/compiler';                // JIT au cas où
import '@angular/platform-server/init';    // prépare Angular côté Node
import 'zone.js/node';
import 'source-map-support/register.js';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import express from 'express';
import compression from 'compression';
import domino from 'domino';
import morgan from 'morgan';
import { CommonEngine } from '@angular/ssr';
import { APP_BASE_HREF } from '@angular/common';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const browserDir     = resolve(__dirname, './browser');
const indexHtmlPath  = resolve(browserDir, 'index.html');
const indexHtml      = readFileSync(indexHtmlPath, 'utf8');

/* Faux DOM minimal pour les libs qui touchent au DOM */
const win = domino.createWindow(indexHtml);

globalThis.window    = win;
globalThis.document  = win.document;
globalThis.navigator = globalThis.navigator || { userAgent: 'SSR' };
globalThis.HTMLElement = globalThis.HTMLElement || function(){};
globalThis.Node        = globalThis.Node || function(){};

// history (au cas où des libs l’utilisent)
globalThis.history = globalThis.history || {
  pushState() {},
  replaceState() {},
  state: null,
};

// scrollTo no-op si absent
if (typeof win.scrollTo !== 'function') {
  win.scrollTo = () => {};
}

/* === IMPORTE LE BUNDLE SSR EN CJS === */
let server;
try {
  server = await import('./server/main.cjs'); // main.cjs généré par Angular
} catch (e) {
  console.error('❌ Échec import ./server/main.cjs', e);
  process.exit(1);
}

/* Détermine le token de bootstrap (standalone ou module) */
let bootstrapToken =
  typeof server.default === 'function'
    ? server.default
    : (server.AppServerModule || server.AppComponent || null);

if (!bootstrapToken) {
  console.error('❌ Aucun token de bootstrap valide. Exports =', Object.keys(server));
  process.exit(1);
}

/* Express */
const app = express();
app.disable('x-powered-by');
app.use(compression());
app.use(morgan('tiny'));

// fichiers statiques Angular
app.use(express.static(browserDir, { maxAge: '1y', index: false }));

/* Healthcheck simple */
app.get('/healthz-node', (_req, res) =>
  res.status(200).type('text/plain').send('ok')
);

/* Angular Universal */
const engine = new CommonEngine();

app.get('*', async (req, res) => {
  try {
    const html = await engine.render({
      bootstrap: bootstrapToken,
      documentFilePath: indexHtmlPath,
      url: req.originalUrl,
      publicPath: browserDir,
      providers: [
        { provide: APP_BASE_HREF, useValue: req.baseUrl || '/' },
      ],
    });

    res
      .status(200)
      .set('X-SSR', '1')
      .send(html);
  } catch (e) {
    console.error('❌ SSR error → fallback CSR', e?.message || e);
    res
      .status(200)
      .set('X-SSR', '0')
      .send(indexHtml);
  }
});

/* Lancement */
const port = process.env.PORT || 4300; // ⚠️ aligné avec Nginx
app.listen(port, () => {
  console.log(`✅ SSR Groupe ABC prêt sur http://localhost:${port} (bundle: ./server/main.cjs)`);
});
