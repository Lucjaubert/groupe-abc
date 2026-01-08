import {
  Component,
  OnDestroy,
  OnInit,
  AfterViewInit,
  inject,
  ViewChildren,
  QueryList,
  ElementRef,
  ViewChild,
  ChangeDetectorRef,
  PLATFORM_ID,
} from '@angular/core';
import {
  CommonModule,
  DOCUMENT,
  isPlatformBrowser,
} from '@angular/common';
import {
  RouterModule,
  Router,
  NavigationEnd,
} from '@angular/router';
import { firstValueFrom, filter, Subscription } from 'rxjs';

import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { getSeoForRoute } from '../../config/seo.routes';

import { AlignFirstWordDirective } from '../../shared/directives/align-first-word.directive';
import { ImgFastDirective } from '../../directives/img-fast.directive';
import { FaqService } from '../../services/faq.service';
import { getFaqForRoute, FaqItem } from '../../config/faq.routes';

/* ===== Types ===== */
type Slide = { title: string; subtitle: string; bg: string | number };

type Identity = {
  whoTitle: string;
  whoHtml: string;
  whereTitle: string;
  whereMap?: string | number;
  whereItems: string[];
};

type WhatHow = {
  whatTitle: string;
  whatItems: string[];
  howTitle: string;
  howItems: string[];
};
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
  logo?: string | number;
  firm?: string;
  theme?: string;
  authorDate?: string;
  title?: string;
  html?: string;
  link?: string;
  id?: number | string;
  slug?: string;
  themeKey?: ThemeKey;
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
    titles: ['Groupe ABC.', 'Groupe ABC.', 'Groupe ABC.'],
    subtitles: [
      'Au plus près de la valeur de votre bien',
      'L’Expertise immobilière sur mesure',
      'La maîtrise des marchés immobiliers locaux',
    ],
  },
  en: {
    titles: ['ABC Group.', 'ABC Group.', 'ABC Group.'],
    subtitles: [
      'As close as possible to your asset’s true value',
      'Tailor-made real-estate valuation',
      'Mastery of local real-estate markets',
    ],
  },
} as const;

/* ====== KEY FIGURES – FR/EN ====== */
type KF = { value: number; fr: string; en: string };

const KEY_FIGURES_STATIC: KF[] = [
  { value: 8, fr: 'cabinets associés', en: 'associated firms' },
  { value: 70, fr: 'collaborateurs', en: 'employees' },
  { value: 35, fr: 'experts immobiliers', en: 'real estate experts' },
  {
    value: 14,
    fr: 'bureaux, dont 4 dans les Dom-Tom',
    en: 'offices, incl. 4 in DOM-TOM',
  },
  { value: 172, fr: 'années d’expérience', en: 'years of experience' },
  {
    value: 8,
    fr: 'experts judiciaires près la Cour d’appel',
    en: 'court-appointed experts',
  },
  {
    value: 7,
    fr: 'experts accrédités RICS',
    en: 'RICS-accredited experts',
  },
  {
    value: 7,
    fr: 'experts membres de l’IFEI',
    en: 'experts, IFEI members',
  },
  {
    value: 1,
    fr: 'expert membre de la CEF',
    en: 'expert member of the CEF',
  },
  {
    value: 4,
    fr: 'M€ HT de chiffre d’affaires annuel',
    en: 'M€ annual turnover (excl. tax)',
  },
  { value: 1800, fr: 'expertises/an', en: 'appraisals/year' },
];

/* ========================================================== */

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AlignFirstWordDirective,
    ImgFastDirective,
  ],
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.scss'],
})
export class HomepageComponent implements OnInit, AfterViewInit, OnDestroy {
  acf: any = {};

  s(v: unknown): string {
    return v == null ? '' : '' + v;
  }

  /* ---------- Langue ---------- */
  private currentLang: 'fr' | 'en' = 'fr';
  private weglotOff?: () => void;

  /* ---------- HERO ---------- */
  heroSlides: Slide[] = [];
  heroIndex = 0;
  autoplayMs = 5000;
  private autoplayRef: any = null;

  @ViewChild('heroBg') heroBgRef!: ElementRef<HTMLElement>;
  @ViewChildren('heroLayer')
  heroLayerEls!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('heroTitle') heroTitleEl!: ElementRef<HTMLElement>;
  @ViewChild('heroSubtitle')
  heroSubtitleEl!: ElementRef<HTMLElement>;

