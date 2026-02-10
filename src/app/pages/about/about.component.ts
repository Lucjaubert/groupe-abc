// src/app/pages/about/about.component.ts

import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  inject,
  ElementRef,
  ViewChild,
  ViewChildren,
  QueryList,
  ChangeDetectorRef,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser, DOCUMENT } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { forkJoin, firstValueFrom, Subscription } from 'rxjs';

import { WordpressService, PartnerCard } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { getSeoForRoute } from '../../config/seo.routes';
import { ImgFastDirective } from '../../directives/img-fast.directive';
import { FaqService } from '../../services/faq.service';
import { getFaqForRoute, FaqItem } from '../../config/faq.routes';

/* =========================
 * Types locaux
 * ========================= */

type Intro = { title: string; content: string };
type CoreValue = { title?: string; html?: string; icon?: string | number };
type CoreBlock = { title?: string; html?: string; items?: string[] };
type TimelineStep = { year?: string; title?: string; html?: string };
type AffItem = { logo?: string; excerpt?: string; content?: string };
type DeonItem = { title?: string; html?: string; file?: string | null };
type Mesh = { title?: string; image?: string; levels: string[] };
type MapSection = { title?: string; image?: string; items: string[] };
type ValueItem = { title: string; html: string; iconUrl: string };

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterModule, ImgFastDirective],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
})
export class AboutComponent implements OnInit, AfterViewInit, OnDestroy {
  /* =========================
   * injections
   * ========================= */
  private wp = inject(WordpressService);
  private seo = inject(SeoService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private faq = inject(FaqService);

  private platformId = inject(PLATFORM_ID);
  private doc = inject(DOCUMENT) as Document;

  /* =========================
   * SSR / Browser helpers
   * ========================= */
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
  private get win(): Window | null {
    return this.isBrowser ? (window as any) : null;
  }

  /* =========================
   * State principal
   * ========================= */

  coreReady = false;

  intro: Intro = { title: '', content: '' };
  core: CoreBlock[] = [];

  mesh?: Mesh;
  mapSection?: MapSection;

  coreValuesTitle = '';
  coreValues: ValueItem[] = [];

  affiliations: AffItem[] = [];
  affTitle = '';
  affOpen: boolean[] = [];

  deontology: DeonItem[] = [];
  deonTitle = '';
  deonOpen: boolean[] = [];

  timeline: TimelineStep[] = [];
  timelineTitle = '';

  /** FAQ SEO-only spécifique à cette page (injectée via faq.routes.ts) */
  faqItems: FaqItem[] = [];

  /** Partenaires (carrousel) */
  allPartners: PartnerCard[] = [];
  activePartner?: PartnerCard;
  currentPhotoUrl = '';
  private partnerIndex = 0;
  private autoTimer: any;
  private autoMs = 4000;
  private partnerPhotoCache = new WeakMap<PartnerCard, string>();
  private partnerPhotoInFlight = new WeakMap<PartnerCard, Promise<string>>();

  /** Logo organisation / réseau (utilisé par about.component.html) */
  currentOrgLogoUrl = '';
  defaultOrgLogo = '/assets/fallbacks/logo-placeholder.svg'; // adapte si besoin

  /** Divers */
  defaultPortrait = '/assets/fallbacks/portrait-placeholder.svg';

  get hasMultiplePartners(): boolean {
    return this.allPartners.length > 1;
  }

  /** FAQ */
  openFaqIndexes = new Set<number>();

  /* =========================
   * Références template (animations)
   * ========================= */

  @ViewChild('coreTitle') coreTitle!: ElementRef<HTMLElement>;
  @ViewChild('coreGrid') coreGrid!: ElementRef<HTMLElement>;
  @ViewChild('coreLeft') coreLeft!: ElementRef<HTMLElement>;
  @ViewChild('coreRight') coreRight!: ElementRef<HTMLElement>;

  @ViewChild('meshTitleEl') meshTitleEl!: ElementRef<HTMLElement>;
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
  private bindScheduled = false;
  private revealed = new WeakSet<HTMLElement>();

  /** ResizeObserver (1 instance, mais callback recréé en reconnectant) */
  private _ro?: ResizeObserver;

  /** Subscriptions (QueryList.changes) */
  private qlSubs: Subscription[] = [];

  /** GSAP lazy refs (browser-only) */
  private gsap: any | null = null;
  private ScrollTrigger: any | null = null;
  private gsapCtx: any | null = null;

  /* =========================
   * Routes équipe
   * ========================= */

  private TEAM_ROUTE_FR = '/experts-immobiliers-agrees';
  private TEAM_ROUTE_EN = '/en/chartered-valuers-team';

  /* =========================
   * Lifecycle
   * ========================= */

  ngOnInit(): void {
    forkJoin({
      about: this.wp.getAboutData(),
      whereFromHome: this.wp.getHomepageIdentityWhereItems(),
      teamPartners: this.wp.getTeamPartners(),
    }).subscribe(async ({ about, whereFromHome, teamPartners }) => {
      const resolveMediaInline = async (idOrUrl: any): Promise<string> => {
        if (!idOrUrl) return '';
        if (typeof idOrUrl === 'string') return idOrUrl;
        try {
          return (await firstValueFrom(this.wp.getMediaUrl(idOrUrl))) || '';
        } catch {
          return '';
        }
      };

      /* -------- Intro / Core -------- */
      const hero = about?.hero ?? {};
      const introBody: string = about?.intro_body || '';
      this.intro = {
        title: hero.section_title || 'Qui sommes-nous ?',
        content: introBody,
      };

      this.core = [{ title: this.intro.title, html: this.intro.content }];

      /* -------- Logo org / réseau (pour currentOrgLogoUrl) -------- */
      const logoRaw =
        about?.hero?.logo ??
        about?.identity?.logo ??
        about?.network?.logo ??
        about?.organization_logo ??
        about?.org_logo ??
        null;

      this.currentOrgLogoUrl =
        (await resolveMediaInline(logoRaw)) || this.defaultOrgLogo || '';

      /* -------- Map (Où ?) -------- */
      const mapSecRaw = about?.map_section ?? {};
      const whereFallback = [
        mapSecRaw.where_item_1,
        mapSecRaw.where_item_2,
        mapSecRaw.where_item_3,
        mapSecRaw.where_item_4,
        mapSecRaw.where_item_5,
        mapSecRaw.where_item_6,
        mapSecRaw.where_item_7,
        mapSecRaw.where_item_8,
      ].filter(Boolean) as string[];

      const whereItems =
        Array.isArray(whereFromHome) && whereFromHome.length
          ? whereFromHome
          : whereFallback;

      this.mapSection = {
        title: mapSecRaw.where_title || 'Où ?',
        image: await resolveMediaInline(mapSecRaw.map_image),
        items: whereItems,
      };

      /* -------- Mesh (maillage) -------- */
      const meshRaw = about?.mesh ?? {};
      const meshLevels = [
        meshRaw.level_label_1,
        meshRaw.level_label_2,
        meshRaw.level_label_3,
      ].filter(Boolean) as string[];

      this.mesh = {
        title:
          meshRaw.section_title ||
          'Un maillage à toutes les échelles de notre territoire',
        image: await resolveMediaInline(meshRaw.skyline_image),
        levels: meshLevels,
      };

      /* -------- Valeurs -------- */
      const cv = about?.core_values ?? {};
      this.coreValuesTitle = cv.section_title || 'Nos valeurs';

      const rawVals = ['value_1', 'value_2', 'value_3']
        .map((k) => (cv as any)[k])
        .filter(Boolean) as CoreValue[];

      const resolvedValues: ValueItem[] = [];
      for (const v of rawVals) {
        const iconUrl = await resolveMediaInline(v.icon);
        resolvedValues.push({
          title: v.title || '',
          html: (v as any).description || v.html || '',
          iconUrl,
        });
      }
      this.coreValues = resolvedValues.filter((v) => v.title || v.html || v.iconUrl);

      /* -------- Affiliations -------- */
      const a = about?.affiliations ?? {};
      this.affTitle = a.section_title || 'Appartenance';

      const rawAffs: AffItem[] = [];
      for (let i = 1; i <= 5; i++) {
        const it = (a as any)[`association_${i}`];
        if (!it) continue;
        rawAffs.push({
          logo: await resolveMediaInline(it.logo),
          excerpt: it.name || '',
          content: it.description || '',
        });
      }
      this.affiliations = rawAffs.filter((x) => x.logo || x.excerpt || x.content);
      this.affOpen = new Array(this.affiliations.length).fill(false);

      /* -------- Déontologie -------- */
      const d = about?.deontology ?? {};
      this.deonTitle = d.deo_title || 'Déontologie';
      this.deontology = [];

      for (let i = 1; i <= 4; i++) {
        const di = (d as any)[`deo_${i}`];
        if (!di) continue;

        const rawFile =
          di['deo-doc-download'] ??
          di['deo_doc_download'] ??
          di.deoDocDownload ??
          di['deo_document'] ??
          null;

        const fileUrl = rawFile ? await resolveMediaInline(rawFile) : null;

        this.deontology.push({
          title: di.title || '',
          html: di.deo_description || '',
          file: fileUrl,
        });
      }
      this.deonOpen = new Array(this.deontology.length).fill(false);

      /* -------- Timeline -------- */
      const tlRaw = about?.timeline ?? {};
      this.timelineTitle = tlRaw.section_title || 'Timeline du Groupe ABC';

      const events: TimelineStep[] = [];
      for (let i = 1; i <= 12; i++) {
        const ev = (tlRaw as any)[`event_${i}`];
        if (!ev) continue;
        const step: TimelineStep = {
          year: ev.year || '',
          title: ev.title || '',
          html: ev.description || '',
        };
        if (step.year || step.title || step.html) events.push(step);
      }
      this.timeline = events;

      /* -------- Partenaires (carrousel) -------- */
      this.allPartners = Array.isArray(teamPartners) ? this.shuffle(teamPartners) : [];
      const startOn = Math.floor(Math.random() * Math.max(1, this.allPartners.length));
      this.setActivePartnerInstant(startOn);
      this.primeAllPartnerPhotos();
      this.startAutoRotate();

      /* -------- FAQ SEO-only (en dur via faq.routes.ts) -------- */
      const lang = this.isEnglish() ? ('en' as const) : ('fr' as const);
      this.faqItems = getFaqForRoute('about', lang);

      // ---- Alimentation de la bulle FAQ via FaqService ----
      if (this.faqItems && this.faqItems.length) {
        if (lang === 'en') this.faq.set([], this.faqItems);
        else this.faq.set(this.faqItems, []);
      } else {
        this.faq.clear();
      }

      /* -------- SEO complet (dynamique à partir de la config centrale) -------- */
      this.applySeoFromConfig();

      /* -------- Animations -------- */
      this.coreReady = true;
      this.scheduleBind();
      this.cdr.markForCheck();
    });
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser) return;

    await this.initGsapIfNeeded();
    if (!this.gsap || !this.ScrollTrigger) return;

    // Rebind anims quand le DOM évolue (browser-only)
    this.qlSubs.push(this.meshLevelEls?.changes?.subscribe(() => this.scheduleBind()));
    this.qlSubs.push(this.mapItems?.changes?.subscribe(() => this.scheduleBind()));
    this.qlSubs.push(this.valueItemEls?.changes?.subscribe(() => this.scheduleBind()));
    this.qlSubs.push(this.affRowEls?.changes?.subscribe(() => this.scheduleBind()));
    this.qlSubs.push(this.deonRowEls?.changes?.subscribe(() => this.scheduleBind()));
    this.qlSubs.push(this.tlYearEls?.changes?.subscribe(() => this.scheduleBind()));
    this.qlSubs.push(this.tlBodyEls?.changes?.subscribe(() => this.scheduleBind()));

    this.scheduleBind();
  }

