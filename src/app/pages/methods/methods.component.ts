// src/app/pages/methods/methods.component.ts

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
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { firstValueFrom, Subscription, filter } from 'rxjs';
import { ActivatedRoute, Router, NavigationEnd, RouterOutlet, RouterLink } from '@angular/router';

import { WordpressService } from '../../services/wordpress.service';
import { ImgFastDirective } from '../../directives/img-fast.directive';
import { SeoService } from '../../services/seo.service';
import { getSeoForRoute } from '../../config/seo.routes';
import { FaqItem, getFaqForRoute } from '../../config/faq.routes';
import { environment } from '../../../environments/environment';

/** ✅ Source de vérité slugs / routes methods_asset */
import {
  METHODS_ASSETS_BASE,
  canonicalizeMethodsAssetSlug,
  buildMethodsAssetRoute,
} from '../../config/methods-assets.slugs';

/* ===== Types ===== */
type Lang = 'fr' | 'en';

type Hero = { title: string; subtitle?: string; html?: SafeHtml | string };

type DomainItem = {
  kind: 'text' | 'group';
  text?: string;

  /** Pour group */
  title?: string;
  sub?: string[];

  /** ✅ slug canonical WP (pour routerLink) */
  slug?: string;
};

type Domain = {
  title: string;
  icon?: string | number;
  iconUrl?: string;
  items: DomainItem[];
};

type Wheel = {
  title: string;
  image?: string | number;
  imageUrl?: string;
  centerAlt?: string;
  introHtml?: SafeHtml | string;
};

type EvalMethod = {
  icon?: string | number;
  iconUrl?: string;
  title: string;
  html?: SafeHtml | string;
};

type Piloting = {
  html?: SafeHtml | string;
  flows: { src: string | number; url?: string; caption?: string }[];
};

type MethodsAssetIndexItem = { slug: string; title: string };

@Component({
  selector: 'app-methods',
  standalone: true,
  imports: [CommonModule, ImgFastDirective, RouterOutlet, RouterLink],
  templateUrl: './methods.component.html',
  styleUrls: ['./methods.component.scss'],
})
export class MethodsComponent implements OnInit, AfterViewInit, OnDestroy {
  private wp = inject(WordpressService);
  private sanitizer = inject(DomSanitizer);
  private seo = inject(SeoService);

  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private platformId = inject(PLATFORM_ID);
  private doc = inject(DOCUMENT);

  private navSub?: Subscription;
  private weglotOff?: () => void;

  // GSAP lazy (SSR-safe)
  private gsap: any | null = null;
  private ScrollTrigger: any | null = null;

  private pendingBind = false;

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private async setupGsap(): Promise<void> {
    if (!this.isBrowser() || this.gsap) return;
    try {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      this.gsap = gsap;
      this.ScrollTrigger = ScrollTrigger;
      try {
        this.gsap.registerPlugin(this.ScrollTrigger);
      } catch {}
    } catch {
      // keep null
    }

    if (this.pendingBind && this.gsap) {
      this.pendingBind = false;
      this.scheduleBind();
    }
  }

  /** si true -> on est sur une page fille : on masque le listing et on laisse le router-outlet */
  isDetail = false;

  /* ===== Données ===== */
  hero: Hero = { title: 'Biens & méthodes', subtitle: '', html: '' };

  domains: Domain[] = [];

  wheel: Wheel = { title: '', image: '', imageUrl: '', centerAlt: '', introHtml: '' };
  wheelIntroHas = false;
  wheelIntroHtml: SafeHtml | string = '';

  evalTitleText = 'Nos méthodes d’évaluation';

  evalIntroHas = false;
  evalIntroHtml: SafeHtml | string = '';

  methods: EvalMethod[] = [];
  evalOpen: boolean[] = [];

  pilotingTitle = 'Pilotage des missions';
  piloting: Piloting = { html: '', flows: [] };

  /* ===== FAQ (visible/crawlable + JSON-LD) ===== */
  faqItems: FaqItem[] = [];
  openFaqIndexes = new Set<number>();
  private faqPlayed = false;

  /* ===== Fallbacks ===== */
  defaultDomainIcon = '/assets/fallbacks/icon-placeholder.svg';
  defaultEvalIcon = '/assets/fallbacks/icon-placeholder.svg';
  defaultPilotImg = '/assets/fallbacks/image-placeholder.svg';
  defaultWheelImg = '/assets/fallbacks/image-placeholder.svg';

  /* ===== Refs Animations ===== */
  @ViewChild('heroTitle') heroTitleRef!: ElementRef<HTMLElement>;
  @ViewChild('heroSubtitle') heroSubRef!: ElementRef<HTMLElement>;
  @ViewChild('heroIntro') heroIntroRef!: ElementRef<HTMLElement>;

