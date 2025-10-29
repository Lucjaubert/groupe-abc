import {
  Component, OnDestroy, OnInit, AfterViewInit, inject,
  ViewChildren, QueryList, ElementRef, ViewChild, ChangeDetectorRef, PLATFORM_ID
} from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { FaqService, FaqItem } from '../../services/faq.service';
import { environment } from '../../../environments/environment';

import { AlignFirstWordDirective } from '../../shared/directives/align-first-word.directive';
import { firstValueFrom, filter, Subscription } from 'rxjs';
import { ImgFastDirective } from '../../directives/img-fast.directive';

/* ===== Types ===== */
type Slide = { title: string; subtitle: string; bg: string | number };

type Identity = {
  whoTitle: string; whoHtml: string;
  whereTitle: string; whereMap?: string | number;
  whereItems: string[];
};

type WhatHow = { whatTitle: string; whatItems: string[]; howTitle: string; howItems: string[] };
type Presentation = { text1: string; text2: string; file: string | null };
type ContextItem = { icon: string | number; label: string };
type ExpertiseContext = { title: string; items: ContextItem[] };
type Clients = { icon: string | number; title: string; items: string[] };

type TeamMember = {
  photo: string | number;
  nameFirst: string;
  nameLast: string;
  area: string;
  jobHtml: string;
};

type ThemeKey = 'marche' | 'juridique' | 'expertise' | 'autre';
type NewsItem = {
  logo?: string | number; firm?: string; theme?: string; authorDate?: string;
  title?: string; html?: string; link?: string; id?: number | string; slug?: string; themeKey?: ThemeKey;
};
type News = { title: string; items: NewsItem[] };

/* ===== KeyFigures ===== */
interface KeyFigure {
  value: number;
  label: string;
  labelBis: string;
  fullLabel: string;
  display: string;
  typed: string;
  digits: number;
  played: boolean;
}

/* ==========================================================
   TEXTES FIXES HERO
   ========================================================== */
const HERO_TEXT = {
  fr: {
    titles:   ['Groupe ABC.', 'Groupe ABC.', 'Groupe ABC.'],
    subtitles: [
      'Au plus près de la valeur de votre bien',
      'L’Expertise immobilière sur mesure',
      'La maîtrise des marchés immobiliers locaux'
    ]
  },
  en: {
    titles:   ['ABC Group.', 'ABC Group.', 'ABC Group.'],
    subtitles: [
      'As close as possible to your asset’s true value',
      'Tailor-made real-estate valuation',
      'Mastery of local real-estate markets'
    ]
  }
} as const;

/* ====== KEY FIGURES – FR/EN ====== */
type KF = { value: number; fr: string; en: string; };

const KEY_FIGURES_STATIC: KF[] = [
  { value: 7,    fr: 'cabinets associés',                           en: 'associated firms' },
  { value: 70,   fr: 'collaborateurs',                              en: 'employees' },
  { value: 35,   fr: 'experts immobiliers',                         en: 'real estate experts' },
  { value: 14,   fr: 'bureaux, dont 4 dans les Dom-Tom',            en: 'offices, incl. 4 in DOM-TOM' },
  { value: 172,  fr: 'années d’expérience',                         en: 'years of experience' },

  { value: 8,    fr: 'experts judiciaires près la Cour d’appel',    en: 'court-appointed experts' },
  { value: 7,    fr: 'experts accrédités RICS',                     en: 'RICS-accredited experts' },
  { value: 7,    fr: 'experts membres de l’IFEI',                   en: 'experts, IFEI members' },
  { value: 1,    fr: 'expert membre de la CEF',                     en: 'expert member of the CEF' },

  { value: 4, fr: 'M€ HT de chiffre d’affaires annuel', en: 'M€ annual turnover (excl. tax)' },
  { value: 1800, fr: 'expertises/an',                               en: 'appraisals/year' },
];

/* ==========================================================
   SEO HOMEPAGE
   ========================================================== */
const HOME_SEO = {
  fr: {
    title: 'Expertise immobilière nationale – Valeur vénale & locative certifiée',
    description:
      'Experts agréés en évaluation immobilière sur tout le territoire. Rapports conformes à la Charte de l’expertise et aux standards RICS.',
    schema: {
      serviceType: 'Expertise immobilière',
      provider: 'Experts immobiliers agréés',
      areaServed: 'France métropolitaine et Outre-mer'
    },
    urlCible: '/expertise-immobiliere-nationale'
  },
  en: {
    title: 'National real-estate appraisal – Certified market & rental value',
    description:
      'Accredited experts providing real-estate appraisal across France. Reports compliant with the French Valuation Charter and RICS standards.',
    schema: {
      serviceType: 'Real-estate appraisal',
      provider: 'Accredited valuation experts',
      areaServed: 'Metropolitan France and Overseas'
    },
    urlCible: '/en/expertise-immobiliere-nationale'
  }
} as const;