  private viewReady = false;
  private heroDataReady = false;
  private heroIntroDone = false;
  private prefersReduced = false;

  private pointerStartX: number | null = null;
  private swipeThreshold = 40;

  /* ---------- KEY FIGURES ---------- */
  keyFigures: KeyFigure[] = [];
  @ViewChildren('kfItem')
  kfItems!: QueryList<ElementRef<HTMLLIElement>>;
  maxValueCh = 6;

  /* ---------- IDENTITY / WHAT-HOW / DOWNLOAD ---------- */
  identity: Identity = {
    whoTitle: '',
    whoHtml: '',
    whereTitle: '',
    whereMap: '',
    whereItems: [],
  };
  whereItems: string[] = [];
  whereOpen = false;
  toggleWhere(): void {
    this.whereOpen = !this.whereOpen;
  }

  private TEAM_ROUTE_FR = '/experts-immobiliers-agrees';
  private TEAM_ROUTE_EN = '/en/chartered-valuers-team';

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
  @ViewChild('teamTitle')
  teamTitleEl!: ElementRef<HTMLElement>;
  @ViewChildren('teamCard')
  teamCardEls!: QueryList<ElementRef<HTMLElement>>;

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

  /* ---------- NEWS ---------- */
  news: News | null = null;

  /* ---------- FAQ SEO-only (homepage) ---------- */
  faqItems: FaqItem[] = [];

  get currentSlide(): Slide | undefined {
    return this.heroSlides[this.heroIndex];
  }

  get currentHeroTitle(): string {
    const cur = this.currentSlide;
    if (cur?.title?.trim()) return cur.title.trim();
    const langKey = this.isEnglish() ? 'en' : 'fr';
    return HERO_TEXT[langKey].titles[0];
  }

  get currentHeroSubtitle(): string {
    const cur = this.currentSlide;
    if (cur?.subtitle?.trim()) return cur.subtitle.trim();
    const langKey = this.isEnglish() ? 'en' : 'fr';
    return HERO_TEXT[langKey].subtitles[0];
  }

  /* ---------- DI ---------- */
  private wp = inject(WordpressService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private navSub?: Subscription;
  private platformId = inject(PLATFORM_ID);
  private doc = inject(DOCUMENT);
  private seo = inject(SeoService);
  private faq = inject(FaqService);

  // GSAP
  private gsap: any | null = null;
  private ScrollTrigger: any | null = null;

  // Titre 2 lignes
  teamTitleLine1 = 'Une équipe';
  teamTitleLine2 = 'de 8 experts à vos côtés';

  /* ====================== Helpers ====================== */
  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private async setupGsap(): Promise<void> {
    if (!this.isBrowser()) return;
    if (this.gsap) return;
    try {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      this.gsap = gsap;
      this.ScrollTrigger = ScrollTrigger;
      try {
        this.gsap.registerPlugin(this.ScrollTrigger);
      } catch {}
    } catch {}
  }

  private buildDefaultHeroSlides(): Slide[] {
    const langKey = this.isEnglish() ? 'en' : 'fr';
    const T = HERO_TEXT[langKey];
    return [
      {
        title: T.titles[0],
        subtitle: T.subtitles[0],
        bg: '/assets/fallbacks/hero-placeholder.jpg',
      },
    ];
  }

  /* ========================= Lifecycle ========================= */
  ngOnInit(): void {
    this.currentLang = this.detectInitialLang();

    // FAQ "en dur" pour la home (faq.routes.ts)
    this.faqItems = getFaqForRoute('home', this.currentLang);
    if (this.faqItems && this.faqItems.length) {
      if (this.currentLang === 'en') {
        this.faq.set([], this.faqItems);
      } else {
        this.faq.set(this.faqItems, []);
      }
    } else {
      this.faq.clear();
    }

    // SEO centralisé (route "home")
    this.applySeoFromConfig();

    this.heroSlides = this.buildDefaultHeroSlides();
    this.heroIndex = 0;

    // Données WP
    this.wp.getHomepageData().subscribe(async (acf) => {
      this.acf = acf;

      this.extractHero();
      this.preloadHeroImages();

      this.heroDataReady = true;
      this.tryInitHeroIntro();

      this.extractKeyFigures();
      this.extractIdentity();
      await this.extractWhatHowAndPresentation();
      this.extractExpertiseContext();
      this.extractClientsSection();
      this.extractTeamSection();
      await this.ensureTeamPageReady(this.teamPageIndex);
      if (this.isBrowser() && !this.teamAutoplayStoppedByUser) {
        this.startTeamAutoplay();
      }
      this.loadFeaturedNews();

      this.cdr.detectChanges();
      this.wgRefreshTick();

      if (this.isBrowser()) {
        setTimeout(() => this.bindScrollAnimations(), 0);
      }
    });

    // NavigationEnd → rafraîchir langue / hero / key figures si Weglot change l’URL
    this.navSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.currentLang = this.detectInitialLang();

        // Refresh FAQ + service sur navigation (utile si changement de langue côté URL)
        this.faqItems = getFaqForRoute('home', this.currentLang);
        if (this.faqItems && this.faqItems.length) {
          if (this.currentLang === 'en') {
            this.faq.set([], this.faqItems);
          } else {
            this.faq.set(this.faqItems, []);
          }
        } else {
          this.faq.clear();
        }

        this.applySeoFromConfig();
        this.extractHero();
        this.extractKeyFigures();
        this.cdr.detectChanges();
      });

