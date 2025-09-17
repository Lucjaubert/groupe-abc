// ssr.mjs
import 'zone.js/node';
import '@angular/platform-server/init';
import '@angular/compiler'; // JIT fallback si besoin (ex: PlatformNavigation)

import express from 'express';
import { CommonEngine } from '@angular/ssr';
import { dirname, join, resolve, extname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';
import { readFileSync, access } from 'fs';
import { constants as FS } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT       = __dirname;
const BROWSER    = process.env.BROWSER_DIST || resolve(ROOT, 'browser');
const INDEX_HTML = process.env.INDEX_HTML    || join(BROWSER, 'index.html');
const PORT       = Number(process.env.PORT || 4000);
const SSR_ENTRY  = process.env.SSR_ENTRY; // <-- permet de forcer server/main.cjs

const requireCJS = createRequire(import.meta.url);

function exists(p) {
  return new Promise((r) => access(p, FS.F_OK, (e) => r(!e)));
}

async function loadModuleByPath(absPath) {
  const ext = extname(absPath).toLowerCase();
  if (ext === '.cjs') {
    return { mod: requireCJS(absPath), used: relFromRoot(absPath) };
  }
  if (ext === '.mjs' || ext === '.js') {
    // .js chez Angular 18 côté server est souvent ESM → import()
    return { mod: await import(pathToFileURL(absPath).href), used: relFromRoot(absPath) };
  }
  // Par défaut, tenter import()
  return { mod: await import(pathToFileURL(absPath).href), used: relFromRoot(absPath) };
}

function relFromRoot(abs) {
  return abs.startsWith(ROOT) ? abs.substring(ROOT.length + 1) : abs;
}

/** Charge le bundle SSR :
 *  1) Si SSR_ENTRY est défini → on le respecte strictement
 *  2) Sinon on préfère main.cjs, puis main.mjs, puis main.js
 */
async function loadServerBundle() {
  if (SSR_ENTRY) {
    const forced = resolve(ROOT, SSR_ENTRY);
    if (!(await exists(forced))) {
      throw new Error(`SSR_ENTRY pointe vers un fichier introuvable: ${forced}`);
    }
    try {
      return await loadModuleByPath(forced);
    } catch (e) {
      console.error('⚠️  Échec de chargement du bundle forcé:', e);
      throw e;
    }
  }

  const candidates = [
    resolve(ROOT, 'server/main.cjs'),
    resolve(ROOT, 'server/main.mjs'),
    resolve(ROOT, 'server/main.js'),
  ];

  for (const abs of candidates) {
    if (await exists(abs)) {
      try {
        return await loadModuleByPath(abs);
      } catch (e) {
        console.error(`⚠️  Échec de chargement ${relFromRoot(abs)} → on tente le suivant. Détail:`, e?.message || e);
      }
    }
  }

  console.warn('⚠️  Aucun bundle SSR trouvé dans ./server — démarrage en mode CSR-only.');
  return { mod: null, used: 'CSR-only' };
}

const { mod, used } = await loadServerBundle();

// Détermine l’entrée SSR (standalone / renderApplication / NgModule)
let renderTarget = null;
if (mod) {
  if (typeof mod?.default === 'function') {
    console.log('➡️  bootstrap standalone (export default).');
    renderTarget = { bootstrap: mod.default };
  } else if (mod?.default?.renderApplication) {
    console.log('➡️  renderApplication via default.');
    renderTarget = { bootstrap: (opts) => mod.default.renderApplication(opts) };
  } else if (typeof mod?.renderApplication === 'function') {
    console.log('➡️  renderApplication (nommé).');
    renderTarget = { bootstrap: (opts) => mod.renderApplication(opts) };
  } else if (mod?.AppServerModule) {
    console.log('➡️  AppServerModule (NgModule).');
    renderTarget = { module: mod.AppServerModule };
  } else {
    console.warn(`⚠️  Bundle chargé (${used}) mais pas d’entrée SSR valide. CSR-only.`);
  }
}

const app = express();
const engine = new CommonEngine();

// Statique
app.use('/assets', express.static(join(BROWSER, 'assets'), { maxAge: '30d', immutable: true }));
app.get('*.*',     express.static(BROWSER,                 { maxAge: '1h'  }));

// Healthcheck
app.get('/health', (_req, res) => res.status(200).type('text/plain').send('ok'));

// Fallback CSR
function sendCSR(res) {
  const html = readFileSync(INDEX_HTML, 'utf-8');
  res.status(200).type('text/html; charset=utf-8').send(html);
}

// SSR route
app.get('*', async (req, res) => {
  if (!renderTarget) return sendCSR(res);
  try {
    const html = await engine.render({
      ...renderTarget,
      documentFilePath: INDEX_HTML,
      url: req.originalUrl,
    });
    res.status(200).type('text/html; charset=utf-8').send(html);
  } catch (err) {
    console.error('❌ SSR error -> fallback CSR :', err?.message);
    sendCSR(res);
  }
});

app.listen(PORT, () => {
  console.log(`✅ SSR Groupe ABC prêt sur http://localhost:${PORT} (bundle: ${used})`);
});
