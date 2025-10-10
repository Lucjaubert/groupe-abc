// src/app/pages/about/about.component.ts
import {
  Component, OnInit, AfterViewInit, OnDestroy,
  inject, ElementRef, ViewChild, ViewChildren, QueryList, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { forkJoin, firstValueFrom } from 'rxjs';
import { WordpressService, PartnerCard } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ImgFastDirective } from '../../directives/img-fast.directive';

/* =========================
 *  Types locaux
 * ========================= */
type Intro        = { title: string; content: string };
type CoreValue    = { title?: string; html?: string; icon?: string|number };
type CoreBlock    = { title?: string; html?: string; items?: string[] };
type TimelineStep = { year?: string; title?: string; html?: string };
type AffItem      = { logo?: string; excerpt?: string; content?: string };
type DeonItem     = { title?: string; html?: string; file?: string | null };
type Mesh         = { title?: string; image?: string; levels: string[] };
type MapSection   = { title?: string; image?: string; items: string[] };
type ValueItem    = { title: string; html: string; iconUrl: string };

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterModule, ImgFastDirective],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
})
export class AboutComponent implements OnInit, AfterViewInit, OnDestroy {
  private wp  = inject(WordpressService);
  private seo = inject(SeoService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  coreReady = false;

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

  /** Carrousel partenaires (instantané) */
  activePartner?: PartnerCard;
  currentPhotoUrl = '';
  allPartners: PartnerCard[] = [];
  private partnerIndex = 0;
  private autoMs = 4000;
  private autoTimer: any;
  private coreGridTrigger?: ScrollTrigger;

  // Cache & mémo des résolutions d’images
  private partnerPhotoCache = new WeakMap<PartnerCard, string>();
  private partnerPhotoInFlight = new WeakMap<PartnerCard, Promise<string>>();

  /** Fallbacks */
  defaultPortrait = '/assets/fallbacks/portrait-placeholder.svg';

  get hasMultiplePartners(): boolean { return this.allPartners.length > 1; }

  /* =========================
   *  Refs pour animations
   * ========================= */
  @ViewChild('coreTitle') coreTitle!: ElementRef<HTMLElement>;
  @ViewChild('coreLeft') coreLeft!: ElementRef<HTMLElement>;
  @ViewChild('coreGrid') coreGrid!: ElementRef<HTMLElement>;
  @ViewChild('coreRight') coreRight!: ElementRef<HTMLElement>;
  @ViewChildren('whereItem') whereItems!: QueryList<ElementRef<HTMLElement>>;

  @ViewChild('meshTitleEl')  meshTitleEl!: ElementRef<HTMLElement>;
  @ViewChild('meshSkylineEl') meshSkylineEl!: ElementRef<HTMLElement>;
  @ViewChild('meshLevelsEl') meshLevelsEl!: ElementRef<HTMLElement>;
  @ViewChildren('meshLevelEl') meshLevelEls!: QueryList<ElementRef<HTMLElement>>;

  @ViewChild('mapImageEl') mapImageEl!: ElementRef<HTMLElement>;
  @ViewChild('mapTitleEl') mapTitleEl!: ElementRef<HTMLElement>;
  @ViewChildren('mapItem') mapItems!: QueryList<ElementRef<HTMLElement>>;

  @ViewChild('valuesTitleEl') valuesTitleEl!: ElementRef<HTMLElement>;
  @ViewChildren('valueItemEl') valueItemEls!: QueryList<ElementRef<HTMLElement>>;

  @ViewChild('affTitleEl') affTitleEl!: ElementRef<HTMLElement>;
  @ViewChildren('affRowEl') affRowEls!: QueryList<ElementRef<HTMLElement>>;

  @ViewChild('deonTitleEl') deonTitleEl!: ElementRef<HTMLElement>;
  @ViewChildren('deonRowEl') deonRowEls!: QueryList<ElementRef<HTMLElement>>;

  @ViewChild('tlRail') tlRail!: ElementRef<HTMLElement>;
  @ViewChild('tlTitleEl') tlTitleEl!: ElementRef<HTMLElement>;
  @ViewChildren('tlYearEl') tlYearEls!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('tlBodyEl') tlBodyEls!: QueryList<ElementRef<HTMLElement>>;

  private hoverCleanup: Array<() => void> = [];

  private shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ============ ROUTES / MAP → TEAM (même logique Homepage) ============ */
  // Adapte si ton slug FR est différent (ex. '/nos-equipes').
  private TEAM_ROUTE_FR = '/nos-equipes';
  private TEAM_ROUTE_EN = '/en/team';

  isEnglish(): boolean { // public
    try { return (window?.location?.pathname || '/').startsWith('/en'); }
    catch { return false; }
  }

  /** minuscules, sans accents, espaces normalisés */
  private norm(s: string): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Label lisible → clé courte (?region=key) */
  private regionKeyFromLabel(label: string): string {
    const n = this.norm(label);
    if (n.includes('paris') || n.includes('ile-de-france') || n.includes('ile de france')) return 'idf';
    if (n.includes('grand ouest'))                          return 'grand-ouest';
    if (n.includes('rhone') || n.includes('auvergne'))      return 'rhone-alpes';
    if (n.includes('cote d\'azur') || n.includes('cote d azur') || n.includes('cote-d-azur') || n.includes('sud-est')) return 'cote-azur';
    if (n.includes('sud-ouest') || n.includes('sud ouest')) return 'sud-ouest';
    if (n.includes('grand est') || n.includes('nord & est') || n.includes('nord et est') || n.includes('nord-est') || n.includes('nord est')) return 'grand-est';
    if (n.includes('antilles') || n.includes('guyane'))     return 'antilles-guyane';
    if (n.includes('reunion') || n.includes('mayotte'))     return 'reunion-mayotte';
    // fallback slug
    return n.replace(/[^a-z0-9- ]/g,'').replace(/\s+/g,'-');
  }

  /** Click → navigate vers Team avec ?region=... */
  openRegion(label: string): void {
    const key = this.regionKeyFromLabel(label);
    const path = this.isEnglish() ? this.TEAM_ROUTE_EN : this.TEAM_ROUTE_FR;
    this.router.navigate([path], { queryParams: { region: key } });
  }

  /** Accessibilité clavier sur li (Enter / Space) */
  openRegionOnKey(evt: KeyboardEvent, label: string): void {
    const k = evt.key?.toLowerCase();
    if (k === 'enter' || k === ' ' || k === 'spacebar') {
      evt.preventDefault();
      this.openRegion(label);
    }
  }

  /* ========================= */
  /* Data loading              */
  /* ========================= */
  ngOnInit(): void {
    forkJoin({
      about: this.wp.getAboutData(),
      whereFromHome: this.wp.getHomepageIdentityWhereItems(),
      teamPartners: this.wp.getTeamPartners(),
    }).subscribe(async ({ about, whereFromHome, teamPartners }) => {
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
      const resolveMediaInline = async (idOrUrl: any) => {
        if (!idOrUrl) return '';
        if (typeof idOrUrl === 'string') return idOrUrl;
        try { return await firstValueFrom(this.wp.getMediaUrl(idOrUrl)) || ''; } catch { return ''; }
      };
      this.mesh = {
        title: (meshRaw.section_title || 'Un maillage à toutes les échelles de notre territoire').trim(),
        image: await resolveMediaInline(meshRaw.skyline_image),
        levels: meshLevels
      };

      /* Valeurs */
      const cv = about?.core_values ?? {};
      this.coreValuesTitle = cv.section_title || 'Nos valeurs';
      const rawVals = ['value_1','value_2','value_3']
        .map(k => (cv as any)[k]).filter(Boolean) as CoreValue[];
      const resolved: ValueItem[] = [];
      for (const v of rawVals) {
        const iconUrl = await resolveMediaInline(v.icon);
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
          logo: await resolveMediaInline(it.logo),
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
        if (!di) return null;

        // Champ fichier : différentes clés possibles
        const rawFile =
          di['deo-doc-download'] ??
          di['deo_doc_download'] ??
          di.deoDocDownload ??
          null;

        const file = (typeof rawFile === 'string' && rawFile.trim()) ? rawFile.trim() : null;

        return {
          title: di.title || '',
          html: di.deo_description || '',
          file
        } as DeonItem;
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

      /* ===== PARTENAIRES ===== */
      this.allPartners = Array.isArray(teamPartners) ? this.shuffle(teamPartners) : [];
      const startOn = Math.floor(Math.random() * Math.max(1, this.allPartners.length));
      this.setActivePartnerInstant(startOn);
      this.primeAllPartnerPhotos();
      this.startAutoRotate();

      /* ===== SEO ===== */
      this.applySeo();

      /* Bind anims */
      this.scheduleBind();
    });
  }

  /* ===== Helpers SEO ===== */
  private stripHtml(raw: string): string {
    return (raw || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  private applySeo(): void {
    const baseTitle = this.intro?.title?.trim() || 'Qui sommes-nous ?';
    const desc = this.stripHtml(this.intro?.content || '').slice(0, 160);
    try { (this.seo as any).setTags?.({ title: baseTitle, description: desc, ogTitle: baseTitle, ogDescription: desc, ogType: 'website' }); } catch {}
    try { (this.seo as any).setTitle?.(baseTitle); } catch {}
    try { (this.seo as any).setDescription?.(desc); } catch {}
    try { (this.seo as any).update?.({ title: baseTitle, description: desc }); } catch {}
    void this.seo;
  }

  /* ========================= */
  /* Résolution image (équiv. pipe) pour le portrait partner */
  /* ========================= */

  private async resolveImgUrl(input: any, size: string = 'large'): Promise<string> {
    if (!input) return '';

    if (typeof input === 'string') {
      const s = input.trim();
      if (!s) return '';
      if (/^\d+$/.test(s)) {
        try { return (await firstValueFrom(this.wp.getMediaUrl(+s))) || ''; } catch { return ''; }
      }
      return s;
    }

    if (typeof input === 'number') {
      try { return (await firstValueFrom(this.wp.getMediaUrl(input))) || ''; } catch { return ''; }
    }

    if (typeof input === 'object') {
      const sized = input?.media_details?.sizes?.[size]?.source_url;
      if (sized) return sized;
      const direct = input?.source_url || input?.url;
      if (direct) return direct;
      const id = input?.id ?? input?.ID;
      if (typeof id === 'number') {
        try { return (await firstValueFrom(this.wp.getMediaUrl(id))) || ''; } catch { return ''; }
      }
    }

    return '';
  }

  private async resolveMedia(idOrUrl: any): Promise<string> {
    if (!idOrUrl) return '';
    if (typeof idOrUrl === 'object') {
      const src = idOrUrl?.source_url || idOrUrl?.url || '';
      if (src) return src;
      if (idOrUrl?.id != null) idOrUrl = idOrUrl.id;
    }
    if (typeof idOrUrl === 'number') {
      try { return (await firstValueFrom(this.wp.getMediaUrl(idOrUrl))) || ''; }
      catch { return ''; }
    }
    if (typeof idOrUrl === 'string') {
      const s = idOrUrl.trim();
      if (/^\d+$/.test(s)) {
        try { return (await firstValueFrom(this.wp.getMediaUrl(+s))) || ''; }
        catch { return ''; }
      }
      if (/^(https?:)?\/\//.test(s) || s.startsWith('/') || s.startsWith('data:')) return s;
      return s;
    }
    return '';
  }

  private preload(src: string): Promise<void> {
    if (!src) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = src;
    });
  }

  /* ========================= */
  /* Carrousel partenaires     */
  /* ========================= */

  private cachedPhotoUrl(p?: PartnerCard): string {
    return (p && this.partnerPhotoCache.get(p)) || '';
  }

  private ensurePartnerReady(p: PartnerCard): Promise<string> {
    if (!p) return Promise.resolve(this.defaultPortrait);

    const cached = this.partnerPhotoCache.get(p);
    if (cached) return Promise.resolve(cached);

    const inflight = this.partnerPhotoInFlight.get(p);
    if (inflight) return inflight;

    const promise = (async () => {
      const url = await this.resolveImgUrl((p as any).photo, 'large');
      const finalUrl = url || this.defaultPortrait;
      await this.preload(finalUrl);
      this.partnerPhotoCache.set(p, finalUrl);
      this.partnerPhotoInFlight.delete(p);
      return finalUrl;
    })();

    this.partnerPhotoInFlight.set(p, promise);
    return promise;
  }

  private primeAllPartnerPhotos(): void {
    if (!Array.isArray(this.allPartners) || this.allPartners.length <= 1) return;
    this.allPartners.forEach(p => { void this.ensurePartnerReady(p); });
  }

  /** Active une carte sans bloquer l’UI : placeholder immédiat puis swap */
  private setActivePartnerInstant(i: number): void {
    if (!this.allPartners.length) {
      this.activePartner = undefined;
      this.currentPhotoUrl = this.defaultPortrait;
      this.cdr.markForCheck();
      return;
    }

    this.partnerIndex = (i + this.allPartners.length) % this.allPartners.length;
    const next = this.allPartners[this.partnerIndex];

    this.activePartner = next;

    const cached = this.cachedPhotoUrl(next);
    this.currentPhotoUrl = cached || this.defaultPortrait;
    this.cdr.markForCheck();

    if (!cached) {
      this.ensurePartnerReady(next).then((url) => {
        if (this.activePartner === next) {
          this.currentPhotoUrl = url || this.defaultPortrait;
          this.cdr.markForCheck();
        }
      });
    }
  }

  nextPartner(){ this.setActivePartnerInstant(this.partnerIndex + 1); }
  prevPartner(){ this.setActivePartnerInstant(this.partnerIndex - 1); }

  startAutoRotate() {
    this.stopAutoRotate();
    if (this.allPartners.length <= 1) return;
    this.autoTimer = setInterval(() => this.nextPartner(), this.autoMs);
  }
  stopAutoRotate() {
    if (this.autoTimer) { clearInterval(this.autoTimer); this.autoTimer = null; }
  }

  onImgError(e: Event) {
    const img = e.target as HTMLImageElement;
    if (img && !img.src.endsWith('portrait-placeholder.svg')) {
      img.src = this.defaultPortrait;
    }
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

  splitAffName(raw: string): { abbr: string; label: string }{
    const s = (raw || '').trim();
    const idx = s.indexOf(':');
    if (idx === -1) return { abbr: s, label: '' };
    return { abbr: s.slice(0, idx).trim(), label: s.slice(idx + 1).trim() };
  }

  private prefersReducedMotion(): boolean {
    try { return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false; }
    catch { return false; }
  }

  /* ===== Helpers pour l’icône de téléchargement ===== */
  isSameOrigin(url: string): boolean {
    try {
      const u = new URL(url, window.location.origin);
      return u.origin === window.location.origin;
    } catch { return false; }
  }

  safeDownloadName(url: string): string {
    try {
      const u = new URL(url, window.location.origin);
      const name = u.pathname.split('/').pop() || 'document.pdf';
      return name.replace(/[^\w.\-()\[\] ]+/g, '_');
    } catch {
      return 'document.pdf';
    }
  }

  /* ===== Hover zoom (GSAP) ===== */
  private clearHoverBindings(){
    this.hoverCleanup.forEach(fn => { try { fn(); } catch {} });
    this.hoverCleanup = [];
  }

  private attachHoverZoom(
    elements: HTMLElement[] | undefined,
    originLeft = true,
    scale = 1.045
  ){
    if (!elements || !elements.length || this.prefersReducedMotion()) return;

    elements.forEach(el => {
      if (!el) return;
      el.style.transformOrigin = originLeft ? 'left center' : 'center center';
      el.style.willChange = 'transform';

      const enter = () => gsap.to(el, { scale, duration: 0.18, ease: 'power3.out' });
      const leave = () => gsap.to(el, { scale: 1,  duration: 0.22, ease: 'power2.out' });

      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseleave', leave);
      el.addEventListener('focus', enter, true);
      el.addEventListener('blur', leave, true);

      this.hoverCleanup.push(() => {
        el.removeEventListener('mouseenter', enter);
        el.removeEventListener('mouseleave', leave);
        el.removeEventListener('focus', enter, true);
        el.removeEventListener('blur', leave, true);
        gsap.set(el, { clearProps: 'transform' });
      });
    });
  }

  /* ========================= */
  /* Animations (NEWS pattern) */
  /* ========================= */

  private revealed = new WeakSet<HTMLElement>();

  private showInstant(el?: HTMLElement | null) {
    if (!el) return;
    el.classList.remove('prehide', 'prehide-row');
    gsap.set(el, { autoAlpha: 1, y: 0, clearProps: 'transform,opacity,visibility,willChange' });
    this.revealed.add(el);
  }

  private revealOnce(
    el: HTMLElement,
    build: (triggerEl: HTMLElement) => gsap.core.Tween | gsap.core.Timeline
  ) {
    if (!el) return;
    if (this.revealed.has(el)) { this.showInstant(el); return; }
    const tween = build(el);
    tween.eventCallback('onStart', () => el.classList.remove('prehide'));
    tween.eventCallback('onComplete', () => {
      this.revealed.add(el);
      gsap.set(el, { clearProps: 'transform,opacity,visibility,willChange' });
    });
  }

  ngAfterViewInit(): void {
    gsap.registerPlugin(ScrollTrigger);
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
    try { (this as any)._ro?.disconnect(); } catch {}
    try { gsap.globalTimeline.clear(); } catch {}
    try { this.coreGridTrigger?.kill(); } catch {}
    this.clearHoverBindings();
    this.stopAutoRotate();
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

  private bindAnimations(): void {
    const EASE = 'power3.out';
    const rm = (el?: Element | null, cls = 'prehide') => el && (el as HTMLElement).classList?.remove(cls as string);

    /* ===== CORE : H3 → (fin + 1s) → CoreGrid ===== */
    const coreTitleEl = this.coreTitle?.nativeElement as HTMLElement | undefined;
    const coreGridEl  = this.coreGrid?.nativeElement  as HTMLElement | undefined;

    if (coreTitleEl && coreGridEl && !this.revealed.has(coreTitleEl) && !this.revealed.has(coreGridEl)) {
      const H3_DUR = 0.45;
      const GAP_AFTER_H3 = 1.00;

      const launchGrid = () => {
        if (this.revealed.has(coreGridEl)) return;
        coreGridEl.classList.remove('prehide');
        gsap.fromTo(coreGridEl, { autoAlpha: 0, y: 20 }, {
          autoAlpha: 1, y: 0, duration: 0.5, ease: EASE,
          onComplete: () => {
            this.revealed.add(coreGridEl);
            gsap.set(coreGridEl, { clearProps: 'transform,opacity,visibility,willChange' });
          }
        });
      };

      const tlCore = gsap.timeline({
        defaults: { ease: EASE },
        scrollTrigger: { trigger: coreTitleEl, start: 'top 85%', once: true }
      });

      tlCore.add(() => { coreTitleEl.classList.remove('prehide'); }, 0);
      tlCore.fromTo(coreTitleEl, { autoAlpha: 0, y: 20 }, {
        autoAlpha: 1, y: 0, duration: H3_DUR,
        onComplete: () => { this.revealed.add(coreTitleEl); }
      }, 0);

      tlCore.add(launchGrid, `>+=${GAP_AFTER_H3}`);
    }

    /* ===== LISTE “Où ?” dans Core ===== */
    const whereEls: HTMLElement[] = (this.whereItems?.toArray() || []).map((r: ElementRef<HTMLElement>) => r.nativeElement);
    const whereList = (whereEls[0]?.parentElement ?? null) as HTMLElement | null;

    if (whereList && whereEls.length) {
      const allRevealed = whereEls.every((el) => this.revealed.has(el));
      if (allRevealed) {
        whereEls.forEach((el) => this.showInstant(el));
      } else {
        gsap.fromTo(whereEls, { autoAlpha: 0, y: 14 }, {
          autoAlpha: 1, y: 0, duration: 0.45, ease: EASE, stagger: 0.08,
          scrollTrigger: { trigger: whereList, start: 'top 90%', once: true },
          onStart: () => whereEls.forEach(el => el.classList.remove('prehide-row')),
          onComplete: () => { whereEls.forEach(el => this.revealed.add(el)); }
        });
      }
    }

    /* ===== MESH ===== */
    const meshTitle = this.meshTitleEl?.nativeElement;
    const skyline   = this.meshSkylineEl?.nativeElement;
    const meshLevels = this.meshLevelsEl?.nativeElement;
    const meshLevelItems: HTMLElement[] = (this.meshLevelEls?.toArray() || []).map((r: ElementRef<HTMLElement>) => r.nativeElement);

    if (meshTitle) {
      gsap.fromTo(meshTitle, { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1, y: 0, duration: 0.55, ease: EASE,
        scrollTrigger: { trigger: meshTitle, start: 'top 85%', once: true },
        onStart: () => rm(meshTitle, 'prehide')
      });
    }
    if (skyline) {
      gsap.fromTo(skyline, { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1, y: 0, duration: 0.55, ease: EASE, delay: 0.05,
        scrollTrigger: { trigger: skyline, start: 'top 75%', once: true },
        onStart: () => rm(skyline, 'prehide')
      });
    }
    if (meshLevels && meshLevelItems.length) {
      gsap.set(meshLevels, { '--lineW': '0%' } as any);
      gsap.set(meshLevelItems, { autoAlpha: 0, y: 10 });

      const tl = gsap.timeline({
        defaults: { ease: 'power2.out' },
        scrollTrigger: { trigger: meshLevels, start: 'top 85%', once: true },
        onStart: () => {
          rm(meshLevels, 'prehide');
          meshLevelItems.forEach(el => rm(el, 'prehide'));
        }
      });

      tl.to(meshLevels, { duration: 1.6, '--lineW': '100%' } as any, 0);

      const steps = [0.15, 0.85, 1.55];
      meshLevelItems.forEach((el, i) => {
        tl.to(el, { autoAlpha: 1, y: 0, duration: 0.45, ease: EASE }, steps[Math.min(i, steps.length - 1)]);
      });
    }

    /* ===== MAP ===== */
    const mapImgWrap = this.mapImageEl?.nativeElement;
    const mapTitle = this.mapTitleEl?.nativeElement;
    const mapItemEls: HTMLElement[] = (this.mapItems?.toArray() || []).map((r: ElementRef<HTMLElement>) => r.nativeElement);
    const mapList = (mapItemEls[0]?.parentElement ?? null) as HTMLElement | null;

    if (mapImgWrap) {
      gsap.fromTo(mapImgWrap, { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1, y: 0, duration: 0.55, ease: EASE,
        scrollTrigger: { trigger: mapImgWrap, start: 'top 85%', once: true },
        onStart: () => rm(mapImgWrap, 'prehide')
      });
    }
    if (mapTitle) {
      gsap.fromTo(mapTitle, { autoAlpha: 0, y: 16 }, {
        autoAlpha: 1, y: 0, duration: 0.5, ease: EASE, delay: 0.05,
        scrollTrigger: { trigger: mapTitle, start: 'top 85%', once: true },
        onStart: () => rm(mapTitle, 'prehide')
      });
    }
    if (mapList && mapItemEls.length) {
      gsap.fromTo(mapItemEls, { autoAlpha: 0, y: 14 }, {
        autoAlpha: 1, y: 0, duration: 0.45, ease: EASE, stagger: 0.08,
        scrollTrigger: { trigger: mapList, start: 'top 90%', once: true },
        onStart: () => mapItemEls.forEach(el => el.classList.remove('prehide-row'))
      });
    }

    /* ===== VALUES ===== */
    const valuesTitle = this.valuesTitleEl?.nativeElement;
    const valueItems: HTMLElement[]  = (this.valueItemEls?.toArray() || []).map((r: ElementRef<HTMLElement>) => r.nativeElement);
    const valuesGrid  = (valueItems[0]?.parentElement ?? null) as HTMLElement | null;

    if (valuesTitle) {
      gsap.fromTo(valuesTitle, { autoAlpha: 0, y: 16 }, {
        autoAlpha: 1, y: 0, duration: 0.5, ease: EASE,
        scrollTrigger: { trigger: valuesTitle, start: 'top 85%', once: true },
        onStart: () => rm(valuesTitle, 'prehide')
      });
    }

    if (valuesGrid && valueItems.length) {
      const icons: HTMLElement[]    = [];
      const titles: HTMLElement[]   = [];
      const descs: HTMLElement[]    = [];
      const dividers: HTMLElement[] = [];

      valueItems.forEach((li: HTMLElement) => {
        li.classList.remove('prehide');
        gsap.set(li, { autoAlpha: 1, clearProps: 'visibility' });

        const icon    = li.querySelector('.icon-wrap img') as HTMLElement | null;
        const title   = li.querySelector('.value-name') as HTMLElement | null;
        const desc    = li.querySelector('.value-desc') as HTMLElement | null;
        const divider = li.querySelector('.divider') as HTMLElement | null;

        if (icon)   { icons.push(icon);   gsap.set(icon,   { autoAlpha: 0, y: 8,  scale: 0.98, willChange: 'transform,opacity' }); }
        if (title)  { titles.push(title); gsap.set(title,  { autoAlpha: 0, y: 14, willChange: 'transform,opacity' }); }
        if (desc)   { descs.push(desc);   gsap.set(desc,   { autoAlpha: 0, y: 14, willChange: 'transform,opacity' }); }
        if (divider){ dividers.push(divider); gsap.set(divider, { scaleX: 0, transformOrigin: '50% 50%' }); }
      });

      const D = 0.7;

      const tl = gsap.timeline({
        defaults: { ease: EASE },
        scrollTrigger: { trigger: valuesGrid, start: 'top 85%', once: true }
      });

      tl.add('phase1')
        .to(icons,    { autoAlpha: 1, y: 0, scale: 1, duration: D }, 'phase1')
        .to(dividers, { scaleX: 1,                    duration: D }, 'phase1');

      tl.add('phase2')
        .to(titles, { autoAlpha: 1, y: 0, duration: D }, 'phase2');

      tl.add('phase3')
        .to(descs, { autoAlpha: 1, y: 0, duration: D }, 'phase3');

      tl.add(() => {
        const toClear = [...icons, ...titles, ...descs];
        gsap.set(toClear, { clearProps: 'transform,opacity,willChange' });
        gsap.set(dividers, { clearProps: 'transform' });
      });
    }

    /* ===== AFFILIATIONS ===== */
    {
      const affTitle = this.affTitleEl?.nativeElement;
      const affRows: HTMLElement[]  = (this.affRowEls?.toArray() || []).map((r: ElementRef<HTMLElement>) => r.nativeElement);
      const affSection = (affTitle?.closest('.affiliations') ?? null) as HTMLElement | null;

      if (affSection && affTitle && affRows.length) {
        gsap.timeline({
          defaults: { ease: EASE },
          scrollTrigger: { trigger: affSection, start: 'top 85%', once: true },
          onStart: () => {
            rm(affTitle, 'prehide');
            affRows.forEach(el => rm(el, 'prehide-row'));
          }
        })
        .to(affTitle, { autoAlpha: 1, y: 0, duration: 0.65 }, 0)
        .to(affRows,  { autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.06 }, 0.15);
      }
    }

    /* ===== DÉONTOLOGIE ===== */
    {
      const deonTitle  = this.deonTitleEl?.nativeElement;
      const deonRows: HTMLElement[]   = (this.deonRowEls?.toArray() || []).map((r: ElementRef<HTMLElement>) => r.nativeElement);
      const deonSection = (deonTitle?.closest('.deon') ?? null) as HTMLElement | null;

      if (deonSection && deonTitle && deonRows.length) {
        gsap.timeline({
          defaults: { ease: EASE },
          scrollTrigger: { trigger: deonSection, start: 'top 85%', once: true },
          onStart: () => {
            rm(deonTitle, 'prehide');
            deonRows.forEach(el => rm(el, 'prehide-row'));
          }
        })
        .to(deonTitle, { autoAlpha: 1, y: 0, duration: 0.65 }, 0)
        .to(deonRows,  { autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.06 }, 0.15);
      }
    }

    /* ===== TIMELINE ===== */
    const tlTitleEl = this.tlTitleEl?.nativeElement as HTMLElement | undefined;
    const tlRailEl  = this.tlRail?.nativeElement  as HTMLElement | undefined;
    const tlYears: HTMLElement[]   = (this.tlYearEls?.toArray() || []).map((r: ElementRef<HTMLElement>) => r.nativeElement as HTMLElement);
    const tlBodies: HTMLElement[]  = (this.tlBodyEls?.toArray() || []).map((r: ElementRef<HTMLElement>) => r.nativeElement as HTMLElement);

    if (tlTitleEl) {
      gsap.fromTo(tlTitleEl, { autoAlpha: 0, y: 16 }, {
        autoAlpha: 1, y: 0, duration: 0.5, ease: EASE,
        scrollTrigger: { trigger: tlTitleEl, start: 'top 85%', once: true },
        onStart: () => rm(tlTitleEl, 'prehide')
      });
    }

    if (tlRailEl && tlYears.length && tlBodies.length) {
      const timelineSection = (tlRailEl.closest('.timeline') ?? null) as HTMLElement | null;
      const tlGrid          = (tlRailEl.closest('.tl-grid') ?? null) as HTMLElement | null;

      tlYears.forEach((y: HTMLElement) => {
        (y as any).__revealed = false;
        gsap.set(y, { autoAlpha: 0, y: 10 });
        y.style.setProperty('--dashNow', '0px');
      });
      tlBodies.forEach((b: HTMLElement) => gsap.set(b, { autoAlpha: 0, y: 10 }));

      let railHeight = 0;
      let checkpoints: number[] = [];

      const computeLayout = () => {
        const railBox = tlRailEl.getBoundingClientRect();
        railHeight = railBox.height;

        checkpoints = tlYears.map((yEl: HTMLElement) => {
          const yBox = yEl.getBoundingClientRect();
          const fs = parseFloat(getComputedStyle(yEl).fontSize) || 16;
          const dashOffset = 0.6 * fs;
          const cutYAbs = yBox.top + dashOffset;
          const cutYRel = cutYAbs - railBox.top;
          return Math.max(0, Math.min(railHeight, cutYRel));
        });
      };

      computeLayout();

      ScrollTrigger.create({
        trigger: timelineSection || tlGrid || tlRailEl,
        start: 'top 90%',
        end: 'bottom 75%',
        scrub: 0.6,
        onEnter: () => {
          tlYears.forEach(el => rm(el, 'prehide'));
          tlBodies.forEach(el => rm(el, 'prehide'));
        },
        onUpdate: (self) => {
          const p = self.progress;
          const drawPx = railHeight * p;
          gsap.set(tlRailEl, { scaleY: p, transformOrigin: 'top' });

          for (let i = 0; i < Math.min(tlYears.length, tlBodies.length); i++) {
            const yEl = tlYears[i];
            const bEl = tlBodies[i];
            if ((yEl as any).__revealed) continue;

            if (drawPx >= (checkpoints[i] || 0)) {
              (yEl as any).__revealed = true;
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
          gsap.set(tlRailEl, { scaleY: 0, transformOrigin: 'top' });
          tlYears.forEach((y: HTMLElement) => {
            (y as any).__revealed = false;
            gsap.set(y, { autoAlpha: 0, y: 10 });
            y.style.setProperty('--dashNow', '0px');
          });
          tlBodies.forEach((b: HTMLElement) => gsap.set(b, { autoAlpha: 0, y: 10 }));
        }
      });

      const ro = this.getResizeObserver(() => {
        computeLayout();
        try { ScrollTrigger.refresh(); } catch {}
      });
      if (ro) ro.observe(tlGrid || tlRailEl);
    }

    /* Hover zoom – listes “Où ?” */
    this.clearHoverBindings();
    this.attachHoverZoom(whereEls, true, 1.045);
    this.attachHoverZoom(mapItemEls, true, 1.045);

    try { ScrollTrigger.refresh(); } catch {}
  }

  /* ========================= */
  /* Utils                     */
  /* ========================= */
  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  private _ro?: ResizeObserver;
  private getResizeObserver(cb: ResizeObserverCallback): ResizeObserver | null {
    if (!this.isBrowser() || !('ResizeObserver' in window)) return null;
    if (!this._ro) this._ro = new ResizeObserver(cb);
    return this._ro;
  }

  private killAllScrollTriggers(): void {
    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}
  }
}
