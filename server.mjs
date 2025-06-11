import '@angular/compiler';
import 'zone.js/node';
import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CommonEngine } from '@angular/ssr';
import { APP_BASE_HREF } from '@angular/common';
import bootstrap from './bootstrap-proxy.cjs';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DIST_FOLDER = join(__dirname, 'browser');

const app = express();
app.use(express.static(DIST_FOLDER, { maxAge: '1y' }));
app.use('/wp-json', async (req, res) => {
  try {
    const r = await fetch(`https://groupe-abc.fr/wordpress/wp-json${req.url}`);
    if (!r.ok) throw new Error(r.statusText);
    res.json(await r.json());
  } catch {
    res.status(500).json({ error: 'WP API' });
  }
});
app.get('*', async (req, res) => {
  const engine = new CommonEngine();
  try {
    const html = await engine.render({
      bootstrap,
      documentFilePath: join(DIST_FOLDER, 'index.html'),
      url: req.originalUrl,
      publicPath: DIST_FOLDER,
      providers: [{ provide: APP_BASE_HREF, useValue: req.baseUrl }]
    });
    res.status(200).send(html);
  } catch {
    res.status(500).send('SSR error');
  }
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`SSR running on http://localhost:${PORT}`));