/* ====== FAQ Accueil ====== */
const HOME_FAQ_FR: FaqItem[] = [
  { q: 'Qu’est-ce qu’une expertise immobilière certifiée ?', a: 'Une expertise immobilière certifiée consiste à déterminer la valeur vénale ou locative d’un bien immobilier à partir de méthodes reconnues (comparaison, rendement, coût de remplacement, etc.). Elle est réalisée par un expert agréé selon la Charte de l’expertise et les standards RICS, et a une valeur juridique opposable.' },
  { q: 'Dans quels cas demander une expertise immobilière ?', a: 'Succession/partage, divorce/donation, financement bancaire/garantie hypothécaire, litige locatif, expropriation, arbitrage patrimonial. Le rapport d’expertise est objectif, documenté et reconnu par banques, notaires, tribunaux et assurances.' },
  { q: 'Quelle est la différence entre valeur vénale et valeur locative ?', a: 'La valeur vénale est le prix estimé en cas de vente dans des conditions normales de marché. La valeur locative correspond au loyer annuel estimé selon les caractéristiques du bien et le marché local.' },
  { q: 'Comment se déroule une expertise immobilière ?', a: 'Analyse du bien (surface, état, localisation, contraintes), étude des références de marché, application de méthodes normalisées (comparaison, rendement, DCF, sol & construction) et rédaction d’un rapport détaillant méthodologie et conclusion chifrée.' },
  { q: 'Pourquoi faire appel à un expert agréé plutôt qu’à une agence immobilière ?', a: 'L’expert agréé agit en indépendance, engage sa responsabilité professionnelle et produit des rapports opposables (Charte/RICS). Une agence délivre une estimation indicative à visée commerciale.' },
  { q: 'L’expertise immobilière est-elle reconnue par les banques et les tribunaux ?', a: 'Oui, une expertise réalisée par un expert agréé RICS ou membre de l’IFEI est reconnue par les établissements financiers, juridictions civiles et administrations fiscales.' }
];

const HOME_FAQ_EN: FaqItem[] = [
  { q: 'What is a certified real-estate appraisal?', a: 'A certified appraisal determines market or rental value using recognized methods (comparables, income/cap rate, replacement cost, etc.). It is performed by an accredited expert under the French Valuation Charter and RICS standards and has legal standing.' },
  { q: 'When should I request an appraisal?', a: 'Inheritance/partition, divorce/donation, bank financing/mortgage collateral, rental disputes, expropriation, estate rebalancing. The report is objective, documented and recognized by banks, notaries, courts and insurers.' },
  { q: 'Market value vs. rental value — what’s the difference?', a: 'Market value is the estimated sale price under normal conditions. Rental value is the estimated annual rent per the asset’s features and local market.' },
  { q: 'How does an appraisal proceed?', a: 'Asset analysis, market references, application of normalized methods (comparables, yield/DCF, land & building), and a reasoned report detailing methodology and a quantified conclusion.' },
  { q: 'Why use an accredited expert rather than a broker?', a: 'The accredited expert acts independently, is professionally liable and delivers legally enforceable reports (Charter/RICS). A broker provides indicative, commercial estimates.' },
  { q: 'Are appraisals recognized by banks and courts?', a: 'Yes. Appraisals by RICS-accredited or IFEI-member experts are recognized by financial institutions, civil courts and tax authorities.' }
];

/* ========================================================== */

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [CommonModule, RouterModule, AlignFirstWordDirective, ImgFastDirective],
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.scss']
})
export class HomepageComponent implements OnInit, AfterViewInit, OnDestroy {
  acf: any = {};

  s(v: unknown): string { return v == null ? '' : '' + v; }

  /* ---------- SEO configurable ---------- */
  siteUrl = environment.siteUrl;            // ← vient des env
  canonicalPath   = '/';
  canonicalPathEn = '/en/';
  socialImage = '/assets/og/og-default.jpg';
  orgName = 'Groupe ABC';

  /* ---------- Langue (source = Weglot si présent) ---------- */
  private currentLang: 'fr' | 'en' = 'fr';
  private weglotOff?: () => void;

  /* ---------- HERO ---------- */
  heroSlides: Slide[] = [];
  heroIndex = 0;
  autoplayMs = 5000;
  private autoplayRef: any = null;

  // Refs Hero
  @ViewChild('heroBg') heroBgRef!: ElementRef<HTMLElement>;
  @ViewChildren('heroLayer') heroLayerEls!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('heroTitle') heroTitleEl!: ElementRef<HTMLElement>;
  @ViewChild('heroSubtitle') heroSubtitleEl!: ElementRef<HTMLElement>;

  // Flags
  private viewReady = false;
  private heroDataReady = false;
  private heroIntroDone = false;
  private prefersReduced = false;

  /* swipe hero */
  private pointerStartX: number | null = null;
  private swipeThreshold = 40;

  /* ---------- KEY FIGURES ---------- */
  keyFigures: KeyFigure[] = [];
  @ViewChildren('kfItem') kfItems!: QueryList<ElementRef<HTMLLIElement>>;
  maxValueCh = 6;

  /* ---------- IDENTITY / WHAT-HOW / DOWNLOAD ---------- */
  identity: Identity = { whoTitle: '', whoHtml: '', whereTitle: '', whereMap: '', whereItems: [] };
  whereItems: string[] = [];
  whereOpen = false;
  toggleWhere(): void { this.whereOpen = !this.whereOpen; }

  // Team routes
  private TEAM_ROUTE_FR = '/experts-immobiliers-agrees';
  private TEAM_ROUTE_EN = '/en/experts-immobiliers-agrees';

