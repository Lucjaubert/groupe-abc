import {
  Component, OnInit, AfterViewInit, OnDestroy,
  inject, ElementRef, ViewChild, ViewChildren, QueryList
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, firstValueFrom } from 'rxjs';
import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/* =========================
 *  Types
 * ========================= */
type Intro        = { title: string; content: string };
type CoreValue    = { title?: string; html?: string; icon?: string|number };
type CoreBlock    = { title?: string; html?: string; items?: string[] };
type TimelineStep = { year?: string; title?: string; html?: string };
type AffItem      = { logo?: string; excerpt?: string; content?: string };
type DeonItem     = { title?: string; html?: string };
type Mesh         = { title?: string; image?: string; levels: string[] };
type MapSection   = { title?: string; image?: string; items: string[] };
type ValueItem    = { title: string; html: string; iconUrl: string };

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
})
export class AboutComponent implements OnInit, AfterViewInit, OnDestroy {
  private wp  = inject(WordpressService);
  private seo = inject(SeoService);

  /* =========================
   *  State
   * ========================= */
  intro: Intro = { title: '', content: '' };
  core: CoreBlock[] = [];
  coreValuesTitle = '';
  coreValues: ValueItem[] = [];
  timeline: TimelineStep[] = [];
  timelineTitle = '';
  affTitle = '';
  affiliations: AffItem[] = [];
  affOpen: boolean[] = [];
  deonTitle = '';
  deontology: DeonItem[] = [];
  deonOpen: boolean[] = [];
  mesh?: Mesh;
  mapSection?: MapSection;

  /* =========================
   *  Refs pour animations
   * ========================= */
  // CORE
  @ViewChild('coreTitle') coreTitle!: ElementRef<HTMLElement>;
  @ViewChild('coreLeft') coreLeft!: ElementRef<HTMLElement>;
  @ViewChildren('whereItem') whereItems!: QueryList<ElementRef<HTMLElement>>;

  // MESH
  @ViewChild('meshTitleEl') meshTitleEl!: ElementRef<HTMLElement>;
  @ViewChild('meshSkylineEl') meshSkylineEl!: ElementRef<HTMLElement>;
  @ViewChild('meshLevelsEl') meshLevelsEl!: ElementRef<HTMLElement>;
  @ViewChildren('meshLevelEl') meshLevelEls!: QueryList<ElementRef<HTMLElement>>;

  // MAP
  @ViewChild('mapImageEl') mapImageEl!: ElementRef<HTMLElement>;
  @ViewChild('mapTitleEl') mapTitleEl!: ElementRef<HTMLElement>;
  @ViewChildren('mapItem') mapItems!: QueryList<ElementRef<HTMLElement>>;

  // VALUES
  @ViewChild('valuesTitleEl') valuesTitleEl!: ElementRef<HTMLElement>;
  @ViewChildren('valueItemEl') valueItemEls!: QueryList<ElementRef<HTMLElement>>;

  // AFFILIATIONS
  @ViewChild('affTitleEl') affTitleEl!: ElementRef<HTMLElement>;
  @ViewChildren('affRowEl') affRowEls!: QueryList<ElementRef<HTMLElement>>;

  // DEONTOLOGY
  @ViewChild('deonTitleEl') deonTitleEl!: ElementRef<HTMLElement>;
  @ViewChildren('deonRowEl') deonRowEls!: QueryList<ElementRef<HTMLElement>>;

  // TIMELINE
  @ViewChild('tlRail') tlRail!: ElementRef<HTMLElement>;
  @ViewChild('tlTitleEl') tlTitleEl!: ElementRef<HTMLElement>;
  @ViewChildren('tlYearEl') tlYearEls!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('tlBodyEl') tlBodyEls!: QueryList<ElementRef<HTMLElement>>;