  @ViewChildren('assetCol') assetCols!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('assetsList') assetsListRef!: ElementRef<HTMLElement>;

  @ViewChild('wheelTitle') wheelTitleRef!: ElementRef<HTMLElement>;
  @ViewChild('wheelIntro') wheelIntroRef!: ElementRef<HTMLElement>;
  @ViewChild('wheelWrap') wheelWrapRef!: ElementRef<HTMLElement>;

  @ViewChild('evalTitle') evalTitleRef!: ElementRef<HTMLElement>;
  @ViewChild('evalIntro') evalIntroRef!: ElementRef<HTMLElement>;
  @ViewChildren('evalRow') evalRows!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('evalList') evalListRef!: ElementRef<HTMLElement>;

  @ViewChild('pilotTitle') pilotTitleRef!: ElementRef<HTMLElement>;
  @ViewChild('pilotIntro') pilotIntroRef!: ElementRef<HTMLElement>;
  @ViewChild('pilotGrid') pilotGridRef!: ElementRef<HTMLElement>;

  /* ===== FAQ refs (animation) ===== */
  @ViewChild('faqWrapEl') faqWrapEl!: ElementRef<HTMLElement>;
  @ViewChild('faqTitleEl') faqTitleEl!: ElementRef<HTMLElement>;
  @ViewChildren('faqItemEl') faqItemEls!: QueryList<ElementRef<HTMLElement>>;

  // subs
  private assetColsSub?: Subscription;
  private evalRowsSub?: Subscription;
  private faqItemsSub?: Subscription;

  /* ===== Flags ===== */
  private heroBound = false;
  private assetsBound = false;
  private bindScheduled = false;

  /* ==========================================================
     ✅ Index réel WP methods_asset
     ========================================================== */
  private assetsIndexLoaded = false;
  private assetsIndexByTitle = new Map<string, string>();
  private assetsIndexBySlug = new Set<string>();

  private getWpRestBase(): string {
    const anyEnv: any = environment as any;
    const base =
      anyEnv?.wordpressUrl ||
      anyEnv?.wpBaseUrl ||
      anyEnv?.apiUrl ||
      'https://groupe-abc.fr/wordpress';
    return `${String(base).replace(/\/+$/g, '')}/wp-json/wp/v2`;
  }

