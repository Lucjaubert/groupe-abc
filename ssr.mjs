import '@angular/compiler';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import express from 'express';
import compression from 'compression';
import domino from 'domino';
import morgan from 'morgan';

// Important pour calmer Angular côté SSR (JIT/linker)
import '@angular/platform-server/init';
// Charge @angular/compiler en side-effect si une lib tente du JIT
import('@angular/compiler').catch(() => { /* ignore si déjà AOT */ });

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const browserDir = resolve(__dirname, './browser');
const indexHtml  = readFileSync(resolve(browserDir, 'index.html'), 'utf8');

// Minimal window pour les libs qui touchent au DOM
const win = domino.createWindow(indexHtml);
global.window      = win;
global.document    = win.document;
global.navigator   = global.navigator || { userAgent: 'SSR' };
global.HTMLElement = global.HTMLElement || function(){};
global.Node        = global.Node || function(){};
global.history     = global.history || { pushState(){}, replaceState(){}, state:null };

import { CommonEngine } from '@angular/ssr';

// Charge le bundle Angular généré par `ng build --ssr`
const server = await import('./server/main.cjs');

// Choisit un token de bootstrap valide (standalone default, AppComponent, ou AppServerModule)
let bootstrapToken = (typeof server.default === 'function') ? server.default : null;
if (!bootstrapToken && server.AppComponent)     bootstrapToken = server.AppComponent;
if (!bootstrapToken && server.AppServerModule)  bootstrapToken = server.AppServerModule;
if (!bootstrapToken) {
  console.error('❌ Aucun token de bootstrap valide. Exports =', Object.keys(server));
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.use(compression());
app.use(morgan('tiny'));

// fichiers statiques du build browser
app.use(express.static(browserDir, { maxAge: '1y', index: false }));

// healthcheck
app.get('/healthz-node', (_req, res) => res.status(200).type('text/plain').send('ok'));

const engine = new CommonEngine();

app.get('*', async (req, res) => {
  try {
    const html = await engine.render({
      bootstrap: bootstrapToken,
      document : indexHtml,
      url      : req.originalUrl
    });
    res.status(200).set('X-SSR', '1').send(html);
  } catch (e) {
    console.error('❌ SSR error -> fallback CSR', e?.message || e);
    res.status(200).set('X-SSR', '0').send(indexHtml);
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`✅ SSR Groupe ABC prêt sur http://localhost:${port} (bundle: ./server/main.cjs)`);
});