  /* ========================= */
  /* Data loading              */
  /* ========================= */
  ngOnInit(): void {
    forkJoin({
      about: this.wp.getAboutData(),
      whereFromHome: this.wp.getHomepageIdentityWhereItems(),
    }).subscribe(async ({ about, whereFromHome }) => {
      /* Intro */
      const hero = about?.hero ?? {};
      const introBody: string = about?.intro_body || '';
      this.intro = { title: hero.section_title || 'Qui sommes-nous ?', content: introBody };

      /* Map “Où ?” */
      const mapSecRaw = about?.map_section ?? {};
      const whereFallback = [
        mapSecRaw.where_item_1, mapSecRaw.where_item_2, mapSecRaw.where_item_3, mapSecRaw.where_item_4,
        mapSecRaw.where_item_5, mapSecRaw.where_item_6, mapSecRaw.where_item_7, mapSecRaw.where_item_8
      ].filter(Boolean) as string[];
      const whereItems = (Array.isArray(whereFromHome) && whereFromHome.length) ? whereFromHome : whereFallback;

      this.mapSection = {
        title: mapSecRaw.where_title || 'Où ?',
        image: typeof mapSecRaw.map_image === 'string' ? mapSecRaw.map_image : '',
        items: whereItems
      };

      /* Core (gauche + droite) */
      this.core = [
        { title: this.intro.title, html: this.intro.content },
        { items: whereItems }
      ];

      /* Mesh */
      const meshRaw = about?.mesh ?? {};
      const meshLevels = [
        meshRaw.level_label_1, meshRaw.level_label_2, meshRaw.level_label_3
      ].filter(Boolean) as string[];
      const resolveMedia = async (idOrUrl: any) => {
        if (!idOrUrl) return '';
        if (typeof idOrUrl === 'string') return idOrUrl;
        try { return await firstValueFrom(this.wp.getMediaUrl(idOrUrl)) || ''; } catch { return ''; }
      };
      this.mesh = {
        title: (meshRaw.section_title || 'Un maillage à toutes les échelles de notre territoire').trim(),
        image: await resolveMedia(meshRaw.skyline_image),
        levels: meshLevels
      };

      /* Valeurs */
      const cv = about?.core_values ?? {};
      this.coreValuesTitle = cv.section_title || 'Nos valeurs';
      const rawVals = ['value_1','value_2','value_3']
        .map(k => (cv as any)[k]).filter(Boolean) as CoreValue[];
      const resolved: ValueItem[] = [];
      for (const v of rawVals) {
        const iconUrl = await resolveMedia(v.icon);
        resolved.push({ title: v.title || '', html: (v as any).description || v.html || '', iconUrl });
      }
      this.coreValues = resolved.filter(v => v.title || v.html || v.iconUrl);

      /* Affiliations */
      const a = about?.affiliations ?? {};
      this.affTitle = a.section_title || 'Appartenance';
      const rawAffs: AffItem[] = [];
      for (let i = 1; i <= 5; i++) {
        const it = (a as any)[`association_${i}`];
        if (!it) continue;
        rawAffs.push({
          logo: await resolveMedia(it.logo),
          excerpt: it.name || '',
          content: it.description || ''
        });
      }
      this.affiliations = rawAffs.filter(x => x.logo || x.excerpt || x.content);
      this.affOpen = new Array(this.affiliations.length).fill(false);

      /* Déontologie */
      const d = about?.deontology ?? {};
      this.deonTitle = d.deo_title || 'Déontologie';
      this.deontology = [1,2,3,4].map(i => {
        const di = (d as any)[`deo_${i}`];
        return di ? { title: di.title || '', html: di.deo_description || '' } : null;
      }).filter(Boolean) as DeonItem[];
      this.deonOpen = new Array(this.deontology.length).fill(false);

      /* Timeline */
      const tlRaw = about?.timeline ?? {};
      this.timelineTitle = tlRaw.section_title || 'Timeline du Groupe ABC';
      const events: TimelineStep[] = [];
      for (let i = 1; i <= 12; i++) {
        const ev = (tlRaw as any)[`event_${i}`];
        if (!ev) continue;
        const step: TimelineStep = { year: ev.year || '', title: ev.title || '', html: ev.description || '' };
        if (step.year || step.title || step.html) events.push(step);
      }
      this.timeline = events;

      /* SEO */
      this.seo.update({
        title: this.intro.title || 'Qui sommes-nous ? – Groupe ABC',
        description: this.strip(this.intro.content, 160),
        image: ''
      });

      /* Bind anims quand DOM prêt */
      this.scheduleBind();
    });
  }

  /* ========================= */
  /* Accordéons & utils        */
  /* ========================= */
  trackByIndex(i: number){ return i; }
  private setSingleOpen(arr: boolean[], i: number){
    const willOpen = !arr[i]; arr.fill(false); if (willOpen) arr[i] = true;
  }
  toggleAff(i: number){ this.setSingleOpen(this.affOpen, i); }
  toggleDeon(i: number){ this.setSingleOpen(this.deonOpen, i); }

