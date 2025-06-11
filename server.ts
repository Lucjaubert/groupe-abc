import 'zone.js/node';
import express from 'express';
import { join } from 'path';
import { CommonEngine } from '@angular/ssr';
import { APP_BASE_HREF } from '@angular/common';
import cors from 'cors';
import fetch from 'node-fetch';

// Chemins de build
const DIST_FOLDER = "/var/www/lucjaubert_c_usr14/data/www/groupe-abc.fr/groupe-abc_angular/browser";
const SSR_FOLDER  = "/var/www/lucjaubert_c_usr14/data/www/groupe-abc.fr/groupe-abc_angular/server";

const mainServer  = require(join(SSR_FOLDER, 'main.js')).default;

const app = express();

// Middleware CORS pour interagir avec WordPress Headless
app.use(cors());
app.use(express.json());

// Proxy vers l'API WordPress Headless (PLACÉ AVANT `app.get('*')`)
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

// Sert les fichiers statiques (Angular côté client)
app.get('*.*', express.static(DIST_FOLDER, { maxAge: '1y' }));

// Angular SSR sur la racine
app.get('*', (req: express.Request, res: express.Response) => {
  const engine = new CommonEngine();
  engine
    .render({
      bootstrap: mainServer,
      documentFilePath: join(__dirname, '..', 'browser', 'index.html'),
      url: req.originalUrl,
      publicPath: DIST_FOLDER, // Correction
      providers: [{ provide: APP_BASE_HREF, useValue: req.baseUrl }]
    })
    .then((html) => res.status(200).send(html))
    .catch((err) => {
      console.error('❌ Erreur lors du rendu SSR', err);
      res.status(500).send('Une erreur est survenue');
    });
});

// Définition du port
const PORT = parseInt(process.env['PORT'] || '4000', 10);
app.listen(PORT, () => {
  console.log(`✅ Serveur Node SSR en cours sur http://localhost:${PORT}`);
});
