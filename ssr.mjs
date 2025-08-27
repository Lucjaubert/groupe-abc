import 'zone.js/node';
import '@angular/platform-server/init';  // bonnes pratiques SSR
import '@angular/compiler';             // JIT fallback si nécessaire (ex: PlatformNavigation)

import express from 'express';
import { CommonEngine } from '@angular/ssr';
import { dirname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const rootDir     = __dirname;                         // racine du build déployé
const browserDist = resolve(rootDir, 'browser');       // ex: ./browser
const indexHtml   = join(browserDist, 'index.html');

const requireCJS  = createRequire(import.meta.url);

/** Charge le bundle SSR en essayant plusieurs chemins/cas (ESM & CJS). */
async function loadServerBundle() {
  const candidates = [
    './server/main.mjs',
    './server/main.js',
    './server/main.cjs',
    './main.mjs',
    './main.js',
    './main.cjs',
  ];

  for (const rel of candidates) {
    const abs = resolve(rootDir, rel);
    try {
      // Essaye import ESM direct
      const mod = await import(pathToFileURL(abs).href);
      return { mod, path: rel };
    } catch (e1) {
      // Si .cjs, tente require CJS
      if (abs.endsWith('.cjs')) {
        try {
          const mod = requireCJS(abs);
          return { mod, path: rel };
        } catch { /* ignore */ }
      }
      // continue vers le prochain candidat
    }
  }
  throw new Error(`Aucun bundle SSR trouvé. Cherché parmi: ${candidates.join(', ')}`);
}

const { mod, path: usedBundle } = await loadServerBundle();

let renderTarget;
/** Détermine si c'est standalone bootstrap(), renderApplication(), ou NgModule */
if (typeof mod?.default === 'function') {
  console.log('➡️  Utilisation bootstrap standalone (export default).');
  renderTarget = { bootstrap: mod.default };
} else if (mod?.default?.renderApplication) {
  console.log('➡️  Utilisation renderApplication via default.');
  renderTarget = { bootstrap: (opts) => mod.default.renderApplication(opts) };
} else if (typeof mod?.renderApplication === 'function') {
  console.log('➡️  Utilisation renderApplication (nommé).');
  renderTarget = { bootstrap: (opts) => mod.renderApplication(opts) };
} else if (mod?.AppServerModule) {
  console.log('➡️  Utilisation AppServerModule (NgModule).');
  renderTarget = { module: mod.AppServerModule };
} else {
  throw new Error(`❌ Aucun point d’entrée SSR valide trouvé dans ${usedBundle}. Exports: ${Object.keys(mod || {})}`);
}

const app = express();

// ---- Statique (browser build) ----
app.use('/assets', express.static(join(browserDist, 'assets'), { maxAge: '30d', immutable: true }));
app.get('*.*',     express.static(browserDist,                 { maxAge: '1h'  }));

// ---- Healthcheck (simple, sans SSR) ----
app.get('/health', (_req, res) => {
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.status(200).send('ok');
});

// ---- SSR ----
const engine = new CommonEngine();

app.get('*', async (req, res, next) => {
  try {
    const html = await engine.render({
      ...renderTarget,
      documentFilePath: indexHtml,
      url: req.originalUrl,
    });
    res.status(200).send(html);
  } catch (err) {
    console.error('❌ SSR error', err);
    res.status(500).send('SSR error');
  }
});

// ---- Lancement ----
const PORT = process.env.PORT ?? 4100;
app.listen(PORT, () => {
  console.log(`✅ SSR Groupe ABC prêt sur http://localhost:${PORT} (bundle: ${usedBundle})`);
});
