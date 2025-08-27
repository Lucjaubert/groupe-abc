import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { forkJoin } from 'rxjs';

/* =========================
 *  Types de données (ACF)
 * ========================= */
type Intro        = { title: string; content: string };
type CoreValue    = { title?: string; html?: string; icon?: string };
type CoreBlock    = { title?: string; html?: string; icon?: string; items?: string[] };
type TimelineStep = { year?: string; title?: string; html?: string };
type AffItem      = { logo?: string; excerpt?: string; content?: string };
type DeonItem     = { title?: string; html?: string };
type Mesh         = { title?: string; image?: string; levels: string[] };
type MapSection   = { title?: string; image?: string; items: string[] };

/** Section “Nos valeurs” (bloc dédié) */
type ValueItem = { title: string; html: string; iconUrl: string };

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
})
export class AboutComponent implements OnInit {
  /* Services */
  private wp  = inject(WordpressService);
  private seo = inject(SeoService);

  /* =========================
   *  State (affecté en ngOnInit)
   * ========================= */
  // Intro de page (titre + corps HTML)
  intro: Intro = { title: '', content: '' };

  // Core (grille : gauche = intro, droite = “Où ?”, dessous = valeurs (legacy))
  core: CoreBlock[] = [];

  // Bloc dédié “Nos valeurs” (pour la section avec fond #F5F4F8)
  coreValuesTitle = '';
  coreValues: ValueItem[] = [];

  // Timeline (liste d’événements)
  timeline: TimelineStep[] = [];

  // Affiliations (titre, préambule, cartes)
  affTitle = '';
  affPreamble = '';
  affiliations: AffItem[] = [];

  // Déontologie (titre + items)
  deonTitle = '';
  deontology: DeonItem[] = [];

  // Mesh (maillage : skyline + 3 niveaux)
  mesh?: Mesh;

  // Carte “Où ?” (image + liste des régions)
  mapSection?: MapSection;