  /** "RICS : Royal Institution..." -> { abbr:"RICS", label:"Royal Institution..." } */
  splitAffName(raw: string): { abbr: string; label: string }{
    const s = (raw || '').trim();
    const idx = s.indexOf(':');
    if (idx === -1) return { abbr: s, label: '' };
    return { abbr: s.slice(0, idx).trim(), label: s.slice(idx + 1).trim() };
  }

  /* ========================= */
  /* Animations (NEWS pattern) */
  /* ========================= */
  ngAfterViewInit(): void {
    gsap.registerPlugin(ScrollTrigger);
    // Re-binder si des listes changent
    this.whereItems?.changes?.subscribe(() => this.scheduleBind());
    this.meshLevelEls?.changes?.subscribe(() => this.scheduleBind());
    this.mapItems?.changes?.subscribe(() => this.scheduleBind());
    this.valueItemEls?.changes?.subscribe(() => this.scheduleBind());
    this.affRowEls?.changes?.subscribe(() => this.scheduleBind());
    this.deonRowEls?.changes?.subscribe(() => this.scheduleBind());
    this.tlYearEls?.changes?.subscribe(() => this.scheduleBind());
    this.tlBodyEls?.changes?.subscribe(() => this.scheduleBind());
    this.scheduleBind();
  }

  ngOnDestroy(): void {
    this.killAllScrollTriggers();
    try { this._ro?.disconnect(); } catch {}
    try { gsap.globalTimeline.clear(); } catch {}
  }

  private bindScheduled = false;
  private scheduleBind(){
    if (this.bindScheduled) return;
    this.bindScheduled = true;
    queueMicrotask(() => requestAnimationFrame(() => {
      this.bindScheduled = false;
      this.bindAnimations();
    }));
  }

  /** Force l’état initial (évite tout flash si la CSS charge après) */
  private forceInitialHidden(root: HTMLElement){
    const pre = Array.from(root.querySelectorAll<HTMLElement>('.prehide'));
    const rows = Array.from(root.querySelectorAll<HTMLElement>('.prehide-row'));
    if (pre.length)  gsap.set(pre,  { autoAlpha: 0, y: 20 });
    if (rows.length) gsap.set(rows, { autoAlpha: 0 });
  }

  private bindAnimations(): void {
    const host = (document.querySelector('.about-wrapper') as HTMLElement) || undefined;
    if (host) this.forceInitialHidden(host);

    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}
    const EASE = 'power3.out';

    /* ===== CORE ===== */
    const coreTitleEl = this.coreTitle?.nativeElement;
    const coreLeftHtml = this.coreLeft?.nativeElement?.querySelector('.block-html') as HTMLElement | null;
    const whereEls = (this.whereItems?.toArray() || []).map(r => r.nativeElement);
    const whereList = whereEls[0]?.parentElement as HTMLElement | null;

    if (coreTitleEl) {
      gsap.fromTo(coreTitleEl, { autoAlpha: 0, y: 20 }, {
        autoAlpha: 1, y: 0, duration: 0.6, ease: EASE,
        scrollTrigger: { trigger: coreTitleEl, start: 'top 85%', once: true }
      });
    }
    if (coreLeftHtml) {
      gsap.fromTo(coreLeftHtml, { autoAlpha: 0, y: 20 }, {
        autoAlpha: 1, y: 0, duration: 0.6, ease: EASE, delay: 0.05,
        scrollTrigger: { trigger: coreLeftHtml, start: 'top 85%', once: true }
      });
    }
    if (whereList && whereEls.length) {
      gsap.fromTo(whereEls, { autoAlpha: 0, y: 14 }, {
        autoAlpha: 1, y: 0, duration: 0.45, ease: EASE, stagger: 0.08,
        scrollTrigger: { trigger: whereList, start: 'top 90%', once: true }
      });
    }

    /* ===== MESH ===== */
    const meshTitle = this.meshTitleEl?.nativeElement;
    const skyline   = this.meshSkylineEl?.nativeElement;
    const meshLevels = this.meshLevelsEl?.nativeElement;
    const meshLevelItems = (this.meshLevelEls?.toArray() || []).map(r => r.nativeElement);

