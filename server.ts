import 'zone.js/node';
import express from 'express';
import { join } from 'path';
import { CommonEngine } from '@angular/ssr';
import { APP_BASE_HREF } from '@angular/common';
import cors from 'cors';
import fetch from 'node-fetch';

/**
 * Dossiers de build, RELATIFS au bundle serveur.
 *
 * Si ton fichier compilé est : /var/www/.../groupe-abc_angular/server/server.cjs
 * alors __dirname = /var/www/.../groupe-abc_angular/server
 *
 * ➜ BROWSER_DIST = /var/www/.../groupe-abc_angular/browser
 * ➜ SSR_DIST     = /var/www/.../groupe-abc_angular/server
 */
const SSR_DIST = __dirname;
const BROWSER_DIST = join(__dirname, '..', 'browser');

// On charge le bundle SSR Angular (dist/groupe-abc/server/main.cjs)
const mainServer = require(join(SSR_DIST, 'main.cjs')).default;

const app = express();

// (debug) marquer les réponses qui passent par le SSR
app.use((req, res, next) => {
  res.set('x-ssr', 'on');
  next();
});

// End-point de santé (utile pour tests et monitoring)
app.get('/healthz', (_req, res) => {
  res.status(200).send('ok');
});

// CORS / JSON
app.use(cors());
app.use(express.json());

// Proxy vers l’API WordPress (avant SSR)
app.use('/wp-json', async (req, res) => {
  try {
    const response = await fetch(`https://wordpress.groupe-abc.fr/wp-json${req.url}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('❌ Erreur API WordPress:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des données WordPress' });
  }
});

// Fichiers statiques Angular (assets, *.js, *.css, etc.)
app.get('*.*', express.static(BROWSER_DIST, {
  maxAge: '1y',
  immutable: true,
}));

// ─────────────────────────────────────────────
// SSR : on délègue le rendu à Angular Universal
// ─────────────────────────────────────────────
app.get('*', async (req, res) => {
  try {
    const engine = new CommonEngine();

    const html = await engine.render({
      bootstrap: mainServer,
      documentFilePath: join(BROWSER_DIST, 'index.html'),
      url: req.originalUrl,
      publicPath: BROWSER_DIST,
      providers: [
        { provide: APP_BASE_HREF, useValue: req.baseUrl },
        { provide: 'SSR_REQUEST',  useValue: req },
        { provide: 'SSR_RESPONSE', useValue: res },
      ],
    });

    // Ne pas écraser un statut déjà posé (ex: 404 depuis ton composant NotFound)
    if (!res.headersSent) {
      res.send(html);
    }
  } catch (err) {
    console.error('❌ Erreur lors du rendu SSR', err);
    if (!res.headersSent) {
      res.status(500).send('Une erreur est survenue');
    }
  }
});

// Port : aligne avec Nginx (proxy_pass -> 127.0.0.1:4300)
const PORT = parseInt(process.env['PORT'] ?? '4300', 10);

app.listen(PORT, () => {
  console.log(`✅ Serveur Node SSR en cours sur http://localhost:${PORT}`);
});