  ngOnDestroy(): void {
    // On nettoie la FAQ globale pour éviter de polluer la page suivante
    this.faq.clear();

    // QueryList subs
    this.qlSubs.forEach((s) => {
      try {
        s.unsubscribe();
      } catch {}
    });
    this.qlSubs = [];

    // GSAP context (nettoie animations + ScrollTriggers créés dans le context)
    try {
      this.gsapCtx?.revert?.();
    } catch {}
    this.gsapCtx = null;

    this.clearHoverBindings();
    this.stopAutoRotate();

    try {
      this._ro?.disconnect();
    } catch {}
    this._ro = undefined;
  }

  /* =========================
   * GSAP lazy init (SSR-safe)
   * ========================= */

  private async initGsapIfNeeded(): Promise<void> {
    if (!this.isBrowser) return;
    if (this.gsap && this.ScrollTrigger) return;

    try {
      const gsapModule: any = await import('gsap');
      const stModule: any = await import('gsap/ScrollTrigger');

      const g = gsapModule?.gsap || gsapModule?.default || gsapModule;
      const st = stModule?.ScrollTrigger || stModule?.default;

      this.gsap = g;
      this.ScrollTrigger = st;

      try {
        this.gsap.registerPlugin(this.ScrollTrigger);
      } catch {}
    } catch {
      this.gsap = null;
      this.ScrollTrigger = null;
    }
  }