    if (meshTitle) {
      gsap.fromTo(meshTitle, { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1, y: 0, duration: 0.55, ease: EASE,
        scrollTrigger: { trigger: meshTitle, start: 'top 85%', once: true }
      });
    }
    if (skyline) {
      gsap.fromTo(skyline, { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1, y: 0, duration: 0.55, ease: EASE, delay: 0.05,
        scrollTrigger: { trigger: skyline, start: 'top 85%', once: true }
      });
    }
    if (meshLevels && meshLevelItems.length) {
      // Trait 2px qui s'étire + labels au fur et à mesure
      gsap.set(meshLevels, { '--lineW': '0%' });
      gsap.set(meshLevelItems, { autoAlpha: 0, y: 10 });

      const tl = gsap.timeline({
        defaults: { ease: 'power2.out' },
        scrollTrigger: { trigger: meshLevels, start: 'top 85%', once: true }
      });

      tl.to(meshLevels, { duration: 1.6, '--lineW': '100%' }, 0);

      // Apparition des trois labels quand le trait “passe” leur position
      const steps = [0.15, 0.85, 1.55];
      meshLevelItems.forEach((el, i) => {
        tl.to(el, { autoAlpha: 1, y: 0, duration: 0.45, ease: EASE }, steps[Math.min(i, steps.length - 1)]);
      });
    }

    /* ===== MAP ===== */
    const mapImg = this.mapImageEl?.nativeElement;
    const mapTitle = this.mapTitleEl?.nativeElement;
    const mapItemEls = (this.mapItems?.toArray() || []).map(r => r.nativeElement);
    const mapList = mapItemEls[0]?.parentElement as HTMLElement | null;

    if (mapImg) {
      gsap.fromTo(mapImg, { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1, y: 0, duration: 0.55, ease: EASE,
        scrollTrigger: { trigger: mapImg, start: 'top 85%', once: true }
      });
    }
    if (mapTitle) {
      gsap.fromTo(mapTitle, { autoAlpha: 0, y: 16 }, {
        autoAlpha: 1, y: 0, duration: 0.5, ease: EASE, delay: 0.05,
        scrollTrigger: { trigger: mapTitle, start: 'top 85%', once: true }
      });
    }
    if (mapList && mapItemEls.length) {
      gsap.fromTo(mapItemEls, { autoAlpha: 0, y: 14 }, {
        autoAlpha: 1, y: 0, duration: 0.45, ease: EASE, stagger: 0.08,
        scrollTrigger: { trigger: mapList, start: 'top 90%', once: true }
      });
    }

    /* ===== VALUES (icônes+traits → titres → textes, en 3 phases synchronisées) ===== */
    const valuesTitle = this.valuesTitleEl?.nativeElement;
    const valueItems  = (this.valueItemEls?.toArray() || []).map(r => r.nativeElement);
    const valuesGrid  = valueItems[0]?.parentElement as HTMLElement | null;

    // Titre seul
    if (valuesTitle) {
      gsap.fromTo(valuesTitle, { autoAlpha: 0, y: 16 }, {
        autoAlpha: 1, y: 0, duration: 0.5, ease: EASE,
        scrollTrigger: { trigger: valuesTitle, start: 'top 85%', once: true }
      });
    }

    // Grille : 3 phases
    if (valuesGrid && valueItems.length) {
      const icons: HTMLElement[]    = [];
      const titles: HTMLElement[]   = [];
      const descs: HTMLElement[]    = [];
      const dividers: HTMLElement[] = [];

      valueItems.forEach(li => {
        li.classList.remove('prehide');
        gsap.set(li, { autoAlpha: 1, clearProps: 'visibility' });

        const icon    = li.querySelector<HTMLElement>('.icon-wrap img');
        const title   = li.querySelector<HTMLElement>('.value-name');
        const desc    = li.querySelector<HTMLElement>('.value-desc');
        const divider = li.querySelector<HTMLElement>('.divider');

        if (icon)   { icons.push(icon);   gsap.set(icon,   { autoAlpha: 0, y: 8,  scale: 0.98, willChange: 'transform,opacity' }); }
        if (title)  { titles.push(title); gsap.set(title,  { autoAlpha: 0, y: 14, willChange: 'transform,opacity' }); }
        if (desc)   { descs.push(desc);   gsap.set(desc,   { autoAlpha: 0, y: 14, willChange: 'transform,opacity' }); }
        if (divider){ dividers.push(divider); gsap.set(divider, { scaleX: 0, transformOrigin: '50% 50%' }); }
      });

      const D = 0.7; // ~0.7s par phase (total ~2.1s)

      const tl = gsap.timeline({
        defaults: { ease: EASE },
        scrollTrigger: { trigger: valuesGrid, start: 'top 85%', once: true }
      });

      // Phase 1 : icônes + traits en même temps
      tl.add('phase1')
        .to(icons,    { autoAlpha: 1, y: 0, scale: 1, duration: D }, 'phase1')
        .to(dividers, { scaleX: 1,                duration: D }, 'phase1');

      // Phase 2 : titres en même temps
      tl.add('phase2')
        .to(titles, { autoAlpha: 1, y: 0, duration: D }, 'phase2');

      // Phase 3 : textes en même temps
      tl.add('phase3')
        .to(descs, { autoAlpha: 1, y: 0, duration: D }, 'phase3');

      // Nettoyage
      tl.add(() => {
        const toClear = [...icons, ...titles, ...descs];
        gsap.set(toClear, { clearProps: 'transform,opacity,willChange' });
        gsap.set(dividers, { clearProps: 'transform' });
      });
    }

