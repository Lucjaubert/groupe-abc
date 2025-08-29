import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { forkJoin, firstValueFrom } from 'rxjs';

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

  // Bloc dédié “Nos valeurs”
  coreValuesTitle = '';
  coreValues: ValueItem[] = [];

  // Timeline (liste d’événements)
  timeline: TimelineStep[] = [];
  timelineTitle = '';

  // Affiliations
  affTitle = '';
  affPreamble = '';
  affiliations: AffItem[] = [];
  /** états d’ouverture des lignes d’appartenance (chevrons) */
  affOpen: boolean[] = [];

  // Déontologie
  deonTitle = '';
  deontology: DeonItem[] = [];
  /** états d’ouverture des lignes de déontologie (chevrons) */
  deonOpen: boolean[] = [];

  // Mesh (maillage : skyline + 3 niveaux)
  mesh?: Mesh;

  // Carte “Où ?” (image + liste des régions)
  mapSection?: MapSection;

  /* =========================
   *  Cycle de vie
   * ========================= */
  ngOnInit(): void {
    forkJoin({
      about: this.wp.getAboutData(),
      whereFromHome: this.wp.getHomepageIdentityWhereItems(),
    }).subscribe(async ({ about, whereFromHome }) => {

      /* -------------------------------------
       *  INTRO
       * ------------------------------------- */
      const hero = about?.hero ?? {};
      const introBody: string = about?.intro_body || '';
      this.intro = {
        title: hero.section_title || 'Qui sommes-nous ?',
        content: introBody
      };

      /* -------------------------------------
       *  CARTE "OÙ ?"
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
       * ------------------------------------- */
      const left: CoreBlock = {
        title: this.intro.title,
        html:  this.intro.content
      };

      const right: CoreBlock = {
        items: whereItems.length ? whereItems : undefined
      };

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
       *  BLOC DÉDIÉ “NOS VALEURS”
       * ------------------------------------- */
      this.coreValuesTitle = (about?.core_values?.section_title || 'Nos valeurs').trim();

      const rawValues = ['value_1','value_2','value_3']
        .map(k => (about?.core_values as any)?.[k])
        .filter(Boolean)
        .map(v => ({
          title: (v.title || '').trim(),
          html:  (v.description || '').trim(),
          icon:  v.icon as string | number | undefined,
        }));

      const resolveIconUrl = async (icon: string | number | undefined) => {
        if (!icon) return '';
        if (typeof icon === 'string') return icon;
        try {
          const url = await firstValueFrom(this.wp.getMediaUrl(icon));
          return url || '';
        } catch { return ''; }
      };

      const resolvedValues: ValueItem[] = [];
      for (const v of rawValues) {
        resolvedValues.push({
          title: v.title,
          html:  v.html,
          iconUrl: await resolveIconUrl(v.icon),
        });
      }
      this.coreValues = resolvedValues.filter(v => v.title || v.html || v.iconUrl);

      /* -------------------------------------
      *  TIMELINE (event_1..event_n)
      * ------------------------------------- */
      const tlRaw = about?.timeline ?? {};
      this.timelineTitle = tlRaw.section_title || 'Timeline du Groupe ABC';

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
       *  AFFILIATIONS
       * ------------------------------------- */
      const a = about?.affiliations ?? {};
      this.affTitle     = a.section_title || 'Appartenance';
      this.affPreamble  = '';

      const rawAffs: Array<{ logo: string | number | undefined; excerpt: string; content: string }> = [];
      for (let i = 1; i <= 5; i++) {
        const it = (a as any)[`association_${i}`];
        if (!it) continue;
        rawAffs.push({
          logo:    it.logo as string | number | undefined,
          excerpt: it.name || '',
          content: it.description || ''
        });
      }

      const resolveLogo = async (logo: string | number | undefined): Promise<string> => {
        if (!logo) return '';
        if (typeof logo === 'string') return logo;
        try {
          const url = await firstValueFrom(this.wp.getMediaUrl(logo));
          return url || '';
        } catch { return ''; }
      };

      const resolvedAffs: AffItem[] = [];
      for (const it of rawAffs) {
        resolvedAffs.push({
          logo: await resolveLogo(it.logo),
          excerpt: it.excerpt,
          content: it.content
        });
      }
      this.affiliations = resolvedAffs.filter(x => !!(x.logo || x.excerpt || x.content));
      this.affOpen = new Array(this.affiliations.length).fill(false);

      /* -------------------------------------
       *  DÉONTOLOGIE
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

      this.deonOpen = new Array(this.deontology.length).fill(false);

      /* -------------------------------------
       *  SEO
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

  /**
   * Accordéon : ouvre un index et ferme tous les autres.
   * - Si l'item cliqué était déjà ouvert -> tout ferme.
   */
  private setSingleOpen(stateArr: boolean[], index: number): void {
    const willOpen = !stateArr[index];
    // on ferme tout
    for (let i = 0; i < stateArr.length; i++) stateArr[i] = false;
    // on ouvre éventuellement celui cliqué
    if (willOpen) stateArr[index] = true;
  }

  /** Ouvre/ferme une ligne d'appartenance (chevron) en mode accordéon */
  toggleAff(i: number){ this.setSingleOpen(this.affOpen, i); }

  /** Ouvre/ferme une ligne de déontologie (chevron) en mode accordéon */
  toggleDeon(i: number){ this.setSingleOpen(this.deonOpen, i); }

  /** "RICS : Royal Institution..." -> { abbr:"RICS", label:"Royal Institution..." } */
  splitAffName(raw: string): { abbr: string; label: string }{
    const s = (raw || '').trim();
    const idx = s.indexOf(':');
    if (idx === -1) return { abbr: s, label: '' };
    return {
      abbr: s.slice(0, idx).trim(),
      label: s.slice(idx + 1).trim()
    };
  }

  /** Supprime les balises HTML et tronque pour la meta description */
  private strip(html: string, max = 160): string {
    const t = (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }
}