  /* =========================
   * Helpers généraux
   * ========================= */

  trackByIndex(i: number): number {
    return i;
  }

  toggleFaqItem(i: number): void {
    if (this.openFaqIndexes.has(i)) this.openFaqIndexes.delete(i);
    else this.openFaqIndexes.add(i);
  }

  isFaqItemOpen(i: number): boolean {
    return this.openFaqIndexes.has(i);
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* =========================
   * Navigation Equipes (Map) + liens (template)
   * ========================= */

  /** RouterLink vers la page équipe selon la langue */
  teamRouteLink(): string {
    return this.isEnglish() ? this.TEAM_ROUTE_EN : this.TEAM_ROUTE_FR;
  }

  /** Error handler spécifique logo org (fallback) */
  onOrgImgError(e: Event): void {
    const img = e.target as HTMLImageElement | null;
    if (!img) return;

    const fallback = this.defaultOrgLogo || this.defaultPortrait;
    if (!fallback) return;

    // évite boucle si fallback lui-même casse
    if (img.src && img.src.endsWith(fallback.split('/').pop() || '')) return;

    img.src = fallback;
  }

  private norm(s: string): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private regionKeyFromLabel(label: string): string {
    const n = this.norm(label);

    if (n.includes('paris') || n.includes('ile-de-france') || n.includes('ile de france'))
      return 'idf';
    if (n.includes('grand ouest')) return 'grand-ouest';
    if (n.includes('rhone') || n.includes('auvergne')) return 'rhone-alpes';
    if (
      n.includes("cote d'azur") ||
      n.includes('cote d azur') ||
      n.includes('cote-d-azur') ||
      n.includes('sud-est')
    )
      return 'cote-azur';
    if (n.includes('sud-ouest') || n.includes('sud ouest')) return 'sud-ouest';
    if (
      n.includes('grand est') ||
      n.includes('nord & est') ||
      n.includes('nord et est') ||
      n.includes('nord-est') ||
      n.includes('nord est')
    )
      return 'grand-est';
    if (n.includes('antilles') || n.includes('guyane')) return 'antilles-guyane';
    if (n.includes('reunion') || n.includes('mayotte')) return 'reunion-mayotte';

    return n.replace(/[^a-z0-9- ]/g, '').replace(/\s+/g, '-');
  }

  isEnglish(): boolean {
    try {
      const url = this.router.url || '';
      return url.startsWith('/en');
    } catch {
      return false;
    }
  }

  openRegion(label: string): void {
    const key = this.regionKeyFromLabel(label);
    const path = this.isEnglish() ? this.TEAM_ROUTE_EN : this.TEAM_ROUTE_FR;
    this.router.navigate([path], { queryParams: { region: key } });
  }

  /* =========================
   * Affiliations / Déontologie
   * ========================= */

  private setSingleOpen(arr: boolean[], i: number): void {
    const willOpen = !arr[i];
    arr.fill(false);
    if (willOpen) arr[i] = true;
  }

  toggleAff(i: number): void {
    this.setSingleOpen(this.affOpen, i);
  }

  toggleDeon(i: number): void {
    this.setSingleOpen(this.deonOpen, i);
  }

  splitAffName(raw: string): { abbr: string; label: string } {
    const s = (raw || '').trim();
    const idx = s.indexOf(':');
    if (idx === -1) return { abbr: s, label: '' };
    return {
      abbr: s.slice(0, idx).trim(),
      label: s.slice(idx + 1).trim(),
    };
  }

  onRowToggleKeydown(e: KeyboardEvent, i: number, kind: 'aff' | 'deon'): void {
    const key = e.key;

    // Enter / Space
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      e.preventDefault(); // évite le scroll sur Space
      if (kind === 'aff') this.toggleAff(i);
      else this.toggleDeon(i);
    }
  }