  /* =========================
   *  Cycle de vie
   * ========================= */
  ngOnInit(): void {
    // On charge en parallèle :
    // - la page About (ACF)
    // - la liste "Où ?" provenant de la Home (fallback si vide : map_section de About)
    forkJoin({
      about: this.wp.getAboutData(),
      whereFromHome: this.wp.getHomepageIdentityWhereItems(),
    }).subscribe(({ about, whereFromHome }) => {

      /* -------------------------------------
       *  INTRO (titre + texte principal)
       * ------------------------------------- */
      const hero = about?.hero ?? {};
      const introBody: string = about?.intro_body || '';
      this.intro = {
        title: hero.section_title || 'Qui sommes-nous ?',
        content: introBody
      };

      /* -------------------------------------
       *  CARTE "OÙ ?" (image + liste régions)
       *  - items : priorise la Home, sinon fallback sur map_section du About
       * ------------------------------------- */
      const mapSecRaw = about?.map_section ?? {};
      const whereFallback = [
        mapSecRaw.where_item_1, mapSecRaw.where_item_2, mapSecRaw.where_item_3, mapSecRaw.where_item_4,
        mapSecRaw.where_item_5, mapSecRaw.where_item_6, mapSecRaw.where_item_7, mapSecRaw.where_item_8
      ].filter(Boolean) as string[];

      const whereItems = (Array.isArray(whereFromHome) && whereFromHome.length)
        ? whereFromHome
        : whereFallback;

      this.mapSection = {
        title: mapSecRaw.where_title || 'Où ?',
        image: typeof mapSecRaw.map_image === 'string' ? mapSecRaw.map_image : '',
        items: whereItems
      };

      /* -------------------------------------
       *  CORE (3 blocs “legacy”)
       *   - gauche  : intro
       *   - droite  : liste "Où ?"
       *   - dessous : "Nos valeurs" (texte concaténé)
       * ------------------------------------- */
      // Colonne gauche (reprend l’intro)
      const left: CoreBlock = {
        title: this.intro.title,
        html:  this.intro.content
      };

      // Colonne droite (liste "Où ?")
      const right: CoreBlock = {
        items: whereItems.length ? whereItems : undefined
      };

      // Dessous : "Nos valeurs" (pour l’ancien bloc)
      const cv = about?.core_values ?? {};
      const valuesLegacy: CoreValue[] = ['value_1','value_2','value_3']
        .map((k) => {
          const v = cv[k] ?? {};
          const icon = (typeof v.icon === 'string')
            ? v.icon
            : (typeof v.icon === 'number' ? String(v.icon) : '');
          return {
            title: v.title || '',
            html:  v.description || '',
            icon
          };
        })
        .filter(v => v.title || v.html);

      const valuesHtml = valuesLegacy.length
        ? valuesLegacy.map(v => `
            ${v.title ? `<h3 class="block-title" style="margin-top:0">${v.title}</h3>` : ''}
            ${v.html  ? `<div class="block-html">${v.html}</div>` : ''}
          `).join('')
        : '';

      const below: CoreBlock = {
        title: cv.section_title || 'Nos valeurs',
        html:  valuesHtml || ''
      };

      this.core = [left, right, below].filter(b => b.title || b.html || (b.items && b.items.length));

      /* -------------------------------------
       *  BLOC DÉDIÉ “NOS VALEURS” (section avec fond #F5F4F8)
       * ------------------------------------- */
      this.coreValuesTitle = (about?.core_values?.section_title || 'Nos valeurs').trim();

        // Étape 1 : on lit tel quel (sans rien transformer)
        const rawValues = ['value_1','value_2','value_3']
          .map(k => (about?.core_values as any)?.[k])
          .filter(Boolean)
          .map(v => ({
            title: (v.title || '').trim(),
            html:  (v.description || '').trim(),
            icon:  v.icon as string | number | undefined,  // peut être URL ou ID
          }));

        // Petit utilitaire : résout un champ icon (URL ou ID) -> URL
        const resolveIconUrl = (icon: string | number | undefined) => {
          if (!icon) return Promise.resolve('');
          if (typeof icon === 'string') return Promise.resolve(icon); // URL déjà fournie
          // ID numérique -> on demande l’URL au service (à implémenter si pas déjà fait)
          return this.wp.getMediaUrl(icon).toPromise().then(u => u || '');
        };

        // Étape 2 : on résout toutes les icônes en parallèle, SANS les modifier
        Promise.all(rawValues.map(async v => ({
          title: v.title,
          html:  v.html,
          iconUrl: await resolveIconUrl(v.icon),
        }))).then(resolved => {
          this.coreValues = resolved.filter(v => v.title || v.html || v.iconUrl);
        });

      /* -------------------------------------
       *  TIMELINE (event_1..event_n)
       * ------------------------------------- */
      const tlRaw = about?.timeline ?? {};
      const events: TimelineStep[] = [];
      for (let i = 1; i <= 12; i++) {
        const ev = (tlRaw as any)[`event_${i}`];
        if (!ev) continue;
        const step: TimelineStep = {
          year:  ev.year  || '',
          title: ev.title || '',
          html:  ev.description || ''
        };
        if (step.year || step.title || step.html) events.push(step);
      }
      this.timeline = events;

      /* -------------------------------------
       *  AFFILIATIONS (association_1..5)
       * ------------------------------------- */
      const a = about?.affiliations ?? {};
      this.affTitle     = a.section_title || 'Appartenance';
      this.affPreamble  = '';

      // utilitaire : number|string -> URL string (ici on laisse l’ID sous forme de string si besoin)
      const mediaToUrl = (v: unknown): string => {
        if (typeof v === 'string') return v;         // URL déjà fournie
        if (typeof v === 'number') return String(v); // ID numérique (à résoudre plus tard si besoin)
        return '';
      };

      const affs: AffItem[] = [];
      for (let i = 1; i <= 5; i++) {
        const it = (a as any)[`association_${i}`];
        if (!it) continue;
        affs.push({
          logo:    mediaToUrl(it.logo),
          excerpt: it.name || '',
          content: it.description || ''
        });
      }
      this.affiliations = affs.filter(x => !!(x.logo || x.excerpt || x.content));

      /* -------------------------------------
       *  DÉONTOLOGIE (deo_1..deo_4)
       * ------------------------------------- */
      const d = about?.deontology ?? {};
      this.deonTitle   = d.deo_title || 'DEONTOLOGIE';
      this.deontology  = [1,2,3,4]
        .map(i => {
          const di = (d as any)[`deo_${i}`];
          if (!di) return null;
          return {
            title: di.title || '',
            html:  di.deo_description || ''
          } as DeonItem;
        })
        .filter(Boolean) as DeonItem[];

      /* -------------------------------------
       *  MESH (maillage skyline + niveaux)
       * ------------------------------------- */
      const m = about?.mesh ?? {};
      this.mesh = {
        title:  m.section_title || 'Un maillage à toutes les échelles de notre territoire',
        image:  typeof m.skyline_image === 'string' ? m.skyline_image : '',
        levels: [m.level_label_1, m.level_label_2, m.level_label_3].filter(Boolean) as string[],
      };

      /* -------------------------------------
       *  SEO (fallback si vide)
       * ------------------------------------- */
      this.seo.update({
        title:       this.intro.title || 'Qui sommes-nous ? – Groupe ABC',
        description: this.strip(this.intro.content, 160),
        keywords:    undefined,
        image:       ''
      });
    });
  }

  /* =========================
   *  Utils
   * ========================= */

  /** trackBy pour *ngFor (performances, pas de recréation DOM) */
  trackByIndex(i: number){ return i; }

  /** Supprime les balises HTML et tronque pour la meta description */
  private strip(html: string, max = 160): string {
    const t = (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }
}