  private async preloadAssetsIndex(): Promise<void> {
    if (this.assetsIndexLoaded || !this.isBrowser()) {
      this.assetsIndexLoaded = true;
      return;
    }

    const url = `${this.getWpRestBase()}/methods_asset?per_page=100`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = (await res.json()) as any[];

      const items: MethodsAssetIndexItem[] = (rows || [])
        .map((r) => {
          const slug = (r?.slug || '').toString().trim();
          const t1 = (r?.acf?.hero?.section_title || '').toString().trim();
          const t2 = (r?.title?.rendered || '').toString().trim();
          const title = t1 || t2;
          return { slug, title };
        })
        .filter((x) => !!x.slug && !!x.title);

      items.forEach((it) => {
        const norm = this.normalizeLabel(it.title);
        if (norm) this.assetsIndexByTitle.set(norm, it.slug);
        this.assetsIndexBySlug.add(it.slug);

        const slugifiedTitle = this.slugify(it.title);
        if (slugifiedTitle) this.assetsIndexByTitle.set(slugifiedTitle, it.slug);
      });

      this.assetsIndexLoaded = true;
    } catch {
      this.assetsIndexLoaded = true;
    }
  }

  /* =========================
     ✅ Mapping slugs (FR) — fallback
     ========================= */
  private readonly ASSET_SLUG_FR: Record<string, string> = {
    'expertise immobiliere – biens residentiels': 'expertise-biens-residentiels',
    'expertise immobiliere - biens residentiels': 'expertise-biens-residentiels',
    'biens residentiels': 'expertise-biens-residentiels',

    'expertise immobiliere – locaux commerciaux': 'expertise-locaux-commerciaux',
    'expertise immobiliere - locaux commerciaux': 'expertise-locaux-commerciaux',
    'locaux commerciaux': 'expertise-locaux-commerciaux',

    'expertise immobiliere – bureaux et locaux professionnels':
      'expertise-bureaux-locaux-professionnels',
    'expertise immobiliere - bureaux et locaux professionnels':
      'expertise-bureaux-locaux-professionnels',
    'bureaux et locaux professionnels': 'expertise-bureaux-locaux-professionnels',
    bureaux: 'expertise-bureaux-locaux-professionnels',

    'expertise immobiliere – entrepots et locaux d’activites':
      'expertise-entrepots-locaux-activites',
    'expertise immobiliere - entrepots et locaux d’activites':
      'expertise-entrepots-locaux-activites',
    "expertise immobiliere – entrepots et locaux d'activites":
      'expertise-entrepots-locaux-activites',
    'entrepots et locaux d’activites': 'expertise-entrepots-locaux-activites',
    "entrepots et locaux d'activites": 'expertise-entrepots-locaux-activites',

    'expertise immobiliere – hotels': 'expertise-hotels',
    'expertise immobiliere - hotels': 'expertise-hotels',
    hotels: 'expertise-hotels',
    hotel: 'expertise-hotels',

    'expertise immobiliere – residences de services': 'expertise-residences-de-services',
    'expertise immobiliere - residences de services': 'expertise-residences-de-services',
    'residences de services': 'expertise-residences-de-services',

    'expertise immobiliere – ehpad': 'expertise-ehpad',
    'expertise immobiliere - ehpad': 'expertise-ehpad',
    ehpad: 'expertise-ehpad',

    'expertise immobiliere – gisements fonciers': 'expertise-gisements-fonciers',
    'expertise immobiliere - gisements fonciers': 'expertise-gisements-fonciers',
    'gisements fonciers': 'expertise-gisements-fonciers',

    'expertise immobiliere – friches industrielles': 'expertise-friches-industrielles',
    'expertise immobiliere - friches industrielles': 'expertise-friches-industrielles',
    'friches industrielles': 'expertise-friches-industrielles',

    'expertise immobiliere – charges foncieres urbaines': 'expertise-charges-foncieres-urbaines',
    'expertise immobiliere - charges foncieres urbaines': 'expertise-charges-foncieres-urbaines',
    'charges foncieres urbaines': 'expertise-charges-foncieres-urbaines',

    'expertise immobiliere – lotissements': 'expertise-lotissements',
    'expertise immobiliere - lotissements': 'expertise-lotissements',
    lotissements: 'expertise-lotissements',

    'expertise immobiliere – terrains agricoles': 'expertise-terrains-agricoles',
    'expertise immobiliere - terrains agricoles': 'expertise-terrains-agricoles',
    'terrains agricoles': 'expertise-terrains-agricoles',

    'expertise immobiliere – credit-bail': 'expertise-credit-bail',
    'expertise immobiliere - credit-bail': 'expertise-credit-bail',
    'credit-bail': 'expertise-credit-bail',
    'credit bail': 'expertise-credit-bail',

    'expertise immobiliere – fonds de commerce': 'expertise-fonds-de-commerce',
    'expertise immobiliere - fonds de commerce': 'expertise-fonds-de-commerce',
    'fonds de commerce': 'expertise-fonds-de-commerce',

    'expertise immobiliere – droit au bail': 'expertise-droit-au-bail',
    'expertise immobiliere - droit au bail': 'expertise-droit-au-bail',
    'droit au bail': 'expertise-droit-au-bail',

    'expertise immobiliere – indemnite d’eviction': 'expertise-indemnite-eviction',
    'expertise immobiliere - indemnite d’eviction': 'expertise-indemnite-eviction',
    "expertise immobiliere – indemnite d'eviction": 'expertise-indemnite-eviction',
    'indemnite d’eviction': 'expertise-indemnite-eviction',
    "indemnite d'eviction": 'expertise-indemnite-eviction',

    'expertise immobiliere – usufruit': 'expertise-usufruit',
    'expertise immobiliere - usufruit': 'expertise-usufruit',
    usufruit: 'expertise-usufruit',
  };

  /* ===================== Lifecycle ===================== */
  ngOnInit(): void {
    this.isDetail = this.isChildActive();

    // FAQ + SEO (lang)
    this.refreshLangFaqSeo();

    // préload index WP (browser only)
    this.preloadAssetsIndex().catch(() => {});

    // Data WP page "methods"
    this.wp.getMethodsData().subscribe(async (payload: any) => {
      const root = Array.isArray(payload) ? payload[0] : payload;
      const acf = root?.acf ?? {};

      /* ---------- HERO ---------- */
      this.hero = {
        title: acf?.hero?.section_title || 'Biens & méthodes',
        subtitle: acf?.hero?.section_subtitle || '',
        html: this.safe(acf?.hero?.intro_body || ''),
      };

      /* ---------- DOMAINES ---------- */
      const ad = acf?.asset_domains ?? {};
      const list: any[] = [ad?.domain_1, ad?.domain_2, ad?.domain_3].filter(Boolean);

      await this.preloadAssetsIndex();

      this.domains = await Promise.all(
        list.map(async (d: any) => {
          const items: DomainItem[] = [];

          for (let i = 1; i <= 4; i++) {
            const v = d?.[`item_${i}`];
            if (typeof v === 'string' && v.trim()) {
              const label = v.trim();
              const slug = this.resolveSlugFromLabel(label, this.getLang());
              items.push({
                kind: 'text',
                text: label,
                slug: slug ? canonicalizeMethodsAssetSlug(slug) : undefined,
              });
            }
          }

          const it5 = d?.item_5;
          if (
            it5 &&
            (it5.item_5_title ||
              it5.item_5_subtitle_1 ||
              it5.item_5_subtitle_2 ||
              it5.item_5_subtitle_3)
          ) {
            const groupTitle = (it5.item_5_title || '').toString().trim();
            const slug = this.resolveSlugFromLabel(groupTitle, this.getLang());

            const sub = [
              it5.item_5_subtitle_1,
              it5.item_5_subtitle_2,
              it5.item_5_subtitle_3,
            ]
              .filter((s: any) => (s || '').toString().trim())
              .map((s: string) => s.trim());

            items.push({
              kind: 'group',
              title: groupTitle,
              sub,
              slug: slug ? canonicalizeMethodsAssetSlug(slug) : undefined,
            });
          }

          if (typeof d?.item_6 === 'string' && d.item_6.trim()) {
            const label = d.item_6.trim();
            const slug = this.resolveSlugFromLabel(label, this.getLang());
            items.push({
              kind: 'text',
              text: label,
              slug: slug ? canonicalizeMethodsAssetSlug(slug) : undefined,
            });
          }

          const iconToken = d?.icon ?? d?.icon_1 ?? d?.icon_2 ?? '';
          const iconUrl = (await this.resolveMedia(iconToken)) || this.defaultDomainIcon;

          return {
            title: d?.title || '',
            icon: iconToken,
            iconUrl,
            items,
          } as Domain;
        }),
      );

      /* ---------- WHEEL ---------- */
      const vw = acf?.values_wheel ?? {};
      const wimg = vw?.wheel_image;

      const wheelToken =
        typeof wimg === 'number' || typeof wimg === 'string'
          ? wimg
          : wimg?.id ?? wimg?.url ?? wimg?.source_url ?? '';

      const wheelUrl = (await this.resolveMedia(wheelToken)) || this.defaultWheelImg;

      const wheelIntroRaw = (vw?.intro_text || '').toString().trim();
      const wheelIntroStripped = wheelIntroRaw
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      this.wheelIntroHas = wheelIntroStripped.length > 0;
      this.wheelIntroHtml = this.safe(wheelIntroRaw);

      this.wheel = {
        title: vw?.section_title || 'Un immeuble, des valeurs',
        image: wheelToken,
        imageUrl: wheelUrl,
        centerAlt: (vw?.center_label || '').toString(),
        introHtml: this.wheelIntroHtml,
      };

      /* ---------- MÉTHODES ---------- */
      const mroot = acf?.methods ?? {};
      this.evalTitleText = mroot?.section_title || 'Nos méthodes d’évaluation';

      const evalIntroRaw = (mroot?.method_intro || '').toString().trim();
      const evalIntroStripped = evalIntroRaw
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      this.evalIntroHas = evalIntroStripped.length > 0;
      this.evalIntroHtml = this.safe(evalIntroRaw);

      const keys = Object.keys(mroot).filter((k) => /^method_\d+$/i.test(k));
      const coll = keys.map((k) => mroot[k]).filter(Boolean);

      this.methods = await Promise.all(
        coll
          .filter((m: any) => m?.title || m?.description || m?.icon)
          .map(async (m: any) => {
            const iconUrl = (await this.resolveMedia(m?.icon ?? '')) || this.defaultEvalIcon;
            return {
              icon: m?.icon ?? '',
              iconUrl,
              title: m?.title || '',
              html: this.safe(m?.description || ''),
            } as EvalMethod;
          }),
      );

      this.evalOpen = new Array(this.methods.length).fill(false);

      /* ---------- PILOTAGE ---------- */
      const pil = acf?.mission_piloting ?? {};
      this.pilotingTitle = pil?.section_title || 'Pilotage des missions';

      const flowsSrcs: Array<{ src: string | number; caption?: string }> = [];
      if (pil?.flow_1) flowsSrcs.push({ src: pil.flow_1, caption: pil?.flow_1_caption || '' });
      if (pil?.flow_2) flowsSrcs.push({ src: pil.flow_2, caption: pil?.flow_2_caption || '' });

      const flowsWithUrl = await Promise.all(
        flowsSrcs.map(async (f) => ({
          ...f,
          url: (await this.resolveMedia(f.src)) || this.defaultPilotImg,
        })),
      );

      this.piloting = {
        html: this.safe(pil?.intro_body || ''),
        flows: flowsWithUrl,
      };

      // Après injection WP, rebind animations (si listing)
      if (!this.isDetail) this.scheduleBind();
    });

    // NavigationEnd : detail/list + refresh lang/faq/seo
    this.navSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(async () => {
        const wasDetail = this.isDetail;
        this.isDetail = this.isChildActive();

        // refresh FAQ/SEO si URL/lang change
        this.refreshLangFaqSeo();

        if (wasDetail && !this.isDetail) {
          await this.setupGsap();
          this.heroBound = false;
          this.assetsBound = false;
          this.faqPlayed = false;
          this.scheduleBind();
        }

        if (!wasDetail && this.isDetail) {
          try {
            this.ScrollTrigger?.getAll?.().forEach((t: any) => t.kill());
          } catch {}
        }
      });

    // Weglot language change (sans navigation)
    this.bindWeglotLangEvents();
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser()) return;
    await this.setupGsap();

    if (this.isDetail) return;

    this.assetColsSub = this.assetCols?.changes?.subscribe(() => this.scheduleBind());
    this.evalRowsSub = this.evalRows?.changes?.subscribe(() => this.scheduleBind());

    // FAQ: si la liste change (langue), rebind + reset
    this.faqItemsSub = this.faqItemEls?.changes?.subscribe(() => this.scheduleBind());

    this.scheduleBind();
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
    this.weglotOff?.();

    this.assetColsSub?.unsubscribe();
    this.evalRowsSub?.unsubscribe();
    this.faqItemsSub?.unsubscribe();

    if (!this.isBrowser()) return;
    try {
      this.ScrollTrigger?.getAll?.().forEach((t: any) => t.kill());
    } catch {}
    try {
      this.gsap?.globalTimeline?.clear?.();
    } catch {}
  }

  /* ===================== UI handlers ===================== */

  toggleEval(i: number) {
    const willOpen = !this.evalOpen[i];
    this.evalOpen.fill(false);
    if (willOpen) this.evalOpen[i] = true;
  }

  toggleFaqItem(i: number): void {
    if (this.openFaqIndexes.has(i)) this.openFaqIndexes.delete(i);
    else this.openFaqIndexes.add(i);
  }

  isFaqItemOpen(i: number): boolean {
    return this.openFaqIndexes.has(i);
  }

  trackByIndex(i: number) {
    return i;
  }

  private safe(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html || '');
  }

  /* ==========================================================
    ✅ Navigation (assets)
    ========================================================== */

  assetLink(slug: string): any[] {
    const lang = this.getLang();
    return buildMethodsAssetRoute(lang, slug);
  }

  goToAsset(slug: string): void {
    const raw = (slug || '').trim();
    if (!raw) return;
    const lang = this.getLang();
    this.router.navigate(buildMethodsAssetRoute(lang, raw)).catch(() => {});
  }

  private isChildActive(): boolean {
    const child = this.route.firstChild;
    const slug = child?.snapshot?.paramMap?.get('slug');
    if (child && slug) return true;

    try {
      const url = (this.router.url || '')
        .split('?')[0]
        .split('#')[0]
        .replace(/\/+$/g, '');

      const lang = this.getLang();
      const base = (METHODS_ASSETS_BASE[lang] || '').replace(/\/+$/g, '');

      if (!base) return false;
      if (!url.startsWith(base + '/')) return false;

      const rest = url.slice((base + '/').length);
      return !!rest && rest.split('/').filter(Boolean).length >= 1;
    } catch {}

    return false;
  }

  /* ===================== Lang / FAQ / SEO ===================== */

  private getLang(): Lang {
    // 1) Weglot si dispo
    if (this.isBrowser()) {
      try {
        const wg: any = (window as any).Weglot;
        const l = wg?.getCurrentLang?.();
        if (l === 'en' || l === 'fr') return l;
      } catch {}
    }

    // 2) html lang
    try {
      const htmlLang = (this.doc?.documentElement?.lang || '').toLowerCase();
      if (htmlLang.startsWith('en')) return 'en';
      if (htmlLang.startsWith('fr')) return 'fr';
    } catch {}

    // 3) path (/en/...)
    if (this.isBrowser()) {
      try {
        const path = window.location.pathname || '/';
        if (path.startsWith('/en')) return 'en';
      } catch {}
    }

    return 'fr';
  }

  private refreshLangFaqSeo(): void {
    const lang = this.getLang();

    this.faqItems = getFaqForRoute('methods', lang) || [];
    this.openFaqIndexes.clear();

    // reset anim FAQ (si changement lang / navigation)
    this.faqPlayed = false;

    this.applySeoFromConfig(this.faqItems);

    // rebind (si gsap pas prêt => pendingBind)
    this.scheduleBind();
  }

  private bindWeglotLangEvents(): void {
    if (!this.isBrowser()) return;

    try {
      const wg: any = (window as any).Weglot;
      if (!wg?.on || !wg?.getCurrentLang) return;

      const onChanged = () => {
        this.refreshLangFaqSeo();
      };

      wg.on('initialized', onChanged);
      wg.on('languageChanged', onChanged);

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

  private applySeoFromConfig(faqItems: FaqItem[] = []): void {
    const lang = this.getLang();
    const baseSeo = getSeoForRoute('methods', lang);

    const siteUrl = (environment.siteUrl || 'https://groupe-abc.fr').replace(/\/+$/, '');

    const canonicalAbs =
      baseSeo.canonical && /^https?:\/\//i.test(baseSeo.canonical)
        ? baseSeo.canonical
        : this.normalizeUrl(siteUrl, baseSeo.canonical || METHODS_ASSETS_BASE[lang]);

    const existingJsonLd: any = baseSeo.jsonLd;
    let baseGraph: any[] = [];
    let baseContext = 'https://schema.org';

    if (existingJsonLd) {
      if (Array.isArray(existingJsonLd['@graph'])) baseGraph = existingJsonLd['@graph'];
      else baseGraph = [existingJsonLd];
      if (typeof existingJsonLd['@context'] === 'string') baseContext = existingJsonLd['@context'];
    }

    const faqLd =
      faqItems && faqItems.length
        ? {
            '@type': 'FAQPage',
            '@id': `${canonicalAbs}#faq`,
            mainEntity: faqItems.map((q) => ({
              '@type': 'Question',
              name: q.q,
              acceptedAnswer: { '@type': 'Answer', text: q.a },
            })),
          }
        : null;

    const graph: any[] = [...baseGraph];
    if (faqLd) graph.push(faqLd);

    this.seo.update({
      ...baseSeo,
      canonical: canonicalAbs,
      jsonLd: graph.length
        ? {
            '@context': baseContext,
            '@graph': graph,
          }
        : undefined,
    });
  }

  private normalizeUrl(base: string, path: string): string {
    const b = base.endsWith('/') ? base.slice(0, -1) : base;
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${b}${p}`;
  }

  /* ===================== Media resolve ===================== */

  private async resolveMedia(token: any): Promise<string> {
    if (!token) return '';

    if (typeof token === 'object') {
      const u = token?.source_url || token?.url || '';
      if (u) return u;
      if (token?.id != null) token = token.id;
    }

    if (typeof token === 'number') {
      try {
        return (await firstValueFrom(this.wp.getMediaUrl(token))) || '';
      } catch {
        return '';
      }
    }

    if (typeof token === 'string') {
      const s = token.trim();
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

    return '';
  }

  /* =================
     ✅ Slug resolution
     ================= */
  private resolveSlugFromLabel(label: string, lang: Lang): string {
    const key = this.normalizeLabel(label);

    const fromIndex = this.assetsIndexByTitle.get(key);
    if (fromIndex) return fromIndex;

    if (lang === 'fr') {
      const hit = this.ASSET_SLUG_FR[key];
      if (hit) return hit;
    }

    const candidate = this.slugify(label);
    if (candidate && (this.assetsIndexBySlug.size === 0 || this.assetsIndexBySlug.has(candidate)))
      return candidate;

    return candidate;
  }

  private normalizeLabel(s: string): string {
    return (s || '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’']/g, "'")
      .replace(/–/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9\s\-']/g, '')
      .trim();
  }

  private slugify(s: string): string {
    return (s || '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /* ================= Animations ================= */

  private scheduleBind() {
    if (!this.isBrowser()) return;

    if (!this.gsap) {
      this.pendingBind = true;
      return;
    }
    if (this.isDetail) return;
    if (this.bindScheduled) return;

    this.bindScheduled = true;
    queueMicrotask(() =>
      requestAnimationFrame(() => {
        this.bindScheduled = false;
        this.bindAnimations();
      }),
    );
  }

  private forceInitialHidden(host: HTMLElement) {
    if (!this.isBrowser() || !this.gsap) return;

    const gsap = this.gsap!;
    const pre = Array.from(host.querySelectorAll<HTMLElement>('.prehide'));
    const rows = Array.from(host.querySelectorAll<HTMLElement>('.prehide-row'));

    if (pre.length) gsap.set(pre, { autoAlpha: 0, y: 20, visibility: 'hidden' });
    if (rows.length) gsap.set(rows, { autoAlpha: 0, y: 12, visibility: 'hidden' });
  }

  private bindAnimations(): void {
    if (!this.isBrowser() || !this.gsap || !this.ScrollTrigger) return;

    const gsap = this.gsap!;
    const ScrollTrigger = this.ScrollTrigger!;
    const host = this.doc.querySelector('.methods-wrapper') as HTMLElement | null;
    if (host) this.forceInitialHidden(host);

    try {
      ScrollTrigger.getAll().forEach((t: any) => t.kill());
    } catch {}

    const EASE = 'power3.out';

    const rmPrehide = (els: Element | Element[]) => {
      (Array.isArray(els) ? els : [els]).forEach((el) =>
        el.classList.remove('prehide', 'prehide-row'),
      );
    };

    const show = (el?: Element | null) => {
      if (!el) return;
      rmPrehide(el);
      gsap.set(el, { visibility: 'visible' });
    };

    /* HERO */
    const h1 = this.heroTitleRef?.nativeElement;
    const h2 = this.heroSubRef?.nativeElement;
    const hi = this.heroIntroRef?.nativeElement;

    gsap.killTweensOf([h1, h2, hi].filter(Boolean) as HTMLElement[]);

    if (!this.heroBound) {
      const tl = gsap.timeline({ defaults: { ease: EASE } });

      if (h1) {
        tl.fromTo(
          h1,
          { autoAlpha: 0, y: 20, visibility: 'hidden' },
          { autoAlpha: 1, y: 0, duration: 0.6, onStart: () => show(h1) },
          0,
        );
      }
      if (h2) {
        tl.fromTo(
          h2,
          { autoAlpha: 0, y: 18, visibility: 'hidden' },
          { autoAlpha: 1, y: 0, duration: 0.5, onStart: () => show(h2) },
          0.06,
        );
      }
      if (hi) {
        tl.fromTo(
          hi,
          { autoAlpha: 0, y: 18, visibility: 'hidden' },
          { autoAlpha: 1, y: 0, duration: 0.5, onStart: () => show(hi) },
          0.12,
        );
      }

      this.heroBound = true;
    } else {
      [h1, h2, hi].forEach((el) => {
        if (!el) return;
        show(el);
        gsap.set(el, { autoAlpha: 1, y: 0, clearProps: 'transform,opacity,visibility' });
      });
    }

    /* DOMAINES (assets) */
    const assetsList = this.assetsListRef?.nativeElement;
    const cols = (this.assetCols?.toArray() || []).map((r) => r.nativeElement);

    if (assetsList && cols.length && !this.assetsBound) {
      const heads = cols.map((c) => c.querySelector<HTMLElement>('.asset-head'));
      const lists = cols.map((c) => Array.from(c.querySelectorAll<HTMLElement>('.panel-list > li')));

      const headsOk = heads.filter(Boolean) as HTMLElement[];
      if (headsOk.length) gsap.set(headsOk, { autoAlpha: 0, y: 14 });
      lists.forEach((arr) => arr.length && gsap.set(arr, { autoAlpha: 0, y: 10 }));

      gsap
        .timeline({
          defaults: { ease: EASE },
          scrollTrigger: { id: 'assets-grid', trigger: assetsList, start: 'top 85%', once: true },
          onStart: () => rmPrehide([assetsList, ...cols]),
          onComplete: () => {
            this.assetsBound = true;
            try {
              gsap.set([assetsList, ...cols, ...headsOk, ...lists.flat()], { clearProps: 'all' });
            } catch {}
          },
        })
        .fromTo(assetsList, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.38 }, 0)
        .add(() => {
          cols.forEach((_, i) => {
            const at = 0.1 + i * 0.12;
            const hd = heads[i] as HTMLElement | null;
            const its = lists[i] || [];
            if (hd) gsap.to(hd, { autoAlpha: 1, y: 0, duration: 0.4, ease: EASE, delay: at });
            if (its.length)
              gsap.to(its, {
                autoAlpha: 1,
                y: 0,
                duration: 0.4,
                ease: EASE,
                stagger: 0.04,
                delay: at + 0.06,
              });
          });
        }, 0);
    }

    /* WHEEL */
    const wTitle = this.wheelTitleRef?.nativeElement;
    const wIntro = this.wheelIntroRef?.nativeElement;
    const wWrap = this.wheelWrapRef?.nativeElement;

    if (wTitle) {
      gsap.fromTo(
        wTitle,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.52,
          ease: EASE,
          scrollTrigger: { trigger: wTitle, start: 'top 85%', once: true },
          onStart: () => show(wTitle),
        },
      );
    }

    if (wIntro) {
      gsap.fromTo(
        wIntro,
        { autoAlpha: 0, y: 14 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.48,
          ease: EASE,
          scrollTrigger: { trigger: wTitle || wIntro, start: 'top 85%', once: true },
          onStart: () => show(wIntro),
        },
      );
    }

    if (wWrap) {
      gsap.fromTo(
        wWrap,
        { autoAlpha: 0, scale: 0.985 },
        {
          autoAlpha: 1,
          scale: 1,
          duration: 0.52,
          ease: 'power2.out',
          scrollTrigger: { trigger: wWrap, start: 'top 85%', once: true },
          onStart: () => show(wWrap),
        },
      );
    }

    /* MÉTHODES */
    const eTitle = this.evalTitleRef?.nativeElement;
    const eIntro = this.evalIntroRef?.nativeElement;
    const eList = this.evalListRef?.nativeElement;
    const eRows = (this.evalRows?.toArray() || []).map((r) => r.nativeElement);

    if (eTitle) {
      gsap.fromTo(
        eTitle,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.52,
          ease: EASE,
          scrollTrigger: { trigger: eTitle, start: 'top 85%', once: true },
          onStart: () => show(eTitle),
        },
      );
    }

    if (eIntro) {
      gsap.fromTo(
        eIntro,
        { autoAlpha: 0, y: 14 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.48,
          ease: EASE,
          scrollTrigger: { trigger: eTitle || eIntro, start: 'top 85%', once: true },
          onStart: () => show(eIntro),
        },
      );
    }

    if (eList && eRows.length) {
      gsap.set(eRows, { autoAlpha: 0, y: 12 });
      gsap
        .timeline({
          defaults: { ease: EASE },
          scrollTrigger: { trigger: eList, start: 'top 85%', once: true },
          onStart: () => rmPrehide([eList, ...eRows]),
        })
        .fromTo(eList, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.36 }, 0)
        .to(eRows, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.08 }, 0.08);
    }

    /* PILOTAGE */
    const pTitle = this.pilotTitleRef?.nativeElement;
    const pIntro = this.pilotIntroRef?.nativeElement;
    const pGrid = this.pilotGridRef?.nativeElement;

    if (pTitle) {
      gsap.fromTo(
        pTitle,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          ease: EASE,
          scrollTrigger: { trigger: pTitle, start: 'top 85%', once: true },
          onStart: () => show(pTitle),
        },
      );
    }

    if (pIntro) {
      gsap.fromTo(
        pIntro,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          ease: EASE,
          scrollTrigger: { trigger: pIntro, start: 'top 85%', once: true },
          onStart: () => show(pIntro),
          onComplete: () => gsap.set(pIntro, { clearProps: 'transform,opacity,visibility' }),
        },
      );
    }

    if (pGrid) {
      const figures = Array.from(pGrid.querySelectorAll<HTMLElement>('.pilot-figure'));
      gsap.set(figures, { autoAlpha: 0, y: 12 });

      gsap
        .timeline({
          defaults: { ease: EASE },
          scrollTrigger: { trigger: pGrid, start: 'top 85%', once: true },
          onStart: () => rmPrehide([pGrid, ...figures]),
        })
        .fromTo(pGrid, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.38 }, 0)
        .to(figures, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.08 }, 0.06);
    }

    /* FAQ — fin de page (doit être la DERNIÈRE anim) */
    const faqWrap = this.faqWrapEl?.nativeElement || null;
    const faqTitle = this.faqTitleEl?.nativeElement || null;
    const faqItems = (this.faqItemEls?.toArray() || []).map((r) => r.nativeElement);

    const playFaq = () => {
      if (!faqWrap) return;

      // On garde tout caché jusqu’au moment exact
      rmPrehide(faqWrap);
      gsap.fromTo(
        faqWrap,
        { autoAlpha: 0, y: 14, visibility: 'hidden' },
        { autoAlpha: 1, y: 0, duration: 0.35, ease: EASE, onStart: () => show(faqWrap) }
      );

      if (faqTitle) {
        rmPrehide(faqTitle);
        gsap.fromTo(
          faqTitle,
          { autoAlpha: 0, y: 16, visibility: 'hidden' },
          { autoAlpha: 1, y: 0, duration: 0.45, ease: EASE, onStart: () => show(faqTitle) }
        );
      }

      if (faqItems.length) {
        rmPrehide(faqItems);
        gsap.set(faqItems, { autoAlpha: 0, y: 12, visibility: 'hidden' });
        gsap.to(faqItems, {
          autoAlpha: 1,
          y: 0,
          duration: 0.34,
          stagger: 0.08,
          ease: EASE,
          onStart: () => faqItems.forEach((el) => show(el)),
          onComplete: () => gsap.set(faqItems, { clearProps: 'transform,opacity,visibility' }),
        });
      }
    };

    if (faqWrap && (faqTitle || faqItems.length)) {
      if (!this.faqPlayed) {
        ScrollTrigger.create({
          id: 'faq-last',
          trigger: faqWrap,

          // ✅ Déclenchement TRÈS tard : quand le haut de la FAQ arrive presque en haut d'écran
          // => impossible que ça parte “avec le hero” même si page courte
          start: 'top 25%',

          once: true,
          onEnter: () => {
            // ✅ mini délai pour être sûr que toutes les anims précédentes aient fini leur tick
            gsap.delayedCall(0.15, () => {
              playFaq();
              this.faqPlayed = true;
            });
          },
        });
      } else {
        rmPrehide([faqWrap, ...(faqTitle ? [faqTitle] : []), ...faqItems]);
        gsap.set([faqWrap, ...(faqTitle ? [faqTitle] : []), ...faqItems], {
          autoAlpha: 1,
          y: 0,
          clearProps: 'transform,opacity,visibility',
        });
      }
    }
  }
}