  private readonly REGION_LABEL_TO_KEY: Record<string, string> = {
    'Grand Paris': 'idf',
    'Grand Ouest': 'grand-ouest',
    'Rhône-Alpes': 'rhone-alpes',
    "Côte d'Azur": 'cote-azur',
    'Sud-Ouest': 'sud-ouest',
    'Grand Est': 'grand-est',
    'Antilles & Guyane': 'antilles-guyane',
    "Île de la Réunion & Mayotte": 'reunion-mayotte',
  };

  whatHow: WhatHow | null = null;
  presentation: Presentation = { text1: '', text2: '', file: null };

  /* ---------- CONTEXTES ---------- */
  contexts: ExpertiseContext | null = null;

  /* ---------- CLIENTS ---------- */
  clients: Clients | null = null;

  /* ---------- TEAM ---------- */
  @ViewChild('teamTitle') teamTitleEl!: ElementRef<HTMLElement>;
  @ViewChildren('teamCard') teamCardEls!: QueryList<ElementRef<HTMLElement>>;

  teamTitle = '';
  teamMembers: TeamMember[] = [];
  teamPages: TeamMember[][] = [];
  teamPageIndex = 0;
  private teamAutoplayRef: any = null;
  teamAutoplayMs = 5000;
  teamAutoplayStoppedByUser = false;

  private resolvedPhotos = new WeakMap<TeamMember, string>();
  private preparingPageIndex: number | null = null;

  defaultPortrait = '/assets/fallbacks/portrait-placeholder.svg';

  /* NEWS */
  news: News | null = null;

  get currentSlide(): Slide | undefined { return this.heroSlides[this.heroIndex]; }

  // DI
  private wp = inject(WordpressService);
  private seo = inject(SeoService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private navSub?: Subscription;

  private faq = inject(FaqService);

  // SSR helpers
  private platformId = inject(PLATFORM_ID);
  private doc = inject(DOCUMENT);

  // GSAP (lazy, browser-only)
  private gsap: any | null = null;
  private ScrollTrigger: any | null = null;

  // Titre sur 2 lignes
  teamTitleLine1 = 'Une équipe';
  teamTitleLine2 = 'de 8 experts à vos côtés';

  /* ====================== Helpers ====================== */
  private isBrowser(): boolean { return isPlatformBrowser(this.platformId); }

  private async setupGsap(): Promise<void> {
    if (!this.isBrowser()) return;
    if (this.gsap) return;
    try {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      this.gsap = gsap;
      this.ScrollTrigger = ScrollTrigger;
      try { this.gsap.registerPlugin(this.ScrollTrigger); } catch {}
    } catch { /* ignore in SSR or if import fails */ }
  }

  /* ==================================================== */
  /*                        LIFECYCLE                     */
  /* ==================================================== */
  ngOnInit(): void {
    // Langue initiale (Weglot / <html lang> / URL)
    this.currentLang = this.detectInitialLang();

    // 1) SEO de base IMMEDIAT (utile au tout 1er rendu SSR)
    const isEN0 = this.isEnglish();
    const canon0 = this.normalizeUrl(this.siteUrl, isEN0 ? this.canonicalPathEn : this.canonicalPath);
    this.seo.update({
      title: isEN0 ? HOME_SEO.en.title : HOME_SEO.fr.title,
      description: isEN0 ? HOME_SEO.en.description : HOME_SEO.fr.description,
      robots: 'index,follow',
      canonical: canon0,
      alternates: [
        { lang: 'fr',        href: this.normalizeUrl(this.siteUrl, this.canonicalPath) },
        { lang: 'en',        href: this.normalizeUrl(this.siteUrl, this.canonicalPathEn) },
        { lang: 'x-default', href: this.normalizeUrl(this.siteUrl, this.canonicalPath) },
      ],
      image: this.absUrl(this.socialImage, this.siteUrl),
      type: 'website',
      lang: isEN0 ? 'en' : 'fr',
      locale: isEN0 ? 'en_US' : 'fr_FR',
      localeAlt: isEN0 ? ['fr_FR'] : ['en_US'],
    });

    // 2) FAQ par défaut
    this.faq.set(HOME_FAQ_FR, HOME_FAQ_EN);

    // 3) Données WP
    this.wp.getHomepageData().subscribe(acf => {
      this.acf = acf;

      this.extractHero();
      this.preloadHeroImages();       // garde via isBrowser()
      this.applySeoFromHero();        // enrichit SEO (JSON-LD, image résolue…)
      this.heroDataReady = true;
      this.tryInitHeroIntro();

      // Sections
      this.extractKeyFigures();
      this.extractIdentity();
      this.extractWhatHowAndPresentation();
      this.extractExpertiseContext();
      this.extractClientsSection();

      // Team + News
      this.extractTeamSection();
      this.ensureTeamPageReady(this.teamPageIndex).then(() => {});
      if (this.isBrowser() && !this.teamAutoplayStoppedByUser) this.startTeamAutoplay();
      this.loadFeaturedNews();

      this.cdr.detectChanges();
      this.wgRefreshTick();

      if (this.isBrowser()) setTimeout(() => { this.bindScrollAnimations(); }, 0);
    });

    // Ré-injecte SEO/language lors des navigations client
    this.navSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        this.currentLang = this.detectInitialLang();
        this.extractHero();
        this.applySeoFromHero();
        this.extractKeyFigures();
        this.cdr.detectChanges();
      });

