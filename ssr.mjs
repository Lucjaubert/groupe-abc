/* ===== SSR launcher – Groupe ABC (Angular 18) ===== */
import '@angular/compiler';                // ← charge le JIT au cas où
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

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const browserDir = resolve(__dirname, './browser');
const indexHtml  = readFileSync(resolve(browserDir, 'index.html'), 'utf8');

/* Faux DOM minimal pour les libs qui touchent au DOM */
const win = domino.createWindow(indexHtml);
global.window      = win;
global.document    = win.document;
global.navigator   = global.navigator || { userAgent: 'SSR' };
global.HTMLElement = global.HTMLElement || function(){};
global.Node        = global.Node || function(){};
global.history     = global.history || { pushState(){}, replaceState(){}, state:null };

/* === IMPORTE LE BUNDLE SSR EN COMMONJS === */
let server;
try {
  server = await import('./server/main.cjs');    // ← IMPORTANT: .cjs
} catch (e) {
  console.error('❌ Échec import ./server/main.cjs', e);
  process.exit(1);
}

/* Détermine le token de bootstrap (standalone ou AppServerModule) */
let bootstrapToken = (typeof server.default === 'function') ? server.default : null;
if (!bootstrapToken && server.AppComponent)     bootstrapToken = server.AppComponent;
if (!bootstrapToken && server.AppServerModule)  bootstrapToken = server.AppServerModule;
if (!bootstrapToken) {
  console.error('❌ Aucun token de bootstrap valide. Exports =', Object.keys(server));
  process.exit(1);
}

/* Express */
const app = express();
app.disable('x-powered-by');
app.use(compression());
app.use(morgan('tiny'));
app.use(express.static(browserDir, { maxAge: '1y', index: false }));

/* Healthcheck simple */
app.get('/healthz-node', (_req, res) => res.status(200).type('text/plain').send('ok'));

/* Angular Universal */
const engine = new CommonEngine();
app.get('*', async (req, res) => {
  try {
    const html = await engine.render({
      bootstrap: bootstrapToken,
      document : indexHtml,
      url      : req.originalUrl,
      providers: [],           // tu peux y injecter APP_BASE_HREF si besoin
    });
    res.status(200).set('X-SSR', '1').send(html);
  } catch (e) {
    console.error('❌ SSR error → fallback CSR', e?.message || e);
    res.status(200).set('X-SSR', '0').send(indexHtml);
  }
});

/* Lancement */
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`✅ SSR Groupe ABC prêt sur http://localhost:${port} (bundle: ./server/main.cjs)`);
});