  /* ===== Helpers download déontologie ===== */

  isSameOrigin(url: string): boolean {
    if (!this.isBrowser || !this.win) return false;
    try {
      const u = new URL(url, this.win.location.origin);
      return u.origin === this.win.location.origin;
    } catch {
      return false;
    }
  }

  safeDownloadName(url: string): string {
    if (!this.isBrowser || !this.win) return 'document.pdf';
    try {
      const u = new URL(url, this.win.location.origin);
      const name = u.pathname.split('/').pop() || 'document.pdf';
      return name.replace(/[^\w.\-()\[\] ]+/g, '_');
    } catch {
      return 'document.pdf';
    }
  }

  /* =========================
   * Partenaires (carrousel)
   * ========================= */

  private async resolveImgUrl(input: any, size: string = 'large'): Promise<string> {
    if (!input) return '';

    if (typeof input === 'string') {
      const s = input.trim();
      if (!s) return '';
      if (/^\d+$/.test(s)) {
        try {
          return (await firstValueFrom(this.wp.getMediaUrl(+s))) || '';
        } catch {
          return '';
        }
      }
      return s;
    }

    if (typeof input === 'number') {
      try {
        return (await firstValueFrom(this.wp.getMediaUrl(input))) || '';
      } catch {
        return '';
      }
    }

    if (typeof input === 'object') {
      const sized = input?.media_details?.sizes?.[size]?.source_url;
      if (sized) return sized;
      const direct = input?.source_url || input?.url;
      if (direct) return direct;
      const id = input?.id ?? input?.ID;
      if (typeof id === 'number') {
        try {
          return (await firstValueFrom(this.wp.getMediaUrl(id))) || '';
        } catch {
          return '';
        }
      }
    }

    return '';
  }

  private cachedPhotoUrl(p?: PartnerCard): string {
    return (p && this.partnerPhotoCache.get(p)) || '';
  }