    if (this.isBrowser()) {
      document.addEventListener(
        'visibilitychange',
        this.handleVisibilityChange
      );
      this.setupGsap();
    }
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser()) return;

    // Observer chiffres
    if (typeof (window as any).IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              const idx = Number(
                (e.target as HTMLElement).dataset['index']
              );
              this.playFigure(idx);
              io.unobserve(e.target);
            }
          }
        },
        { threshold: 0.25 }
      );

      this.kfItems?.changes?.subscribe(() => {
        this.kfItems.forEach((el) => io.observe(el.nativeElement));
      });
      setTimeout(() =>
        this.kfItems.forEach((el) => io.observe(el.nativeElement))
      );
    }

    this.viewReady = true;
    this.tryInitHeroIntro();

    // Weglot
    this.wgAddNodeDouble(document.getElementById('hero'));
    this.wgAddNodeDouble(document.getElementById('key-figures'));
    this.bindWeglotLangEvents();

    this.setupGsap().then(() =>
      setTimeout(() => this.bindScrollAnimations(), 0)
    );
  }

  ngOnDestroy(): void {
    this.clearAutoplay();
    this.clearTeamAutoplay();
    this.navSub?.unsubscribe();
    if (this.isBrowser()) {
      document.removeEventListener(
        'visibilitychange',
        this.handleVisibilityChange
      );
    }
    // Nettoyage FAQ globale
    this.faq.clear();
    this.weglotOff?.();
    try {
      this.ScrollTrigger?.getAll?.().forEach((t: any) => t.kill());
    } catch {}
    try {
      this.gsap?.globalTimeline?.clear?.();
    } catch {}
  }

  /* ========================= HERO ========================= */

  private isEnglish(): boolean {
    return this.currentLang === 'en';
  }

  private detectInitialLang(): 'fr' | 'en' {
    if (this.isBrowser()) {
      try {
        const wg: any = (window as any).Weglot;
        const l = wg?.getCurrentLang?.();
        if (l === 'en' || l === 'fr') return l;
      } catch {}
    }

    try {
      const htmlLang =
        (this.doc?.documentElement?.lang || '').toLowerCase();
      if (htmlLang.startsWith('en')) return 'en';
      if (htmlLang.startsWith('fr')) return 'fr';
    } catch {}

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

        // Recalcule FAQ + service quand la langue change
        this.faqItems = getFaqForRoute('home', this.currentLang);
        if (this.faqItems && this.faqItems.length) {
          if (this.currentLang === 'en') {
            this.faq.set([], this.faqItems);
          } else {
            this.faq.set(this.faqItems, []);
          }
        } else {
          this.faq.clear();
        }

        // Recalcule le SEO quand la langue change
        this.applySeoFromConfig();

        this.extractHero();
        this.extractKeyFigures();
        this.cdr.detectChanges();
        this.wgRefreshTick();
      };

      wg.on('initialized', () => onChanged(wg.getCurrentLang?.()));
      wg.on('languageChanged', (newLang: string) =>
        onChanged(newLang)
      );

      this.weglotOff = () => {
        try {
          wg?.off?.('initialized', onChanged);
        } catch {}
        try {
          wg?.off?.('languageChanged', onChanged);
        } catch {}
      };
    } catch {}
  }

  private extractHero(): void {
    const h = this.acf?.hero_section || {};
    const bgs = [
      h.hero_background_1,
      h.hero_background_2,
      h.hero_background_3,
    ].filter(Boolean);
    if (!bgs.length && h.hero_background) {
      bgs.push(h.hero_background);
    }

    const langKey = this.isEnglish() ? 'en' : 'fr';
    const T = HERO_TEXT[langKey];

    const n = Math.max(
      1,
      Math.min(
        bgs.length || 1,
        T.titles.length,
        T.subtitles.length
      )
    );

    const slides: Slide[] = [];
    for (let i = 0; i < n; i++) {
      slides.push({
        title: T.titles[i],
        subtitle: T.subtitles[i],
        bg:
          bgs[i] ??
          bgs[0] ??
          h.hero_background ??
          '/assets/fallbacks/hero-placeholder.jpg',
      });
    }

    if (!slides.length) {
      slides.push({
        title: T.titles[0],
        subtitle: T.subtitles[0],
        bg: '/assets/fallbacks/hero-placeholder.jpg',
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
    if (this.heroIntroDone || !this.viewReady || !this.heroDataReady)
      return;
    queueMicrotask(() =>
      setTimeout(() => this.initHeroIntroNow(), 0)
    );
  }

  private initHeroIntroNow(): void {
    if (!this.isBrowser() || this.heroIntroDone) return;

    this.prefersReduced =
      typeof window !== 'undefined'
        ? window.matchMedia?.(
            '(prefers-reduced-motion: reduce)'
          )?.matches ?? false
        : false;

    const bg = this.heroBgRef?.nativeElement;
    const layers =
      this.heroLayerEls?.toArray().map((r) => r.nativeElement) ||
      [];
    const titleEl = this.heroTitleEl?.nativeElement;
    const subEl = this.heroSubtitleEl?.nativeElement;

    if (layers.length) {
      if (this.gsap) {
        layers.forEach((el, i) =>
          this.gsap.set(el, {
            opacity: i === this.heroIndex ? 1 : 0,
          })
        );
      } else {
        layers.forEach(
          (el, i) =>
            (el.style.opacity =
              i === this.heroIndex ? '1' : '0')
        );
      }
      if (bg) bg.classList.add('is-ready');
    }

    if (this.gsap) {
      if (titleEl)
        this.gsap.set(titleEl, {
          autoAlpha: 0,
          y: 16,
          willChange: 'transform,opacity',
        });
      if (subEl)
        this.gsap.set(subEl, {
          autoAlpha: 0,
          y: 12,
          willChange: 'transform,opacity',
        });
    }

    const heroEl = document.getElementById('hero');
    const dots = heroEl
      ? Array.from(
          heroEl.querySelectorAll<HTMLButtonElement>(
            '.hero-dots .hero-dot'
          )
        )
      : [];

    if (this.gsap && dots.length) {
      this.gsap.set(dots, {
        autoAlpha: 0,
        y: 10,
        willChange: 'transform,opacity',
      });
    }

    const DUR_T = this.prefersReduced ? 0.001 : 2.5;
    const DUR_S = this.prefersReduced ? 0.001 : 1;

    this.pauseAutoplay();

    if (this.gsap) {
      const tl = this.gsap.timeline({
        defaults: { ease: 'power3.out' },
        onComplete: () => {
          this.heroIntroDone = true;
          if (titleEl)
            this.gsap.set(titleEl, {
              clearProps: 'willChange',
            });
          if (subEl)
            this.gsap.set(subEl, {
              clearProps: 'willChange',
            });
          if (dots.length)
            this.gsap.set(dots, {
              clearProps: 'willChange',
            });
          this.resumeAutoplay();
        },
      });

      tl.to(
        titleEl,
        {
          autoAlpha: 1,
          y: 0,
          duration: DUR_T,
        },
        0.5
      )
        .to(
          subEl,
          {
            autoAlpha: 1,
            y: 0,
            duration: DUR_S,
          },
          0.8
        )
        .to(
          dots,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            stagger: { each: 0.08, from: 'start' },
          },
          1.5
        );
    } else {
      if (titleEl) titleEl.style.opacity = '1';
      if (subEl) subEl.style.opacity = '1';
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

  next(): void {
    this.goTo(this.heroIndex + 1);
  }

  prev(): void {
    this.goTo(this.heroIndex - 1);
  }

  startAutoplay(): void {
    if (!this.isBrowser()) return;
    this.clearAutoplay();
    if (this.heroSlides.length > 1) {
      this.autoplayRef = setInterval(
        () => this.next(),
        this.autoplayMs
      );
    }
  }

  pauseAutoplay(): void {
    if (!this.isBrowser()) return;
    this.clearAutoplay();
  }

  resumeAutoplay(): void {
    if (!this.isBrowser()) return;
    if (
      document.visibilityState === 'visible' &&
      this.heroSlides.length > 1
    ) {
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
      if (!this.teamAutoplayStoppedByUser) {
        this.startTeamAutoplay();
      }
    }
  };

  onKeydown(evt: KeyboardEvent): void {
    if (!this.isBrowser()) return;
    if (this.heroSlides.length < 2) return;
    if (evt.key === 'ArrowRight') {
      this.pauseAutoplay();
      this.next();
    } else if (evt.key === 'ArrowLeft') {
      this.pauseAutoplay();
      this.prev();
    }
  }

  onPointerDown(evt: PointerEvent): void {
    if (!this.isBrowser()) return;
    this.pointerStartX = evt.clientX;
  }

  onPointerUp(evt: PointerEvent): void {
    if (!this.isBrowser()) return;
    if (this.pointerStartX == null) return;
    const dx = evt.clientX - this.pointerStartX;
    this.pointerStartX = null;
    if (Math.abs(dx) > this.swipeThreshold) {
      this.pauseAutoplay();
      if (dx < 0) this.next();
      else this.prev();
    }
  }

  /* ========================= Liste "Où ?" ========================= */

  private norm(s: string): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private regionKeyFromLabel(label: string): string {
    const exact =
      this.REGION_LABEL_TO_KEY[(label || '').trim()];
    if (exact) return exact;

    const n = this.norm(label);
    if (n.includes('paris') || n.includes('ile-de-france'))
      return 'idf';
    if (n.includes('grand ouest')) return 'grand-ouest';
    if (n.includes('rhone') || n.includes('auvergne'))
      return 'rhone-alpes';
    if (n.includes('cote d azur') || n.includes('sud-est'))
      return 'cote-azur';
    if (n.includes('sud-ouest')) return 'sud-ouest';
    if (
      n.includes('grand est') ||
      n.includes('nord & est') ||
      n.includes('nord et est')
    )
      return 'grand-est';
    if (n.includes('antilles') || n.includes('guyane'))
      return 'antilles-guyane';
    if (n.includes('reunion') || n.includes('mayotte'))
      return 'reunion-mayotte';
    return n
      .replace(/[^a-z0-9- ]/g, '')
      .replace(/\s+/g, '-');
  }

  openRegion(label: string): void {
    const key = this.regionKeyFromLabel(label);
    const path = this.isEnglish()
      ? this.TEAM_ROUTE_EN
      : this.TEAM_ROUTE_FR;
    this.router.navigate([path], {
      queryParams: { region: key },
    });
  }

  /* ========================= Key Figures ========================= */

  private extractKeyFigures(): void {
    const isEN = this.isEnglish();

    this.keyFigures = KEY_FIGURES_STATIC.map((k) => {
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
        played: false,
      } as KeyFigure;
    });

    const widths = KEY_FIGURES_STATIC.map((k) => {
      const s = String(k.value);
      const hasDecimal = /[,.]/.test(s);
      return Math.max(
        s.length + (hasDecimal ? 2 : 0),
        1
      );
    });
    this.maxValueCh = Math.max(
      6,
      ...(widths.length ? widths : [6])
    );
  }

  private playFigure(index: number): void {
    if (!this.isBrowser()) return;
    const f = this.keyFigures[index];
    if (!f || f.played) return;
    f.played = true;

    const target = f.value;
    const dur = 4000;
    const start = performance.now();
    const easeOutCubic = (t: number) =>
      1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const p = easeOutCubic(t);
      f.display = String(
        Math.round(target * p)
      );
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        f.display = String(target);
      }
    };

    requestAnimationFrame(step);
  }

  /* ========================= Identity / What / How ========================= */

  private extractIdentity(): void {
    const id = this.acf?.identity_section || {};
    this.identity = {
      whoTitle: id.who_title || 'Qui ?',
      whoHtml: id.who_text || '',
      whereTitle: id.where_title || 'Où ?',
      whereMap: id.where_map,
      whereItems: [
        id.where_item_1,
        id.where_item_2,
        id.where_item_3,
        id.where_item_4,
        id.where_item_5,
        id.where_item_6,
        id.where_item_7,
        id.where_item_8,
      ].filter(Boolean),
    };
    this.whereItems = this.identity.whereItems;
  }

  /* ========================= What / How / Download ========================= */

  private async extractWhatHowAndPresentation(): Promise<void> {
    const id = this.acf?.identity_section || {};
    const whatItems = [
      id.what_item_1,
      id.what_item_2,
      id.what_item_3,
    ].filter(Boolean) as string[];
    const howItems = [
      id.how_item_1,
      id.how_item_2,
      id.how_item_3,
      id.how_item_4,
      id.how_item_5,
      id.how_item_6,
      id.how_item_7,
      id.how_item_8,
    ].filter(Boolean) as string[];

    this.whatHow = {
      whatTitle: id.what_title || 'Quoi ?',
      whatItems,
      howTitle: id.how_title || 'Comment ?',
      howItems,
    };

    const dl = this.acf?.presentation_download_section || {};
    const rawFile = dl.presentation_file;
    const resolved = await this.resolveMedia(rawFile);

    this.presentation = {
      text1:
        dl.presentation_button_text_1 ||
        'Télécharger la présentation du',
      text2:
        dl.presentation_button_text_2 ||
        'Groupe ABC',
      file: resolved || null,
    };
  }

  /* ========================= Scroll Animations ========================= */

  private bindScrollAnimations(): void {
    if (!this.isBrowser() || !this.gsap || !this.ScrollTrigger)
      return;
    // Tes anims GSAP sont branchées ici si besoin
  }

  /* ========================= News / Context / Clients ========================= */

  private loadFeaturedNews(): void {
    this.wp
      .getHomepageFeaturedNews(2)
      .subscribe((items: any[]) => {
        const mapped: NewsItem[] = (items || []).map(
          (it: any) => {
            const themeKey = this.toThemeKey(it?.theme);
            const slug =
              it?.slug || this.slugFromLink(it?.link);
            return { ...it, themeKey, slug };
          }
        );
        this.news = mapped.length
          ? { title: 'Actualités', items: mapped }
          : null;
        this.cdr.detectChanges();
        this.wgRefreshTick();
      });
  }

  private extractExpertiseContext(): void {
    const ctx =
      this.acf?.expertise_contact_section || {};
    const items: ContextItem[] = [];
    for (let i = 1; i <= 8; i++) {
      const icon = ctx[`context_icon_${i}`];
      const label = ctx[`context_label_${i}`];
      if (label) {
        items.push({ icon: icon ?? '', label });
      }
    }
    this.contexts = {
      title:
        ctx.context_title || 'Contextes d’intervention',
      items,
    };
  }

  private extractClientsSection(): void {
    const c = this.acf?.clients_section || {};
    const items = [
      c.client_item_1,
      c.client_item_2,
      c.client_item_3,
      c.client_item_4,
      c.client_item_5,
      c.client_item_6,
    ].filter(Boolean) as string[];
    this.clients =
      c.clients_title || items.length
        ? {
            icon: c.clients_icon ?? '',
            title: c.clients_title || 'Nos clients',
            items,
          }
        : null;
  }

  /* ========================= TEAM ========================= */

  private extractTeamSection(): void {
    const t = this.acf?.team_section || {};
    this.teamTitle =
      t.team_title_1 ||
      'Une équipe de 8 experts à vos côtés';
    this.setTeamTitleTwoLines(this.teamTitle);

    const tmp: TeamMember[] = [];
    for (let i = 1; i <= 8; i++) {
      const photo = t[`team_photo_${i}`];
      const name = (t[`team_name_${i}`] || '')
        .toString()
        .trim();
      const area = t[`team_area_${i}`] || '';
      const jobHtml = t[`team_job_${i}`] || '';

      if (photo || name || area || jobHtml) {
        let nameFirst = name;
        let nameLast = '';
        const parts = name.split(/\s+/);
        if (parts.length > 1) {
          nameFirst = parts
            .slice(0, -1)
            .join(' ');
          nameLast = parts.slice(-1)[0];
        }
        tmp.push({
          photo: photo ?? '',
          nameFirst,
          nameLast,
          area,
          jobHtml,
        });
      }
    }

    this.teamMembers = this.shuffleArray(tmp);

    this.teamPages = [];
    for (let i = 0; i < this.teamMembers.length; i += 2) {
      this.teamPages.push(
        this.teamMembers.slice(i, i + 2)
      );
    }

    if (this.teamPages.length) {
      this.teamPageIndex = Math.floor(
        Math.random() * this.teamPages.length
      );
      this.ensureTeamPageReady(
        this.teamPageIndex
      );
    }
  }

  teamPhotoUrl(m: TeamMember): string {
    return (
      this.resolvedPhotos.get(m) ||
      this.defaultPortrait
    );
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

  nextTeam(): void {
    this.goTeamTo(this.teamPageIndex + 1);
  }

  prevTeam(): void {
    this.goTeamTo(this.teamPageIndex - 1);
  }

  private startTeamAutoplay(): void {
    if (!this.isBrowser()) return;
    this.clearTeamAutoplay();
    if (
      this.teamPages.length < 2 ||
      this.teamAutoplayStoppedByUser
    )
      return;

    this.teamAutoplayRef = setInterval(() => {
      const len = this.teamPages.length;
      if (len < 2) return;

      let next = this.teamPageIndex;
      while (next === this.teamPageIndex) {
        next = Math.floor(Math.random() * len);
      }

      this.ensureTeamPageReady(next).then(() => {
        this.teamPageIndex = next;
        this.cdr.detectChanges();
        this.wgRefreshTick();
      });
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

  private async ensureTeamPageReady(
    pageIndex: number
  ): Promise<void> {
    this.preparingPageIndex = pageIndex;
    const page =
      this.teamPages[pageIndex] || [];
    await Promise.all(
      page.map((m) => this.prepareMemberPhoto(m))
    );
    this.preparingPageIndex = null;
  }

  private async prepareMemberPhoto(
    m: TeamMember
  ): Promise<void> {
    if (this.resolvedPhotos.has(m)) return;
    const url = await this.resolveMedia(m.photo);
    const finalUrl = url || this.defaultPortrait;
    await this.preload(finalUrl);
    this.resolvedPhotos.set(m, finalUrl);
  }

  /* ========================= Media / Utils ========================= */

  private async resolveMedia(
    idOrUrl: any
  ): Promise<string> {
    if (!idOrUrl) return '';

    if (typeof idOrUrl === 'object') {
      const src =
        idOrUrl?.source_url || idOrUrl?.url || '';
      if (src) return src;
      if (idOrUrl?.id != null) {
        idOrUrl = idOrUrl.id;
      }
    }

    if (typeof idOrUrl === 'number') {
      try {
        return (
          (await firstValueFrom(
            this.wp.getMediaUrl(idOrUrl)
          )) || ''
        );
      } catch {
        return '';
      }
    }

    if (typeof idOrUrl === 'string') {
      const s = idOrUrl.trim();
      if (/^\d+$/.test(s)) {
        try {
          return (
            (await firstValueFrom(
              this.wp.getMediaUrl(+s)
            )) || ''
          );
        } catch {
          return '';
        }
      }
      if (
        /^(https?:)?\/\//.test(s) ||
        s.startsWith('/') ||
        s.startsWith('data:')
      )
        return s;
      return s;
    }

    return '';
  }

  private preload(src: string): Promise<void> {
    if (!this.isBrowser() || !src)
      return Promise.resolve();
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      (img as any).decoding = 'async';
      (img as any).loading = 'eager';
      img.src = src;
    });
  }

  private shuffleArray<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(
        Math.random() * (i + 1)
      );
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private setTeamTitleTwoLines(
    full: string | undefined
  ): void {
    const s =
      (full || '')
        .replace(/\s+/g, ' ')
        .trim() || '';
    if (s.includes('\n')) {
      const [l1, l2] = s.split('\n');
      this.teamTitleLine1 =
        l1?.trim() || this.teamTitleLine1;
      this.teamTitleLine2 =
        l2?.trim() || this.teamTitleLine2;
      return;
    }
    if (
      s.toLowerCase().startsWith('une équipe')
    ) {
      const rest = s
        .slice('une équipe'.length)
        .trim();
      if (rest) this.teamTitleLine2 = rest;
    }
  }

  private toThemeKey(raw?: string): ThemeKey {
    const s = (raw || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (s.includes('march')) return 'marche';
    if (s.includes('jurid')) return 'juridique';
    if (s.includes('expert')) return 'expertise';
    return 'autre';
  }

  themeClass(k?: ThemeKey): string {
    return `theme-${k || 'autre'}`;
  }

  private slugFromLink(
    link?: string
  ): string | undefined {
    if (!link) return undefined;
    try {
      const origin =
        (this.doc as any)?.defaultView
          ?.location?.origin ||
        'https://groupe-abc.fr';
      const u = new URL(link, origin);
      const parts = u.pathname
        .split('/')
        .filter(Boolean);
      return (
        parts[parts.length - 1] ||
        undefined
      );
    } catch {
      return undefined;
    }
  }

  trackByIndex(i: number): number {
    return i;
  }

  /* ========================= FAQ JSON-LD helper ========================= */

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

  /* ========================= SEO centralisé ========================= */

  private applySeoFromConfig(): void {
    const lang: 'fr' | 'en' = this.currentLang;
    const baseSeo = getSeoForRoute('home', lang);

    const canonical = (baseSeo.canonical || '').replace(/\/+$/, '');

    let origin = 'https://groupe-abc.fr';
    try {
      if (canonical) {
        const u = new URL(canonical);
        origin = `${u.protocol}//${u.host}`;
      }
    } catch {
      // fallback sur domaine par défaut
    }

    const website = {
      '@type': 'WebSite',
      '@id': `${origin}#website`,
      url: origin,
      name: 'Groupe ABC',
      inLanguage: lang === 'en' ? 'en-US' : 'fr-FR',
    };

    const organization = {
      '@type': 'Organization',
      '@id': `${origin}#organization`,
      name: 'Groupe ABC',
      url: origin,
      sameAs: [
        'https://www.linkedin.com/company/groupe-abc-experts/',
      ],
    };

    const pageUrl = canonical || origin;

    const webpage = {
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: baseSeo.title,
      description: baseSeo.description,
      inLanguage: lang === 'en' ? 'en-US' : 'fr-FR',
      isPartOf: { '@id': `${origin}#website` },
    };

    const breadcrumb = {
      '@type': 'BreadcrumbList',
      '@id': `${pageUrl}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: lang === 'en' ? 'Home' : 'Accueil',
          item: pageUrl,
        },
      ],
    };

    const faqLd = this.buildFaqJsonLd(this.faqItems, pageUrl);

    const graph: any[] = [website, organization, webpage, breadcrumb];
    if (faqLd) graph.push(faqLd);

    this.seo.update({
      ...baseSeo,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': graph,
      },
    });
  }

  /* ========================= Weglot helpers ========================= */

  private wgRefreshTick(): void {
    if (!this.isBrowser()) return;
    setTimeout(() => {
      const wg: any = (window as any).Weglot;
      const host =
        document.querySelector('app-root') ||
        document.querySelector('main') ||
        document.body;
      wg?.addNodes?.([host]);
    }, 0);
  }

  private wgAddNode(
    target?: Element | null
  ): void {
    if (!this.isBrowser()) return;
    setTimeout(() => {
      const wg: any = (window as any).Weglot;
      const el = target || document.body;
      wg?.addNodes?.([el]);
    }, 0);
  }

  private wgAddNodeDouble(
    target?: Element | null
  ): void {
    if (!this.isBrowser()) return;
    this.wgAddNode(target);
    setTimeout(
      () => this.wgAddNode(target),
      120
    );
  }
}
