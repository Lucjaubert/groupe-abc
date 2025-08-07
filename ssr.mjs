
/* ------------ 0. Faux DOM (doit précéder Angular) -------------- */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import domino from 'domino';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST      = join(__dirname, 'browser');
const tpl       = readFileSync(join(DIST, 'index.html'), 'utf8');
const win       = domino.createWindow(tpl);
['window', 'document', 'navigator', 'location'].forEach(k => globalThis[k] ??= win[k]);
global.document    = win.document;
global.HTMLElement = win.HTMLElement;
global.Node        = win.Node;

/* ------------ 1. Outillage ------------------------------------ */
import 'source-map-support/register.js';   // traces lisibles
import 'zone.js/node';                     // zone pour Node

/* !! ligne indispensable pour compiler les templates Angular ---- */
import '@angular/compiler';

/* Angular se prépare seulement maintenant ----------------------- */
import '@angular/platform-server/init';

/* ------------ 2. Dépendances ---------------------------------- */
import express  from 'express';
import fetch    from 'node-fetch';
import { CommonEngine }            from '@angular/ssr';
import { APP_BASE_HREF, DOCUMENT } from '@angular/common';

/* ------------ 3. Bundle Angular ------------------------------- */
const SERVER_BUNDLE = './server/main.js';
const bundle        = await import(SERVER_BUNDLE);
const isNgModule    = t => typeof t === 'function' && t.ɵmod && t.ɵinj;

const renderTarget =
  isNgModule(bundle.AppServerModule)                       ? { module:    bundle.AppServerModule } :
  typeof bundle.default === 'function'                     ? { bootstrap: bundle.default } :
  (typeof bundle.default === 'object' &&
   typeof bundle.default.renderApplication === 'function') ? { bootstrap: o => bundle.default.renderApplication(o) } :
  (() => { throw new Error('Point d’entrée SSR introuvable'); })();

/* ------------ 4. Express + proxy WP --------------------------- */
const app = express();
app.use(express.static(DIST, { maxAge: '1y' }));

app.use('/wp-json', async (req, res) => {
  try {
    const r = await fetch('https://wordpress.groupe-abc.fr/wp-json' + req.url);
    res.status(r.status).set('content-type', r.headers.get('content-type') ?? 'application/json')
       .send(await r.text());
  } catch (e) {
    console.error('❌ proxy /wp-json', e);
    res.status(500).send('proxy error');
  }
});

/* ------------ 5. Universal engine ----------------------------- */
const engine = new CommonEngine();

app.get('*', async (req, res) => {
  try {
    const html = await engine.render({
      ...renderTarget,
      documentFilePath: join(DIST, 'index.html'),
      url:        req.originalUrl,
      publicPath: DIST,
      providers: [
        { provide: DOCUMENT,      useValue: win.document },
        { provide: APP_BASE_HREF, useValue: req.baseUrl },
      ],
    });
    res.status(200).send(html);
  } catch (err) {
    console.error('❌ SSR error – fallback CSR', err);
    res.status(200).send(tpl); // fallback côté client
  }
});

/* ------------ 6. Lancement ------------------------------------ */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ SSR Groupe ABC prêt sur http://localhost:${PORT}`));