    if (this.isBrowser()) {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      // Préparer GSAP côté navigateur
      this.setupGsap();
    }
  }

  ngAfterViewInit(): void {
    if (this.isBrowser()) {
      // Observer chiffres (si disponible)
      if (typeof (window as any).IntersectionObserver !== 'undefined') {
        const io = new IntersectionObserver(entries => {
          for (const e of entries) {
            if (e.isIntersecting) {
              const idx = Number((e.target as HTMLElement).dataset['index']);
              this.playFigure(idx);
              io.unobserve(e.target);
            }
          }
        }, { threshold: 0.25 });

        this.kfItems?.changes?.subscribe(() => {
          this.kfItems.forEach(el => io.observe(el.nativeElement));
        });
        setTimeout(() => this.kfItems.forEach(el => io.observe(el.nativeElement)));
      }

      this.viewReady = true;
      this.tryInitHeroIntro();

      // Weglot rescans
      this.wgAddNodeDouble(document.getElementById('hero'));
      this.wgAddNodeDouble(document.getElementById('key-figures'));

      // Écoute Weglot (initialized / languageChanged)
      this.bindWeglotLangEvents();

      // GSAP prêt → bind animations
      this.setupGsap().then(() => setTimeout(() => { this.bindScrollAnimations(); }, 0));
    }
  }

  ngOnDestroy(): void {
    this.clearAutoplay();
    this.clearTeamAutoplay();
    this.navSub?.unsubscribe();
    if (this.isBrowser()) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    this.weglotOff?.();
    try { this.ScrollTrigger?.getAll?.().forEach((t: any) => t.kill()); } catch {}
    try { this.gsap?.globalTimeline?.clear?.(); } catch {}
  }

  /* ==================================================== */
  /*                         HERO                         */
  /* ==================================================== */

  private isEnglish(): boolean {
    return this.currentLang === 'en';
  }

  private detectInitialLang(): 'fr' | 'en' {
    // 1) Weglot si dispo
    if (this.isBrowser()) {
      try {
        const wg: any = (window as any).Weglot;
        const l = wg?.getCurrentLang?.();
        if (l === 'en' || l === 'fr') return l;
      } catch {}
    }

    // 2) <html lang="...">
    try {
      const htmlLang = (this.doc?.documentElement?.lang || '').toLowerCase();
      if (htmlLang.startsWith('en')) return 'en';
      if (htmlLang.startsWith('fr')) return 'fr';
    } catch {}

    // 3) URL fallback
    const url = this.router?.url || '/';
    if (url.startsWith('/en/')) return 'en';
    return 'fr';
  }

  private bindWeglotLangEvents(): void {
    if (!this.isBrowser()) return;
    try {
      const wg: any = (window as any).Weglot;
      if (!wg?.on || !wg?.getCurrentLang) return;

      const onChanged = (lang: string) => {
        const next: 'fr' | 'en' = lang === 'en' ? 'en' : 'fr';
        if (next === this.currentLang) return;
        this.currentLang = next;

        // Rebuild sections dépendantes de la langue + SEO
        this.extractHero();
        this.extractKeyFigures();
        this.applySeoFromHero();
        this.cdr.detectChanges();
        this.wgRefreshTick();
      };

      wg.on('initialized', () => onChanged(wg.getCurrentLang?.()));
      wg.on('languageChanged', (newLang: string) => onChanged(newLang));

      // unbind helper
      this.weglotOff = () => {
        try { wg?.off?.('initialized', onChanged); } catch {}
        try { wg?.off?.('languageChanged', onChanged); } catch {}
      };
    } catch { /* no-op */ }
  }

  private extractHero(): void {
    const h = this.acf?.hero_section || {};
    const bgs = [h.hero_background_1, h.hero_background_2, h.hero_background_3].filter(Boolean);
    if (!bgs.length && (h.hero_background ?? null)) bgs.push(h.hero_background);

    const langKey = this.isEnglish() ? 'en' : 'fr';
    const T = HERO_TEXT[langKey];
    const n = Math.max(1, Math.min(bgs.length || 1, T.titles.length, T.subtitles.length));

    const slides: Slide[] = [];
    for (let i = 0; i < n; i++) {
      slides.push({
        title: T.titles[i],
        subtitle: T.subtitles[i],
        bg: bgs[i] ?? bgs[0] ?? h.hero_background ?? '/assets/fallbacks/hero-placeholder.jpg'
      });
    }
    if (!slides.length) {
      slides.push({
        title: T.titles[0],
        subtitle: T.subtitles[0],
        bg: '/assets/fallbacks/hero-placeholder.jpg'
      });
    }
    this.heroSlides = slides;
    this.heroIndex = 0;
  }

  private async preloadHeroImages(): Promise<void> {
    if (!this.isBrowser()) return;
    for (const s of this.heroSlides) {
      const url = await this.resolveMedia(s.bg);
      if (url) {
        const img = new Image();
        (img as any).decoding = 'async';
        (img as any).loading = 'eager';
        img.src = url;
      }
    }
  }

  private tryInitHeroIntro(): void {
    if (!this.isBrowser()) return;
    if (this.heroIntroDone || !this.viewReady || !this.heroDataReady) return;
    queueMicrotask(() => setTimeout(() => this.initHeroIntroNow(), 0));
  }

  private initHeroIntroNow(): void {
    if (!this.isBrowser()) return;
    if (this.heroIntroDone) return;

    this.prefersReduced = typeof window !== 'undefined'
      ? (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false)
      : false;

    const bg      = this.heroBgRef?.nativeElement;
    const layers  = this.heroLayerEls?.toArray().map(r => r.nativeElement) ?? [];
    const titleEl = this.heroTitleEl?.nativeElement;
    const subEl   = this.heroSubtitleEl?.nativeElement;

    if (layers.length) {
      if (this.gsap) {
        layers.forEach((el, i) => this.gsap.set(el, { opacity: i === this.heroIndex ? 1 : 0 }));
      } else {
        layers.forEach((el, i) => el.style.opacity = (i === this.heroIndex ? '1' : '0'));
      }
      if (bg) bg.classList.add('is-ready');
    }

    if (this.gsap) {
      if (titleEl) this.gsap.set(titleEl, { autoAlpha: 0, y: 16, willChange: 'transform,opacity' });
      if (subEl)   this.gsap.set(subEl,   { autoAlpha: 0, y: 12, willChange: 'transform,opacity' });
    }

    const heroEl = document.getElementById('hero');
    const dots = heroEl ? Array.from(heroEl.querySelectorAll<HTMLButtonElement>('.hero-dots .hero-dot')) : [];
    if (this.gsap && dots.length) this.gsap.set(dots, { autoAlpha: 0, y: 10, willChange: 'transform,opacity' });

    const DUR_T = this.prefersReduced ? 0.001 : 2.5;
    const DUR_S = this.prefersReduced ? 0.001 : 1;

    this.pauseAutoplay();

    if (this.gsap) {
      const tl = this.gsap.timeline({
        defaults: { ease: 'power3.out' },
        onComplete: () => {
          this.heroIntroDone = true;
          if (titleEl) this.gsap.set(titleEl, { clearProps: 'willChange' });
          if (subEl)   this.gsap.set(subEl,   { clearProps: 'willChange' });
          if (dots.length) this.gsap.set(dots, { clearProps: 'willChange' });
          this.resumeAutoplay();
        }
      });

      tl.to(titleEl, { autoAlpha: 1, y: 0, duration: DUR_T }, 0.5)
        .to(subEl,   { autoAlpha: 1, y: 0, duration: DUR_S }, 0.8)
        .to(dots,    { autoAlpha: 1, y: 0, duration: 0.5, stagger: { each: 0.08, from: 'start' } }, 1.5);
    } else {
      // Fallback sans GSAP
      if (titleEl) titleEl.style.opacity = '1';
      if (subEl)   subEl.style.opacity = '1';
      this.heroIntroDone = true;
      this.resumeAutoplay();
    }

    if (this.prefersReduced) {
      this.heroIntroDone = true;
      this.resumeAutoplay();
    }
  }

  goTo(i: number): void {
    if (!this.heroSlides.length) return;
    const len = this.heroSlides.length;
    this.heroIndex = ((i % len) + len) % len;
    this.wgAddNodeDouble(document.getElementById('hero'));
  }
  next(): void { this.goTo(this.heroIndex + 1); }
  prev(): void { this.goTo(this.heroIndex - 1); }

  startAutoplay(): void {
    if (!this.isBrowser()) return;
    this.clearAutoplay();
    if (this.heroSlides.length > 1) {
      this.autoplayRef = setInterval(() => this.next(), this.autoplayMs);
    }
  }
  pauseAutoplay(): void { if (!this.isBrowser()) return; this.clearAutoplay(); }
  resumeAutoplay(): void {
    if (!this.isBrowser()) return;
    if (document.visibilityState === 'visible' && this.heroSlides.length > 1) {
      this.startAutoplay();
    }
  }
  private clearAutoplay(): void {
    if (this.autoplayRef) {
      clearInterval(this.autoplayRef);
      this.autoplayRef = null;
    }
  }
  private handleVisibilityChange = () => {
    if (!this.isBrowser()) return;
    if (document.visibilityState === 'hidden') {
      this.pauseAutoplay();
      this.clearTeamAutoplay();
    } else {
      this.resumeAutoplay();
      if (!this.teamAutoplayStoppedByUser) this.startTeamAutoplay();
    }
  };

  onKeydown(evt: KeyboardEvent): void {
    if (!this.isBrowser()) return;
    if (this.heroSlides.length < 2) return;
    if (evt.key === 'ArrowRight') { this.pauseAutoplay(); this.next(); }
    else if (evt.key === 'ArrowLeft') { this.pauseAutoplay(); this.prev(); }
  }
  onPointerDown(evt: PointerEvent): void { if (this.isBrowser()) this.pointerStartX = evt.clientX; }
  onPointerUp(evt: PointerEvent): void {
    if (!this.isBrowser()) return;
    if (this.pointerStartX == null) return;
    const dx = evt.clientX - this.pointerStartX;
    this.pointerStartX = null;
    if (Math.abs(dx) > this.swipeThreshold) {
      this.pauseAutoplay();
      if (dx < 0) this.next(); else this.prev();
    }
  }

  /* ==================================================== */
  /*               LISTE « OÙ ? » CLIQUABLE               */
  /* ==================================================== */

  private norm(s: string): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private regionKeyFromLabel(label: string): string {
    const exact = this.REGION_LABEL_TO_KEY[(label || '').trim()];
    if (exact) return exact;

    const n = this.norm(label);
    if (n.includes('paris') || n.includes('ile-de-france')) return 'idf';
    if (n.includes('grand ouest'))                          return 'grand-ouest';
    if (n.includes('rhone') || n.includes('auvergne'))      return 'rhone-alpes';
    if (n.includes('cote d azur') || n.includes('sud-est')) return 'cote-azur';
    if (n.includes('sud-ouest'))                            return 'sud-ouest';
    if (n.includes('grand est') || n.includes('nord & est') || n.includes('nord et est')) return 'grand-est';
    if (n.includes('antilles') || n.includes('guyane'))     return 'antilles-guyane';
    if (n.includes('reunion') || n.includes('mayotte'))     return 'reunion-mayotte';
    return n.replace(/[^a-z0-9- ]/g,'').replace(/\s+/g,'-');
  }

  /** Appelée par le `(click)` sur chaque item « Où ? » */
  openRegion(label: string): void {
    const key  = this.regionKeyFromLabel(label);
    const path = this.isEnglish() ? this.TEAM_ROUTE_EN : this.TEAM_ROUTE_FR;
    this.router.navigate([path], { queryParams: { region: key } });
  }

  /* ==================================================== */
  /*                     KEY FIGURES (fixes)              */
  /* ==================================================== */

  private extractKeyFigures(): void {
    const isEN = this.isEnglish();

    this.keyFigures = KEY_FIGURES_STATIC.map(k => {
      const value = k.value;
      const label = isEN ? k.en : k.fr;
      return {
        value,
        label,
        labelBis: '',
        fullLabel: label,
        display: '',
        typed: label,
        digits: String(value).length,
        played: false
      } as KeyFigure;
    });

    const widths = KEY_FIGURES_STATIC.map(k => {
      const s = String(k.value);
      const hasDecimal = /[,.]/.test(s);
      return Math.max(s.length + (hasDecimal ? 2 : 0), 1);
    });
    this.maxValueCh = Math.max(6, ...(widths.length ? widths : [6]));
  }

  private playFigure(index: number): void {
    if (!this.isBrowser()) return;
    const f = this.keyFigures[index];
    if (!f || f.played) return;
    f.played = true;

    const target = f.value;
    const dur = 4000;
    const start = performance.now();

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const p = easeOutCubic(t);

      f.display = String(Math.round(target * p)) || '';

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        f.display = String(target);
      }
    };

    requestAnimationFrame(step);
  }

  /* ==================================================== */
  /*                 (ex) lecture ACF & co                */
  /* ==================================================== */

  private extractIdentity(): void {
    const id = this.acf?.identity_section || {};
    this.identity = {
      whoTitle: id.who_title || 'Qui ?',
      whoHtml: id.who_text || '',
      whereTitle: id.where_title || 'Où ?',
      whereMap: id.where_map,
      whereItems: [
        id.where_item_1, id.where_item_2, id.where_item_3, id.where_item_4,
        id.where_item_5, id.where_item_6, id.where_item_7, id.where_item_8
      ].filter(Boolean)
    };
    this.whereItems = this.identity.whereItems;
  }

  /* ---------- SEO + JSON-LD (inclut FAQ) ---------- */
  private async applySeoFromHero(): Promise<void> {
    const first = this.heroSlides[0] || { title: '', subtitle: '', bg: '' };

    const isEN    = this.isEnglish();
    const canonPath = isEN ? this.canonicalPathEn : this.canonicalPath;
    const canonical = this.normalizeUrl(this.siteUrl, canonPath);
    const lang      = isEN ? 'en'    : 'fr';
    const locale    = isEN ? 'en_US' : 'fr_FR';
    const localeAlt = isEN ? ['fr_FR'] : ['en_US'];

    const altFR = this.normalizeUrl(this.siteUrl, this.canonicalPath);
    const altEN = this.normalizeUrl(this.siteUrl, this.canonicalPathEn);
    const alternates = [
      { lang: 'fr',        href: altFR },
      { lang: 'en',        href: altEN },
      { lang: 'x-default', href: altFR }
    ];

    const M = isEN ? HOME_SEO.en : HOME_SEO.fr;
    const title = (M.title || first.title || '').trim();
    const description = (M.description || first.subtitle || '').trim();

    const rawImgPref = first.bg || this.socialImage;
    const resolved   = await this.resolveMedia(rawImgPref as any);
    const ogAbs      = this.absUrl(resolved || this.socialImage, this.siteUrl);

    // JSON-LD
    const service = {
      '@type': 'Service',
      'serviceType': M.schema.serviceType,
      'provider': M.schema.provider,
      'areaServed': M.schema.areaServed
    };

    const faqArray = (isEN ? HOME_FAQ_EN : HOME_FAQ_FR).map(x => ({
      '@type': 'Question',
      'name': x.q,
      'acceptedAnswer': { '@type': 'Answer', 'text': x.a }
    }));
    const faq = { '@type': 'FAQPage', 'mainEntity': faqArray };

    const siteId = this.siteUrl.replace(/\/+$/, '') + '#website';
    const orgId  = this.siteUrl.replace(/\/+$/, '') + '#organization';

    const website = {
      '@type': 'WebSite', '@id': siteId, url: this.siteUrl, name: this.orgName,
      inLanguage: isEN ? 'en-US' : 'fr-FR',
      potentialAction: { '@type': 'SearchAction', target: `${this.siteUrl}/?s={search_term_string}`, 'query-input': 'required name=search_term_string' }
    };

    const organization = {
      '@type': 'Organization', '@id': orgId, name: this.orgName, url: this.siteUrl, logo: ogAbs
    };

    const webpage = {
      '@type': 'WebPage', '@id': canonical + '#webpage', url: canonical, name: title, description,
      inLanguage: isEN ? 'en-US' : 'fr-FR', isPartOf: { '@id': siteId }, primaryImageOfPage: ogAbs
    };

    const breadcrumb = { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: isEN ? 'Home' : 'Accueil', item: canonical }] };

    this.seo.update({
      lang, locale, localeAlt, title, description,
      canonical, robots: 'index,follow',
      image: ogAbs, imageAlt: `${this.orgName} – ${isEN ? 'Homepage' : 'Accueil'}`,
      type: 'website',
      alternates,
      jsonLd: { '@context': 'https://schema.org', '@graph': [website, organization, webpage, breadcrumb, service, faq] }
    });
  }

  private extractWhatHowAndPresentation(): void {
    const id = this.acf?.identity_section || {};
    const whatItems = [ id.what_item_1, id.what_item_2, id.what_item_3 ].filter(Boolean) as string[];
    const howItems = [
      id.how_item_1, id.how_item_2, id.how_item_3, id.how_item_4,
      id.how_item_5, id.how_item_6, id.how_item_7, id.how_item_8
    ].filter(Boolean) as string[];
    this.whatHow = {
      whatTitle: id.what_title || 'Quoi ?',
      whatItems,
      howTitle: id.how_title || 'Comment ?',
      howItems
    };
    const dl = this.acf?.presentation_download_section || {};
    const fileUrl =
      (typeof dl.presentation_file === 'string' && dl.presentation_file) ||
      (dl.presentation_file?.url ?? null) || null;
    this.presentation = {
      text1: dl.presentation_button_text_1 || 'Télécharger la présentation du',
      text2: dl.presentation_button_text_2 || 'Groupe ABC',
      file: fileUrl
    };
  }

  private bindScrollAnimations(): void {
    if (!this.isBrowser() || !this.gsap || !this.ScrollTrigger) return;
    // … votre logique d’animations au scroll ici, en gardant les sélecteurs existants
  }

  private loadFeaturedNews(): void {
    this.wp.getHomepageFeaturedNews(2).subscribe((items: any[]) => {
      const mapped: NewsItem[] = (items || []).map((it: any) => {
        const themeKey = this.toThemeKey(it?.theme);
        const slug = it?.slug || this.slugFromLink(it?.link);
        return { ...it, themeKey, slug };
      });
      this.news = mapped.length ? { title: 'Actualités', items: mapped } : null;
      this.cdr.detectChanges();
      this.wgRefreshTick();
    });
  }

  private extractExpertiseContext(): void {
    const ctx = this.acf?.expertise_contact_section || {};
    const items: ContextItem[] = [];
    for (let i = 1; i <= 8; i++) {
      const icon = ctx[`context_icon_${i}`];
      const label = ctx[`context_label_${i}`];
      if (label) items.push({ icon: icon ?? '', label });
    }
    this.contexts = { title: ctx.context_title || 'Contextes d’intervention', items };
  }

  private extractClientsSection(): void {
    const c = this.acf?.clients_section || {};
    const items = [
      c.client_item_1, c.client_item_2, c.client_item_3,
      c.client_item_4, c.client_item_5, c.client_item_6
    ].filter(Boolean) as string[];
    this.clients = (c.clients_title || items.length)
      ? { icon: (c.clients_icon ?? ''), title: c.clients_title || 'Nos clients', items }
      : null;
  }

  /* ==================================================== */
  /*                           TEAM                       */
  /* ==================================================== */

  private extractTeamSection(): void {
    const t = this.acf?.team_section || {};

    this.teamTitle = t.team_title_1 || 'Une équipe de 8 experts à vos côtés';
    this.setTeamTitleTwoLines(this.teamTitle);

    const tmp: TeamMember[] = [];
    for (let i = 1; i <= 8; i++) {
      const photo = t[`team_photo_${i}`];
      const name = (t[`team_name_${i}`] || '').toString().trim() || '';
      const area = t[`team_area_${i}`] || '';
      const jobHtml = t[`team_job_${i}`] || '';

      if (photo || name || area || jobHtml) {
        let nameFirst = name, nameLast = '';
        const parts = name.split(/\s+/);
        if (parts.length > 1) {
          nameFirst = parts.slice(0, -1).join(' ');
          nameLast  = parts.slice(-1)[0];
        }
        tmp.push({ photo: photo ?? '', nameFirst, nameLast, area, jobHtml });
      }
    }

    this.teamMembers = this.shuffleArray(tmp);

    this.teamPages = [];
    for (let i = 0; i < this.teamMembers.length; i += 2) {
      this.teamPages.push(this.teamMembers.slice(i, i + 2));
    }

    if (this.teamPages.length) {
      this.teamPageIndex = Math.floor(Math.random() * this.teamPages.length);
      this.ensureTeamPageReady(this.teamPageIndex);
    }
  }

  teamPhotoUrl(m: TeamMember): string {
    return this.resolvedPhotos.get(m) || this.defaultPortrait;
  }

  onTeamImgError(e: Event): void {
    const img = e.target as HTMLImageElement;
    if (img && img.src !== this.defaultPortrait) {
      img.src = this.defaultPortrait;
    }
  }

  async goTeamTo(i: number): Promise<void> {
    if (!this.teamPages.length) return;
    const len = this.teamPages.length;
    const target = ((i % len) + len) % len;

    this.stopTeamAutoplayByUser();

    await this.ensureTeamPageReady(target);
    this.teamPageIndex = target;

    this.cdr.detectChanges();
    this.wgRefreshTick();
  }
  nextTeam(): void { this.goTeamTo(this.teamPageIndex + 1); }
  prevTeam(): void { this.goTeamTo(this.teamPageIndex - 1); }

  private startTeamAutoplay(): void {
    if (!this.isBrowser()) return;
    this.clearTeamAutoplay();
    if (this.teamPages.length < 2 || this.teamAutoplayStoppedByUser) return;

    this.teamAutoplayRef = setInterval(() => {
      (async () => {
        const len = this.teamPages.length;
        if (len < 2) return;

        let next = this.teamPageIndex;
        while (next === this.teamPageIndex) {
          next = Math.floor(Math.random() * len);
        }

        await this.ensureTeamPageReady(next);
        this.teamPageIndex = next;

        this.cdr.detectChanges();
        this.wgRefreshTick();
      })();
    }, this.teamAutoplayMs);
  }
  private clearTeamAutoplay(): void {
    if (this.teamAutoplayRef) {
      clearInterval(this.teamAutoplayRef);
      this.teamAutoplayRef = null;
    }
  }
  private stopTeamAutoplayByUser(): void {
    this.teamAutoplayStoppedByUser = true;
    this.clearTeamAutoplay();
  }

  private async ensureTeamPageReady(pageIndex: number): Promise<void> {
    this.preparingPageIndex = pageIndex;
    const page = this.teamPages[pageIndex] || [];
    await Promise.all(page.map(m => this.prepareMemberPhoto(m)));
    this.preparingPageIndex = null;
  }

  private async prepareMemberPhoto(m: TeamMember): Promise<void> {
    if (this.resolvedPhotos.has(m)) return;
    const url = await this.resolveMedia(m.photo);
    const finalUrl = url || this.defaultPortrait;
    await this.preload(finalUrl);
    this.resolvedPhotos.set(m, finalUrl);
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
    if (!this.isBrowser() || !src) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      (img as any).decoding = 'async';
      (img as any).loading = 'eager';
      img.src = src;
    });
  }

  /* ==================================================== */
  /*                    Utils divers                      */
  /* ==================================================== */
  private shuffleArray<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private setTeamTitleTwoLines(full: string | undefined): void {
    const s = (full || '').replace(/\s+/g, ' ').trim();
    if (s.includes('\n')) {
      const [l1, l2] = s.split('\n');
      this.teamTitleLine1 = l1?.trim() || this.teamTitleLine1;
      this.teamTitleLine2 = l2?.trim() || this.teamTitleLine2;
      return;
    }
    if (s.toLowerCase().startsWith('une équipe')) {
      const rest = s.slice('une équipe'.length).trim();
      if (rest) this.teamTitleLine2 = rest;
    }
  }

  private toThemeKey(raw?: string): ThemeKey {
    const s = (raw || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if (s.includes('march'))   return 'marche';
    if (s.includes('jurid'))   return 'juridique';
    if (s.includes('expert'))  return 'expertise';
    return 'autre';
  }

  themeClass(k?: ThemeKey): string { return `theme-${k || 'autre'}`; }

  private slugFromLink(link?: string): string | undefined {
    if (!link) return undefined;
    try {
      const u = new URL(link, (this.doc as any)?.defaultView?.location?.origin || this.siteUrl);
      const parts = u.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || undefined;
    } catch { return undefined; }
  }

  private normalizeUrl(base: string, path: string): string {
    const b = base.endsWith('/') ? base.slice(0, -1) : base;
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${b}${p}`;
  }

  private absUrl(url: string, origin: string): string {
    if (!url) return '';
    try {
      if (/^https?:\/\//i.test(url)) return url;
      if (/^\/\//.test(url)) return 'https:' + url;
      const o = origin.endsWith('/') ? origin.slice(0, -1) : origin;
      return url.startsWith('/') ? o + url : `${o}/${url}`;
    } catch { return url; }
  }

  private currentPath(): string {
    if (this.isBrowser()) {
      try { return (this.doc as any)?.defaultView?.location?.pathname || '/'; } catch { /* noop */ }
    }
    return this.router?.url || '/';
  }

  trackByIndex(i: number): number { return i; }

  /* ==================================================== */
  /*                 Weglot helpers (général)             */
  /* ==================================================== */
  private wgRefreshTick(): void {
    if (!this.isBrowser()) return;
    setTimeout(() => {
      const wg: any = (window as any).Weglot;
      const host = document.querySelector('app-root')
             || document.querySelector('main')
             || document.body;
      wg?.addNodes?.([host]);
    }, 0);
  }

  private wgAddNode(target?: Element | null): void {
    if (!this.isBrowser()) return;
    setTimeout(() => {
      const wg: any = (window as any).Weglot;
      const el = target || document.body;
      wg?.addNodes?.([el]);
    }, 0);
  }

  private wgAddNodeDouble(target?: Element | null): void {
    if (!this.isBrowser()) return;
    this.wgAddNode(target);
    setTimeout(() => this.wgAddNode(target), 120);
  }
}