    /* ===== AFFILIATIONS : titre puis tableau (au scroll) ===== */
    {
      const affTitle = this.affTitleEl?.nativeElement;
      const affRows  = (this.affRowEls?.toArray() || []).map(r => r.nativeElement);
      const affSection = affTitle?.closest('.affiliations') as HTMLElement | null;

      // Pré-cachage
      if (affTitle) gsap.set(affTitle, { autoAlpha: 0, y: 16 });
      if (affRows.length) gsap.set(affRows, { autoAlpha: 0, y: 16 });

      if (affSection && affTitle && affRows.length) {
        gsap.timeline({
          defaults: { ease: EASE },
          scrollTrigger: { trigger: affSection, start: 'top 85%', once: true }
        })
        .to(affTitle, { autoAlpha: 1, y: 0, duration: 3.5 }, 0)
        .to(affRows,  { autoAlpha: 1, y: 0, duration: 3.5 }, 0.35);
      }
    }

    /* ===== DÉONTOLOGIE : titre puis tableau (au scroll) ===== */
    {
      const deonTitle  = this.deonTitleEl?.nativeElement;
      const deonRows   = (this.deonRowEls?.toArray() || []).map(r => r.nativeElement);
      const deonSection = deonTitle?.closest('.deon') as HTMLElement | null;

      // Pré-cachage
      if (deonTitle) gsap.set(deonTitle, { autoAlpha: 0, y: 16 });
      if (deonRows.length) gsap.set(deonRows, { autoAlpha: 0, y: 16 });

      if (deonSection && deonTitle && deonRows.length) {
        gsap.timeline({
          defaults: { ease: EASE },
          scrollTrigger: { trigger: deonSection, start: 'top 85%', once: true }
        })
        .to(deonTitle, { autoAlpha: 1, y: 0, duration: 3.5 }, 0)
        .to(deonRows,  { autoAlpha: 1, y: 0, duration: 3.5 }, 0.35);
      }
    }

    /* ===== TIMELINE ===== */
    // Hypothèses : gsap et ScrollTrigger déjà importés/registrés, EASE défini.
    const tlTitleEl = this.tlTitleEl?.nativeElement as HTMLElement | undefined;
    const tlRailEl  = this.tlRail?.nativeElement  as HTMLElement | undefined;
    const tlYears   = (this.tlYearEls?.toArray() || []).map(r => r.nativeElement as HTMLElement);
    const tlBodies  = (this.tlBodyEls?.toArray() || []).map(r => r.nativeElement as HTMLElement);

    // Titre
    if (tlTitleEl) {
      gsap.fromTo(tlTitleEl, { autoAlpha: 0, y: 16 }, {
        autoAlpha: 1, y: 0, duration: 0.5, ease: EASE,
        scrollTrigger: { trigger: tlTitleEl, start: 'top 85%', once: true }
      });
    }