  private async ensurePartnerReady(p: PartnerCard): Promise<string> {
    if (!p) return this.defaultPortrait;

    const cached = this.partnerPhotoCache.get(p);
    if (cached) return cached;

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

  private preload(src: string): Promise<void> {
    if (!this.isBrowser || !this.win || !src) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const ImgCtor = (this.win as any).Image;
      if (!ImgCtor) return resolve();

      const img = new ImgCtor();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = src;
    });
  }

  private primeAllPartnerPhotos(): void {
    if (!Array.isArray(this.allPartners) || this.allPartners.length <= 1) return;
    this.allPartners.forEach((p) => {
      void this.ensurePartnerReady(p);
    });
  }

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

  nextPartner(): void {
    this.setActivePartnerInstant(this.partnerIndex + 1);
  }

  prevPartner(): void {
    this.setActivePartnerInstant(this.partnerIndex - 1);
  }

  startAutoRotate(): void {
    if (!this.isBrowser) return;
    this.stopAutoRotate();
    if (this.allPartners.length <= 1) return;

    this.autoTimer = setInterval(() => this.nextPartner(), this.autoMs);
  }

  stopAutoRotate(): void {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
  }

  onImgError(e: Event): void {
    const img = e.target as HTMLImageElement;
    if (img && !img.src.endsWith('portrait-placeholder.svg')) {
      img.src = this.defaultPortrait;
    }
  }

  /* =========================
   * Helpers texte (SEO / FAQ)
   * ========================= */

  private stripHtml(raw: string): string {
    return (raw || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Construit le JSON-LD FAQPage pour intégration dans le @graph. */
  private buildFaqJsonLd(faqItems: FaqItem[], pageUrl: string): any | null {
    if (!faqItems || !faqItems.length) return null;

    return {
      '@type': 'FAQPage',
      '@id': pageUrl.replace(/\/+$/, '') + '#faq',
      mainEntity: faqItems.map((it) => ({
        '@type': 'Question',
        name: it.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: it.a,
        },
      })),
    };
  }

  /* =========================
   * SEO complet (à partir de seo-pages.config.ts)
   * ========================= */

  private applySeoFromConfig(): void {
    const lang = this.isEnglish() ? ('en' as const) : ('fr' as const);
    const baseSeo = getSeoForRoute('about', lang);

    // Title dynamique : on priorise le titre WP, sinon on garde le title de base
    const title = (this.intro?.title?.trim() || baseSeo.title).trim();

    // Description dynamique : on part du corps WP, sinon fallback sur la description de base
    const descRaw = this.stripHtml(this.intro?.content || '');
    const description = (descRaw || baseSeo.description || '').slice(0, 160);

    const canonical = (baseSeo.canonical || '').replace(/\/+$/, '');
    const inLanguage = lang === 'en' ? 'en-US' : 'fr-FR';

    // On reconstruit les @id "sitewide" à partir de la canonical (pour AboutPage)
    let siteId = '';
    let orgId = '';
    try {
      const u = new URL(canonical || baseSeo.canonical || 'https://groupe-abc.fr/');
      const origin = `${u.protocol}//${u.host}`;
      siteId = `${origin}#website`;
      orgId = `${origin}#organization`;
    } catch {
      siteId = 'https://groupe-abc.fr/#website';
      orgId = 'https://groupe-abc.fr/#organization';
    }

    const aboutPage = {
      '@type': 'AboutPage',
      '@id': `${canonical}#about`,
      url: canonical,
      name: title,
      description,
      inLanguage,
      isPartOf: { '@id': siteId },
      about: {
        '@type': 'Service',
        serviceType: 'Réseau d’expertise immobilière',
        provider: { '@id': orgId },
        areaServed: 'France métropolitaine et Outre-mer',
      },
      primaryImageOfPage: baseSeo.image || undefined,
    };

    const breadcrumb = {
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: lang === 'en' ? 'Home' : 'Accueil',
          item: canonical.replace(/(\/en)?\/expert-network-chartered-valuers$/, '/'),
        },
        {
          '@type': 'ListItem',
          position: 2,
          name:
            lang === 'en'
              ? 'About the network'
              : 'Réseau national d’experts immobiliers agréés',
          item: canonical,
        },
      ],
    };

    const faqLd = this.buildFaqJsonLd(this.faqItems, canonical);

    const graph: any[] = [aboutPage, breadcrumb];
    if (faqLd) graph.push(faqLd);

    this.seo.update({
      ...baseSeo,
      title,
      description,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': graph,
      },
    });
  }

  /* =========================
   * Animations GSAP (SSR safe)
   * ========================= */

  private scheduleBind(): void {
    if (!this.isBrowser) return;
    if (!this.gsap || !this.ScrollTrigger) return;
    if (this.bindScheduled) return;

    this.bindScheduled = true;

    const raf =
      this.win?.requestAnimationFrame?.bind(this.win) ||
      ((cb: FrameRequestCallback) => setTimeout(cb as any, 0));

    queueMicrotask(() =>
      raf(() => {
        this.bindScheduled = false;
        this.bindAnimations();
      })
    );
  }

  private bindAnimations(): void {
    if (!this.isBrowser) return;
    if (!this.gsap || !this.ScrollTrigger) return;
    if (!this.win) return;

    const gsap = this.gsap;
    const ScrollTrigger = this.ScrollTrigger;

    // IMPORTANT: scope + cleanup local (ne pas tuer les triggers du reste du site)
    try {
      this.gsapCtx?.revert?.();
    } catch {}
    this.gsapCtx = gsap.context(() => {
      const EASE = 'power3.out';
      const rm = (el?: Element | null, cls = 'prehide') =>
        el && (el as HTMLElement).classList.remove(cls);

      /* ----- CORE ----- */
      const coreTitleEl = this.coreTitle?.nativeElement;
      const coreGridEl = this.coreGrid?.nativeElement;

      if (coreTitleEl && coreGridEl && !this.revealed.has(coreTitleEl)) {
        const tlCore = gsap.timeline({
          defaults: { ease: EASE },
          scrollTrigger: { trigger: coreTitleEl, start: 'top 85%', once: true },
        });

        tlCore.add(() => rm(coreTitleEl), 0);

        tlCore.fromTo(
          coreTitleEl,
          { autoAlpha: 0, y: 20 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.45,
            onComplete: () => this.revealed.add(coreTitleEl),
          }
        );

        tlCore.add(
          () => {
            rm(coreGridEl);
            gsap.fromTo(
              coreGridEl,
              { autoAlpha: 0, y: 20 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.5,
                ease: EASE,
                onComplete: () => {
                  this.revealed.add(coreGridEl);
                  gsap.set(coreGridEl, {
                    clearProps: 'transform,opacity,visibility,willChange',
                  });
                },
              }
            );
          },
          '+=0.9'
        );
      }

      /* ----- MESH ----- */
      const meshTitle = this.meshTitleEl?.nativeElement;
      const skyline = this.meshSkylineEl?.nativeElement;
      const meshLevels = this.meshLevelsEl?.nativeElement;
      const meshLevelItems =
        this.meshLevelEls?.toArray().map((r) => r.nativeElement) || [];

      if (meshTitle) {
        gsap.fromTo(
          meshTitle,
          { autoAlpha: 0, y: 18 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.55,
            ease: EASE,
            scrollTrigger: { trigger: meshTitle, start: 'top 85%', once: true },
            onStart: () => rm(meshTitle),
          }
        );
      }

      if (skyline) {
        gsap.fromTo(
          skyline,
          { autoAlpha: 0, y: 18 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.55,
            ease: EASE,
            scrollTrigger: { trigger: skyline, start: 'top 80%', once: true },
            onStart: () => rm(skyline),
          }
        );
      }

      if (meshLevels && meshLevelItems.length) {
        gsap.set(meshLevels, { '--lineW': '0%' } as any);
        gsap.set(meshLevelItems, { autoAlpha: 0, y: 10 });

        const tl = gsap.timeline({
          defaults: { ease: 'power2.out' },
          scrollTrigger: { trigger: meshLevels, start: 'top 85%', once: true },
          onStart: () => {
            rm(meshLevels);
            meshLevelItems.forEach((el) => rm(el));
          },
        });

        tl.to(meshLevels, { duration: 1.6, '--lineW': '100%' } as any);

        const steps = [0.15, 0.85, 1.55];
        meshLevelItems.forEach((el, i) => {
          tl.to(
            el,
            { autoAlpha: 1, y: 0, duration: 0.45, ease: EASE },
            steps[Math.min(i, steps.length - 1)]
          );
        });
      }

      /* ----- MAP ----- */
      const mapImgWrap = this.mapImageEl?.nativeElement;
      const mapTitle = this.mapTitleEl?.nativeElement;
      const mapItemEls = this.mapItems?.toArray().map((r) => r.nativeElement) || [];
      const mapList = (mapItemEls[0]?.parentElement as HTMLElement) || null;

      if (mapImgWrap) {
        gsap.fromTo(
          mapImgWrap,
          { autoAlpha: 0, y: 18 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.55,
            ease: EASE,
            scrollTrigger: { trigger: mapImgWrap, start: 'top 85%', once: true },
            onStart: () => rm(mapImgWrap),
          }
        );
      }

      if (mapTitle) {
        gsap.fromTo(
          mapTitle,
          { autoAlpha: 0, y: 16 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            ease: EASE,
            scrollTrigger: { trigger: mapTitle, start: 'top 85%', once: true },
            onStart: () => rm(mapTitle),
          }
        );
      }

      if (mapList && mapItemEls.length) {
        gsap.fromTo(
          mapItemEls,
          { autoAlpha: 0, y: 14 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.45,
            ease: EASE,
            stagger: 0.08,
            scrollTrigger: { trigger: mapList, start: 'top 90%', once: true },
            onStart: () =>
              mapItemEls.forEach((el) => el.classList.remove('prehide-row')),
          }
        );
      }

      /* ----- VALUES ----- */
      const valuesTitle = this.valuesTitleEl?.nativeElement;
      const valueItems = this.valueItemEls?.toArray().map((r) => r.nativeElement) || [];
      const valuesGrid = (valueItems[0]?.parentElement as HTMLElement) || null;

      if (valuesTitle) {
        gsap.fromTo(
          valuesTitle,
          { autoAlpha: 0, y: 16 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            ease: EASE,
            scrollTrigger: { trigger: valuesTitle, start: 'top 85%', once: true },
            onStart: () => rm(valuesTitle),
          }
        );
      }

      if (valuesGrid && valueItems.length) {
        const icons: HTMLElement[] = [];
        const titles: HTMLElement[] = [];
        const descs: HTMLElement[] = [];
        const dividers: HTMLElement[] = [];

        valueItems.forEach((li) => {
          li.classList.remove('prehide');
          gsap.set(li, { autoAlpha: 1, clearProps: 'visibility' });

          const icon = li.querySelector('.icon-wrap img') as HTMLElement | null;
          const title = li.querySelector('.value-name') as HTMLElement | null;
          const desc = li.querySelector('.value-desc') as HTMLElement | null;
          const divider = li.querySelector('.divider') as HTMLElement | null;

          if (icon) {
            icons.push(icon);
            gsap.set(icon, { autoAlpha: 0, y: 8, scale: 0.98, willChange: 'transform,opacity' });
          }
          if (title) {
            titles.push(title);
            gsap.set(title, { autoAlpha: 0, y: 14, willChange: 'transform,opacity' });
          }
          if (desc) {
            descs.push(desc);
            gsap.set(desc, { autoAlpha: 0, y: 14, willChange: 'transform,opacity' });
          }
          if (divider) {
            dividers.push(divider);
            gsap.set(divider, { scaleX: 0, transformOrigin: '50% 50%' });
          }
        });

        const D = 0.7;

        const tl = gsap.timeline({
          defaults: { ease: EASE },
          scrollTrigger: { trigger: valuesGrid, start: 'top 85%', once: true },
        });

        tl.add('phase1')
          .to(icons, { autoAlpha: 1, y: 0, scale: 1, duration: D }, 'phase1')
          .to(dividers, { scaleX: 1, duration: D }, 'phase1');

        tl.add('phase2').to(titles, { autoAlpha: 1, y: 0, duration: D }, 'phase2');
        tl.add('phase3').to(descs, { autoAlpha: 1, y: 0, duration: D }, 'phase3');

        tl.add(() => {
          const toClear = [...icons, ...titles, ...descs];
          gsap.set(toClear, { clearProps: 'transform,opacity,willChange' });
          gsap.set(dividers, { clearProps: 'transform' });
        });
      }

      /* ----- AFFILIATIONS ----- */
      {
        const affTitle = this.affTitleEl?.nativeElement;
        const affRows = this.affRowEls?.toArray().map((r) => r.nativeElement) || [];
        const affSection = affTitle ? (affTitle.closest('.affiliations') as HTMLElement | null) : null;

        if (affSection && affTitle && affRows.length) {
          gsap
            .timeline({
              defaults: { ease: EASE },
              scrollTrigger: { trigger: affSection, start: 'top 85%', once: true },
              onStart: () => {
                rm(affTitle);
                affRows.forEach((el) => el.classList.remove('prehide-row'));
              },
            })
            .to(affTitle, { autoAlpha: 1, y: 0, duration: 0.65 })
            .to(affRows, { autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.06 });
        }
      }

      /* ----- DEONTOLOGIE ----- */
      {
        const deonTitle = this.deonTitleEl?.nativeElement;
        const deonRows = this.deonRowEls?.toArray().map((r) => r.nativeElement) || [];
        const deonSection = deonTitle ? (deonTitle.closest('.deon') as HTMLElement | null) : null;

        if (deonSection && deonTitle && deonRows.length) {
          gsap
            .timeline({
              defaults: { ease: EASE },
              scrollTrigger: { trigger: deonSection, start: 'top 85%', once: true },
              onStart: () => {
                rm(deonTitle);
                deonRows.forEach((el) => el.classList.remove('prehide-row'));
              },
            })
            .to(deonTitle, { autoAlpha: 1, y: 0, duration: 0.65 })
            .to(deonRows, { autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.06 });
        }
      }

      /* ----- TIMELINE ----- */
      const tlTitleEl = this.tlTitleEl?.nativeElement;
      const tlRailEl = this.tlRail?.nativeElement;
      const tlYears = this.tlYearEls?.toArray().map((r) => r.nativeElement) || [];
      const tlBodies = this.tlBodyEls?.toArray().map((r) => r.nativeElement) || [];

      if (tlTitleEl) {
        gsap.fromTo(
          tlTitleEl,
          { autoAlpha: 0, y: 16 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            ease: EASE,
            scrollTrigger: { trigger: tlTitleEl, start: 'top 85%', once: true },
            onStart: () => rm(tlTitleEl),
          }
        );
      }

      if (tlRailEl && tlYears.length && tlBodies.length) {
        const timelineSection = tlRailEl.closest('.timeline') as HTMLElement | null;
        const tlGrid = tlRailEl.closest('.tl-grid') as HTMLElement | null;

        tlYears.forEach((y) => {
          (y as any).__revealed = false;
          gsap.set(y, { autoAlpha: 0, y: 10 });
          (y as HTMLElement).style.setProperty('--dashNow', '0px');
        });
        tlBodies.forEach((b) => gsap.set(b, { autoAlpha: 0, y: 10 }));
        gsap.set(tlRailEl, { scaleY: 0, transformOrigin: 'top' });

        let railHeight = 0;
        let checkpoints: number[] = [];

        const computeLayout = () => {
          const railBox = tlRailEl.getBoundingClientRect();
          railHeight = railBox.height;
          checkpoints = tlYears.map((yEl) => {
            const yBox = yEl.getBoundingClientRect();
            const fs = parseFloat(this.win!.getComputedStyle(yEl).fontSize) || 16;
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
            tlYears.forEach((el) => rm(el));
            tlBodies.forEach((el) => rm(el));
          },
          onUpdate: (self: any) => {
            const p = self.progress;
            const drawPx = railHeight * p;

            gsap.set(tlRailEl, { scaleY: p, transformOrigin: 'top' });

            for (let i = 0; i < tlYears.length; i++) {
              const yEl = tlYears[i] as any;
              const bEl = tlBodies[i];
              if (yEl.__revealed) continue;
              if (drawPx >= (checkpoints[i] || 0)) {
                yEl.__revealed = true;

                gsap.to(yEl, {
                  autoAlpha: 1,
                  y: 0,
                  duration: 0.45,
                  ease: EASE,
                  onStart: () => (yEl as HTMLElement).style.setProperty('--dashNow', 'var(--dash-w)'),
                });
                gsap.to(bEl, {
                  autoAlpha: 1,
                  y: 0,
                  duration: 0.45,
                  ease: EASE,
                  delay: 0.08,
                });
              }
            }
          },
          onRefreshInit: () => {
            computeLayout();
            gsap.set(tlRailEl, { scaleY: 0, transformOrigin: 'top' });

            tlYears.forEach((y: any) => {
              y.__revealed = false;
              gsap.set(y, { autoAlpha: 0, y: 10 });
              (y as HTMLElement).style.setProperty('--dashNow', '0px');
            });
            tlBodies.forEach((b) => gsap.set(b, { autoAlpha: 0, y: 10 }));
          },
        });

        const ro = this.getResizeObserver(() => {
          computeLayout();
          try {
            ScrollTrigger.refresh();
          } catch {}
        });
        if (ro && (tlGrid || tlRailEl)) ro.observe(tlGrid || tlRailEl);
      }

      /* ----- Hover zoom MAP items ----- */
      this.clearHoverBindings();
      this.attachHoverZoom(mapItemEls, true, 1.045);

      try {
        ScrollTrigger.refresh();
      } catch {}
    }, this.doc?.body as any);
  }

  // ✅ SOLUTION : on force un ResizeObserver "à jour" (callback correct) à chaque appel
  private getResizeObserver(cb: ResizeObserverCallback): ResizeObserver | null {
    if (!this.isBrowser || !this.win) return null;
    if (!('ResizeObserver' in this.win)) return null;

    try {
      this._ro?.disconnect();
    } catch {}

    this._ro = new ResizeObserver(cb);
    return this._ro;
  }

  /* =========================
   * Hover helpers
   * ========================= */

  private attachHoverZoom(
    elements: HTMLElement[] | undefined,
    originLeft = true,
    scale = 1.045
  ): void {
    if (!this.isBrowser || !elements || !elements.length) return;
    if (!this.gsap) return;

    const gsap = this.gsap;

    elements.forEach((el) => {
      if (!el) return;
      el.style.transformOrigin = originLeft ? 'left center' : 'center center';
      el.style.willChange = 'transform';

      const enter = () =>
        gsap.to(el, {
          scale,
          duration: 0.18,
          ease: 'power3.out',
        });
      const leave = () =>
        gsap.to(el, {
          scale: 1,
          duration: 0.22,
          ease: 'power2.out',
        });

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

  private clearHoverBindings(): void {
    this.hoverCleanup.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
    this.hoverCleanup = [];
  }
}