    if (tlRailEl && tlYears.length && tlBodies.length) {
      const timelineSection = tlRailEl.closest('.timeline') as HTMLElement | null;
      const tlGrid          = tlRailEl.closest('.tl-grid') as HTMLElement | null;

      // États init : années/corps masqués + trait rouge replié
      tlYears.forEach(y => {
        (y as any).__revealed = false;
        gsap.set(y, { autoAlpha: 0, y: 10 });
        y.style.setProperty('--dashNow', '0px');
      });
      tlBodies.forEach(b => gsap.set(b, { autoAlpha: 0, y: 10 }));

      let railHeight = 0;
      let checkpoints: number[] = [];

      const computeLayout = () => {
        const railBox = tlRailEl.getBoundingClientRect();
        railHeight = railBox.height;

        checkpoints = tlYears.map((yEl) => {
          const yBox = yEl.getBoundingClientRect();

          // Position EXACTE du petit tiret rouge : top + 0.6em
          const fs = parseFloat(getComputedStyle(yEl).fontSize) || 16;
          const dashOffset = 0.6 * fs; // correspond à .tl-year::after { top: .6em; }

          // Position absolue (viewport) de l’intersection horizontale
          const cutYAbs = yBox.top + dashOffset;

          // Convertir en relatif à la rail top
          const cutYRel = cutYAbs - railBox.top;

          // Clamp pour éviter débordements
          return Math.max(0, Math.min(railHeight, cutYRel));
        });
      };

      computeLayout();

      ScrollTrigger.create({
        trigger: timelineSection || tlGrid || tlRailEl,
        start: 'top 70%',
        end: 'bottom 30%',
        scrub: 0.6,
        onUpdate: (self) => {
          const p = self.progress;
          const drawPx = railHeight * p;

          // Dessin du rail
          gsap.set(tlRailEl, { scaleY: p, transformOrigin: 'top' });

          // Révélations synchronisées à l’INTERSECTION précise
          for (let i = 0; i < Math.min(tlYears.length, tlBodies.length); i++) {
            const yEl = tlYears[i];
            const bEl = tlBodies[i];
            if ((yEl as any).__revealed) continue;

            if (drawPx >= (checkpoints[i] || 0)) {
              (yEl as any).__revealed = true;

              // Tiret rouge + apparition année/texte
              gsap.to(yEl, {
                autoAlpha: 1, y: 0, duration: 0.45, ease: EASE,
                onStart: () => yEl.style.setProperty('--dashNow', 'var(--dash-w)')
              });
              gsap.to(bEl, { autoAlpha: 1, y: 0, duration: 0.45, ease: EASE, delay: 0.08 });
            }
          }
        },
        onRefreshInit: () => {
          computeLayout();
          // Reset visuel au refresh pour éviter un flash
          gsap.set(tlRailEl, { scaleY: 0, transformOrigin: 'top' });
          tlYears.forEach((y) => {
            (y as any).__revealed = false;
            gsap.set(y, { autoAlpha: 0, y: 10 });
            y.style.setProperty('--dashNow', '0px');
          });
          tlBodies.forEach((b) => gsap.set(b, { autoAlpha: 0, y: 10 }));
        }
      });

      // Sécurité : re-mesure si images/iframed contenus se chargent après coup
      const ro = this.getResizeObserver(() => {
        computeLayout();
        try { ScrollTrigger.refresh(); } catch {}
      });
      if (ro) ro.observe(tlGrid || tlRailEl);
    }

    try { ScrollTrigger.refresh(); } catch {}
  }

  /* ========================= */
  /* Utils                     */
  /* ========================= */

  /** Vrai si on est côté navigateur (SSR safe) */
  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  /** Clamp numérique simple */
  private clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
  }

  /** Throttle via requestAnimationFrame (utile si tu bindes des handlers scroll/resize maison) */
  private rafThrottle<T extends (...args: any[]) => void>(fn: T): T {
    let ticking = false;
    let lastArgs: any[] = [];
    return ((...args: any[]) => {
      lastArgs = args;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          fn(...lastArgs);
        });
      }
    }) as T;
  }

  /** Respecte le prefers-reduced-motion : à utiliser si tu veux court-circuiter certaines anims */
  private prefersReducedMotion(): boolean {
    if (!this.isBrowser()) return false;
    try {
      return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    } catch {
      return false;
    }
  }

  /** ResizeObserver safe (unique instance) */
  private _ro?: ResizeObserver;
  private getResizeObserver(cb: ResizeObserverCallback): ResizeObserver | null {
    if (!this.isBrowser() || !('ResizeObserver' in window)) return null;
    if (!this._ro) this._ro = new ResizeObserver(cb);
    return this._ro;
  }

  /** Kill propre des ScrollTriggers (utile si tu navigues entre routes Angular) */
  private killAllScrollTriggers(): void {
    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}
  }

  /** Strip HTML → texte (pour extraits) */
  private strip(html: string, max = 160): string {
    const t = (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }
}
