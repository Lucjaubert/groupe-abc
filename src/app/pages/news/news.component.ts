// src/app/pages/news/news.component.ts
import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  inject,
  ElementRef,
  QueryList,
  ViewChild,
  ViewChildren,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { ImgFastDirective } from '../../directives/img-fast.directive';
import { environment } from '../../../environments/environment';
import { getSeoForRoute } from '../../config/seo.routes';
import { getFaqForRoute, FaqItem } from '../../config/faq.routes';

type Lang = 'fr' | 'en';

type NewsIntro = {
  title: string;
  html: string;
  linkedinUrl?: string;
};

type ThemeKey = 'expertise' | 'juridique' | 'marche' | 'autre';

type NewsPost = {
  id?: number | string;

  /** slug WP natif */
  slug?: string;

  /** slug “propre” basé sur le titre (pour URLs plus clean) */
  prettySlug?: string;

  /** uid stable (pour ordre persisté) */
  uid?: string;

  theme?: string;
  themeKey?: ThemeKey;

  firmLogo?: string | number | any;
  firmName?: string;
  author?: string;
  date?: string;

  title?: string;
  html?: string;

  imageUrl?: string | number | any;
  linkedinUrl?: string;

  _imageUrl?: string;
  _firmLogoUrl?: string;
};

@Component({
  selector: 'app-news',
  standalone: true,
  imports: [CommonModule, ImgFastDirective, RouterLink],
  templateUrl: './news.component.html',
  styleUrls: ['./news.component.scss'],
})
export class NewsComponent implements OnInit, AfterViewInit, OnDestroy {
  private wp = inject(WordpressService);
  private seo = inject(SeoService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  /** FAQ (visible / crawlable) via faq.routes.ts */
  faqItems: FaqItem[] = [];

  // GSAP (browser-only)
  private gsap: any | null = null;
  private ScrollTrigger: any | null = null;

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private async setupGsap(): Promise<void> {
    if (!this.isBrowser() || this.gsap) return;

    const { gsap } = await import('gsap');
    const { ScrollTrigger } = await import('gsap/ScrollTrigger');
    this.gsap = gsap;
    this.ScrollTrigger = ScrollTrigger;

    try {
      this.gsap.registerPlugin(this.ScrollTrigger);
    } catch {}
  }

  /* ===== Données ===== */
  intro: NewsIntro = {
    title: 'Actualités',
    html:
      'À travers cette rubrique, le Groupe ABC partage ses analyses de marché, ses décryptages réglementaires et ses retours d’expérience, reflétant l’expertise et le dynamisme de l’ensemble de ses huit cabinets.<br/><br/>Retrouvez également nos temps forts et prises de parole sur LinkedIn.',
    linkedinUrl: '',
  };

  posts: NewsPost[] = [];
  private baseOrder: NewsPost[] = [];
  viewPosts: NewsPost[] = [];
  pagedPosts: NewsPost[] = [];

  /**
   * IMPORTANT :
   * expanded[] doit correspondre à LA PAGE COURANTE (index de pagedPosts),
   * sinon pagination / re-ordre => mismatch.
   */
  expanded: boolean[] = [];

  /* ===== Refs DOM (animations) ===== */
  @ViewChild('introTitle') introTitle!: ElementRef<HTMLElement>;
  @ViewChild('introSubtitle') introSubtitle!: ElementRef<HTMLElement>;
  @ViewChild('introLinkedin') introLinkedin!: ElementRef<HTMLElement>;

  @ViewChildren('newsRow') rows!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('excerptClip') clips!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('excerptBody') bodies!: QueryList<ElementRef<HTMLElement>>;

  @ViewChild('pagerWrapper') pagerWrapper!: ElementRef<HTMLElement>;
  @ViewChild('pager') pager!: ElementRef<HTMLElement>;

  @ViewChildren('themeFilterBtn') themeFilterBtns!: QueryList<ElementRef<HTMLButtonElement>>;

  private rowsAnimationsInitialized = false;
  private introPlayed = false;

  /* ===== Pagination ===== */
  pageSize = 10;
  currentPage = 1;

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.viewPosts.length / this.pageSize));
  }

  /* ===== Promote / Filter ===== */
  promoteTheme: ThemeKey | null = null;
  filterTheme: ThemeKey | null = null;

  themeFilters: Array<{ key: ThemeKey; label: string }> = [
    { key: 'marche', label: 'Marché' },
    { key: 'juridique', label: 'Juridique' },
    { key: 'expertise', label: 'Expertise' },
  ];

  /* ======= Préchargement borné (anti-spike réseau / RAM) ======= */
  private MAX_PARALLEL_PRELOAD = 2;

  private defer(fn: () => void) {
    if (!this.isBrowser()) {
      setTimeout(fn, 0);
      return;
    }
    try {
      const ric = (window as any)?.requestIdleCallback as
        | ((cb: () => void, opts?: any) => void)
        | undefined;
      if (ric) ric(() => fn(), { timeout: 1500 });
      else setTimeout(fn, 0);
    } catch {
      setTimeout(fn, 0);
    }
  }

  async ngOnInit(): Promise<void> {
    const list: any[] = await firstValueFrom(this.wp.getAllNews());

    /* ===== Intro depuis le post "news" (ACF news.section_title / intro_body / linkedin_url) ===== */
    const introSource = list.find((it: any) => it?.slug === 'news' && it?.acf?.news);
    if (introSource?.acf?.news) {
      const n = introSource.acf.news;
      if (n.section_title) this.intro.title = n.section_title;
      if (n.intro_body) this.intro.html = n.intro_body;
      if (n.linkedin_url) this.intro.linkedinUrl = n.linkedin_url;
    } else {
      // fallback : récupérer au moins l’URL LinkedIn si elle existe quelque part
      this.intro.linkedinUrl =
        list.find((it: any) => it?.acf?.news?.linkedin_url)?.acf?.news?.linkedin_url || '';
    }

    /* ===== Mapping des posts depuis l’API /wp-json/wp/v2/news ===== */
    const mapped: NewsPost[] = [];

    for (const it of list) {
      // ✅ IMPORTANT : on n’intègre que les items qui ont réellement acf.post
      const p = it?.acf?.post || null;
      if (!p) continue;

      const title = (p.post_title || it?.title?.rendered || '').toString();
      const wpSlug = (it?.slug || '').toString();

      mapped.push({
        id: it?.id,
        slug: wpSlug,
        prettySlug: this.makePrettySlug(title),

        uid: (it?.id ? String(it.id) : '') + '|' + title + '|' + (p.date || it?.date || ''),

        theme: (p.theme || '').toString(),
        themeKey: this.toThemeKey(p.theme),

        firmLogo: p.logo_firm,
        firmName: (p.nam_firm || '').toString(),
        author: (p.author || '').toString(),
        date: (p.date || it?.date || '').toString(),

        title,
        html: (p.post_content || it?.content?.rendered || '').toString(),
        imageUrl: p.post_image,
        linkedinUrl: (p.linkedin_link || '').toString(),
      });
    }

    // ⚠️ On retire le post "news" de la liste d’articles (il sert uniquement d’intro)
    const onlyPosts = mapped.filter((p) => p.slug !== 'news');

    // Résolution médias + préchargement borné
    await this.hydratePostMedia(onlyPosts);

    this.posts = onlyPosts;

    // ✅ NEW: lire un filtre thème via query param ?theme=...
    const qpTheme = (this.route.snapshot.queryParamMap.get('theme') || '').trim();
    if (qpTheme && ['expertise', 'juridique', 'marche', 'autre'].includes(qpTheme)) {
      this.filterTheme = qpTheme as ThemeKey;
      this.promoteTheme = null;
    }

    // Réordonner si ?open= est présent
    const open = (this.route.snapshot.queryParamMap.get('open') || '').trim();
    if (open) {
      const idx = this.posts.findIndex(
        (p) =>
          (p.slug && p.slug === open) ||
          (p.prettySlug && p.prettySlug === open) ||
          (p.id && String(p.id) === open),
      );
      if (idx > -1) {
        const target = this.posts[idx];
        const rest = this.posts.filter((_, i) => i !== idx);
        this.baseOrder = [target, ...rest];
      } else {
        this.baseOrder = this.restoreOrBuildOrder(this.posts);
      }
    } else {
      this.baseOrder = this.restoreOrBuildOrder(this.posts);
    }

    this.rebuildView();

    // ✅ nettoyer ?theme= si présent (sans casser open handling)
    if (qpTheme && this.isBrowser() && !open) {
      try {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { theme: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      } catch {}
    }

    // Ouvrir l’article ciblé puis nettoyer l’URL
    if (open) {
      setTimeout(() => {
        if (this.expanded.length) this.expanded[0] = true;
        if (this.isBrowser()) {
          try {
            window.scrollTo({ top: 0 });
          } catch {}
        }
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      });
    }

    /* ======================= FAQ via faq.routes.ts (affichage bas + JSON-LD) ======================= */
    const isEN = this.currentPath().startsWith('/en/');
    const lang: Lang = isEN ? 'en' : 'fr';
    this.faqItems = getFaqForRoute('news-list', lang) || [];

    /* ======================= SEO via config centrale ======================= */
    const baseSeo = getSeoForRoute('news-list', lang);

    const siteUrl = (environment.siteUrl || 'https://groupe-abc.fr').replace(/\/+$/, '');
    const defaultPathFR = '/actualites-expertise-immobiliere';
    const defaultPathEN = '/en/real-estate-valuation-news';
    const fallbackPath = isEN ? defaultPathEN : defaultPathFR;

    const canonicalAbs =
      baseSeo.canonical && /^https?:\/\//i.test(baseSeo.canonical)
        ? baseSeo.canonical
        : this.normalizeUrl(siteUrl, baseSeo.canonical || fallbackPath);

    // ItemList pour quelques articles de la page courante (avec slug “propre” si possible)
    const itemListElements =
      this.pagedPosts.slice(0, 5).map((p, i) => {
        const anchor = encodeURIComponent(p.prettySlug || p.slug || String(p.id || i));
        return {
          '@type': 'ListItem',
          position: i + 1,
          url: `${canonicalAbs}#${anchor}`,
        };
      }) || [];

    const nodes: any[] = [];

    if (itemListElements.length) {
      nodes.push({
        '@type': 'ItemList',
        '@id': `${canonicalAbs}#list`,
        itemListElement: itemListElements,
      });
    }

    if (this.faqItems.length) {
      nodes.push({
        '@type': 'FAQPage',
        '@id': `${canonicalAbs}#faq`,
        mainEntity: this.faqItems.map((q) => ({
          '@type': 'Question',
          name: this.stripHtml(q?.q || ''),
          acceptedAnswer: { '@type': 'Answer', text: q?.a || '' },
        })),
      });
    }

    // Merge avec JSON-LD config centrale (si présent)
    const existingJsonLd: any = baseSeo.jsonLd;
    let baseGraph: any[] = [];
    let baseContext = 'https://schema.org';

    if (existingJsonLd) {
      if (Array.isArray(existingJsonLd['@graph'])) baseGraph = existingJsonLd['@graph'];
      else baseGraph = [existingJsonLd];
      if (typeof existingJsonLd['@context'] === 'string') baseContext = existingJsonLd['@context'];
    }

    const jsonLd =
      nodes.length || baseGraph.length
        ? { '@context': baseContext, '@graph': [...baseGraph, ...nodes] }
        : existingJsonLd;

    this.seo.update({
      ...baseSeo,
      canonical: canonicalAbs,
      ...(jsonLd ? { jsonLd } : {}),
    });
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser()) return;
    await this.setupGsap();

    const gsap = this.gsap!;
    const host = document.querySelector('.news-wrapper') as HTMLElement | null;
    if (host) this.forceInitialHidden(host);

    if (this.pagerWrapper?.nativeElement) {
      gsap.to(this.pagerWrapper.nativeElement, { autoAlpha: 1, duration: 0.01 });
    }

    this.rows?.changes?.subscribe(() => {
      if (!this.rowsAnimationsInitialized && this.rows.length) {
        this.rowsAnimationsInitialized = true;
        this.initIntroSequence(() => this.animateFirstRow());
        this.initRowsScrollAnimations();
      }
    });

    if (this.rows?.length && !this.rowsAnimationsInitialized) {
      this.rowsAnimationsInitialized = true;
      this.initIntroSequence(() => this.animateFirstRow());
      this.initRowsScrollAnimations();
    }
  }

  ngOnDestroy(): void {
    if (!this.isBrowser()) return;
    this.killAllScrollTriggers();
    try {
      this.gsap?.globalTimeline?.clear?.();
    } catch {}
  }

  /**
   * ===== Navigation vers le détail =====
   * FR : /actualites-expertise-immobiliere/:slug
   * EN : /en/real-estate-valuation-news/:slug
   *
   * ✅ On privilégie prettySlug, et NewsDetail sait matcher wpSlug OU prettySlug.
   */
  detailLink(p: NewsPost): any[] {
    const slug = (p?.prettySlug || p?.slug || p?.id || '').toString();
    const isEN = this.currentPath().startsWith('/en/');
    return isEN ? ['/en', 'real-estate-valuation-news', slug] : ['/actualites-expertise-immobiliere', slug];
  }

  /* ============ Animations ============ */
  private initIntroSequence(onComplete?: () => void): void {
    if (!this.isBrowser() || !this.gsap) {
      onComplete?.();
      return;
    }
    if (this.introPlayed) {
      onComplete?.();
      return;
    }
    this.introPlayed = true;

    const gsap = this.gsap!;
    const titleEl = this.introTitle?.nativeElement;
    const subEl = this.introSubtitle?.nativeElement;
    const linkEl = this.introLinkedin?.nativeElement;

    // ✅ Boutons filtres (3 boutons)
    const filterBtns = (this.themeFilterBtns?.toArray() || [])
      .map((r) => r.nativeElement)
      .filter(Boolean);

    if (!titleEl || !subEl || !linkEl) {
      onComplete?.();
      return;
    }

    // Même logique que tes textes
    gsap.set([titleEl, subEl, linkEl], { autoAlpha: 0, y: 20 });

    // ✅ On masque aussi les boutons (si présents)
    if (filterBtns.length) {
      gsap.set(filterBtns, { autoAlpha: 0, y: 20, willChange: 'transform,opacity' });
    }

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.to(titleEl, { autoAlpha: 1, y: 0, duration: 0.65 })
      .to(subEl, { autoAlpha: 1, y: 0, duration: 0.65 }, '-=0.35')
      .to(linkEl, { autoAlpha: 1, y: 0, duration: 0.55 }, '-=0.40');

    // ✅ Ajout animation boutons, même style, avec stagger
    if (filterBtns.length) {
      tl.to(
        filterBtns,
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.55,
          stagger: 0.08,
          onComplete: () => gsap.set(filterBtns, { clearProps: 'transform,opacity,willChange' }),
        },
        '-=0.20',
      );
    }

    tl.add(() => onComplete && onComplete());
  }

  private animateFirstRow(): void {
    if (!this.isBrowser() || !this.gsap) return;
    const gsap = this.gsap!;

    const first = this.rows?.first?.nativeElement;
    if (!first) return;

    const bg = first.querySelector('.news-bg') as HTMLElement | null;
    const box = first.querySelector('.news-box') as HTMLElement | null;
    const items = first.querySelectorAll<HTMLElement>(
      '.theme-chip, .meta-line, .post-title, .post-excerpt, .card-cta, .news-col--image',
    );
    if (!box || !bg) return;

    if (items.length) gsap.set(items, { autoAlpha: 0, y: 24, willChange: 'transform,opacity' });

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.to(bg, {
      autoAlpha: 1,
      duration: 0.35,
      onStart: () => bg.classList.remove('prehide-row'),
      onComplete: () => gsap.set(bg, { clearProps: 'all' }),
    });

    tl.fromTo(
      box,
      { autoAlpha: 0, y: 26 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.55,
        immediateRender: false,
        onStart: () => box.classList.remove('prehide-row'),
        onComplete: () => gsap.set(box, { clearProps: 'all' }),
      },
      '-=0.05',
    );

    tl.to(
      items,
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.08,
        onComplete: () => gsap.set(items, { clearProps: 'transform,opacity,willChange' }),
      },
      '-=0.35',
    );
  }

  private initRowsScrollAnimations(): void {
    if (!this.isBrowser() || !this.gsap || !this.ScrollTrigger) return;
    const gsap = this.gsap!;

    this.rows.forEach((rowRef, idx) => {
      const row = rowRef.nativeElement;
      if ((row as any).__bound) return;
      (row as any).__bound = true;
      if (idx === 0) return;

      const bg = row.querySelector('.news-bg') as HTMLElement | null;
      const box = row.querySelector('.news-box') as HTMLElement | null;
      const items = row.querySelectorAll<HTMLElement>(
        '.theme-chip, .meta-line, .post-title, .post-excerpt, .card-cta, .news-col--image',
      );
      if (!box || !bg) return;

      gsap.set(items, { autoAlpha: 0, y: 26 });

      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
        scrollTrigger: { trigger: row, start: 'top 78%', once: true },
      });

      tl.to(bg, {
        autoAlpha: 1,
        duration: 0.35,
        onStart: () => bg.classList.remove('prehide-row'),
        onComplete: () => gsap.set(bg, { clearProps: 'all' }),
      })
        .fromTo(
          box,
          { autoAlpha: 0, y: 26 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.55,
            immediateRender: false,
            onStart: () => box.classList.remove('prehide-row'),
            onComplete: () => gsap.set(box, { clearProps: 'all' }),
          },
          '-=0.15',
        )
        .to(
          items,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.08,
            onComplete: () => gsap.set(items, { clearProps: 'transform,opacity' }),
          },
          '-=0.25',
        );
    });
  }

  /* ============ Paging / Order / Filters ============ */
  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private buildInitialOrder(items: NewsPost[]): NewsPost[] {
    const byTheme: Record<ThemeKey, NewsPost[]> = {
      expertise: [],
      juridique: [],
      marche: [],
      autre: [],
    };

    for (const p of items) byTheme[p.themeKey || 'autre'].push(p);

    // 1ère page : un “marché”, un “juridique”, un “expertise” si possible
    const firstPage: NewsPost[] = [];
    (['marche', 'juridique', 'expertise'] as ThemeKey[]).forEach((k) => {
      if (byTheme[k].length) {
        const pick = byTheme[k].splice(Math.floor(Math.random() * byTheme[k].length), 1)[0];
        firstPage.push(pick);
      }
    });

    const restPool = this.shuffle([
      ...byTheme.expertise,
      ...byTheme.juridique,
      ...byTheme.marche,
      ...byTheme.autre,
    ]);

    while (firstPage.length < this.pageSize && restPool.length) firstPage.push(restPool.shift()!);
    const remaining = restPool;

    return [...firstPage, ...remaining];
  }

  private restoreOrBuildOrder(items: NewsPost[]): NewsPost[] {
    const key = 'abc_news_order_v1';
    const uids = items.map((p) => p.uid || '').join(',');

    // ✅ SSR-safe : si pas browser, on ne tente pas sessionStorage
    if (!this.isBrowser()) return this.buildInitialOrder(items);

    try {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved) as { uids: string; order: string[] };
        if (parsed.uids === uids) {
          const byUid = new Map(items.map((p) => [p.uid, p]));
          const ordered: NewsPost[] = [];
          parsed.order.forEach((id) => {
            const it = byUid.get(id);
            if (it) ordered.push(it);
          });
          items.forEach((it) => {
            if (!parsed.order.includes(it.uid!)) ordered.push(it);
          });
          return ordered;
        }
      }

      const order = this.buildInitialOrder(items);
      sessionStorage.setItem(key, JSON.stringify({ uids, order: order.map((p) => p.uid) }));
      return order;
    } catch {
      return this.buildInitialOrder(items);
    }
  }

  private rebuildView(): void {
    let list = [...this.baseOrder];

    if (this.filterTheme) {
      list = list.filter((p) => p.themeKey === this.filterTheme);
    } else if (this.promoteTheme) {
      const head = list.filter((p) => p.themeKey === this.promoteTheme);
      const tail = list.filter((p) => p.themeKey !== this.promoteTheme);
      list = [...head, ...tail];
    }

    this.viewPosts = list;
    this.currentPage = 1;
    this.slicePage();
  }

  private slicePage(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    const newSlice = this.viewPosts.slice(start, start + this.pageSize);
    this.pagedPosts = newSlice;

    // ✅ expanded indexé sur la page courante
    this.expanded = new Array(this.pagedPosts.length).fill(false);

    this.killAllScrollTriggers();

    setTimeout(() => {
      this.rows?.forEach((r) => ((r.nativeElement as any).__bound = false));
      if (this.rows?.length) {
        this.initIntroSequence(() => this.animateFirstRow());
        this.initRowsScrollAnimations();
      }
    });

    if (this.isBrowser() && this.gsap && this.pager?.nativeElement) {
      this.gsap.fromTo(
        this.pager.nativeElement,
        { autoAlpha: 0, y: 10 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.45,
          ease: 'power3.out',
          delay: 0.05,
          immediateRender: false,
        },
      );
    }
  }

  onPromote(theme: ThemeKey): void {
    this.promoteTheme = this.promoteTheme === theme ? null : theme;
    this.filterTheme = null;
    this.rebuildView();
    if (this.isBrowser()) {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {}
    }
  }

  onFilter(theme: ThemeKey): void {
    this.filterTheme = this.filterTheme === theme ? null : theme;
    this.promoteTheme = null;
    this.rebuildView();
    if (this.isBrowser()) {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {}
    }
  }

  goPrev(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.slicePage();
      if (this.isBrowser()) {
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {}
      }
    }
  }

  goNext(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.slicePage();
      if (this.isBrowser()) {
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {}
      }
    }
  }

  /* ============ Extrait repliable (index page) ============ */
  async toggleExpand(i: number): Promise<void> {
    if (!this.isBrowser() || !this.gsap) {
      this.expanded[i] = !this.expanded[i];
      return;
    }

    const gsap = this.gsap!;
    const clip = this.clips.get(i)?.nativeElement;
    const body = this.bodies.get(i)?.nativeElement;
    if (!clip || !body) return;

    gsap.killTweensOf(clip);
    const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

    if (!this.expanded[i]) {
      const startH = body.getBoundingClientRect().height;
      gsap.set(clip, { height: startH, overflow: 'hidden', willChange: 'height' });

      body.classList.remove('is-clamped');
      await nextFrame();

      const targetH = body.scrollHeight;
      this.expanded[i] = true;

      const ro = new ResizeObserver(() => {
        if (clip.style.height !== 'auto') gsap.set(clip, { height: body.scrollHeight });
      });
      ro.observe(body);

      gsap.to(clip, {
        height: targetH,
        duration: 0.9,
        ease: 'power3.out',
        onComplete: () => {
          ro.disconnect();
          gsap.set(clip, { height: 'auto', clearProps: 'willChange,overflow' });
        },
      });
    } else {
      const startH = clip.getBoundingClientRect().height || body.scrollHeight;
      body.classList.add('is-clamped');
      await nextFrame();

      const targetH = body.getBoundingClientRect().height;

      gsap.set(clip, { height: startH, overflow: 'hidden', willChange: 'height' });
      gsap.to(clip, {
        height: targetH,
        duration: 0.8,
        ease: 'power3.inOut',
        onComplete: () => {
          this.expanded[i] = false;
          gsap.set(clip, { height: 'auto', clearProps: 'willChange,overflow' });
        },
      });
    }
  }

  /* ============ Helpers ============ */
  private toThemeKey(raw?: string): ThemeKey {
    const s = (raw || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (s.includes('expert')) return 'expertise';
    if (s.includes('jurid')) return 'juridique';
    if (s.includes('march')) return 'marche';
    return 'autre';
  }

  themeClass(k?: ThemeKey) {
    return k ? `theme-${k}` : 'theme-autre';
  }

  trackByIndex(i: number) {
    return i;
  }

  private stripHtml(raw: string): string {
    return (raw || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private makePrettySlug(title: string, maxWords = 6): string {
    const plain = this.stripHtml(title || '');
    const tokens = plain
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const cut = tokens.slice(0, maxWords).join('-');
    return cut.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'article';
  }

  private forceInitialHidden(host: HTMLElement) {
    if (!this.isBrowser() || !this.gsap) return;
    const gsap = this.gsap!;
    const pre = Array.from(host.querySelectorAll<HTMLElement>('.prehide'));
    const rows = Array.from(host.querySelectorAll<HTMLElement>('.prehide-row'));
    if (pre.length) gsap.set(pre, { autoAlpha: 0, y: 20, visibility: 'hidden' });
    if (rows.length) gsap.set(rows, { autoAlpha: 0, visibility: 'hidden' });
  }

  private killAllScrollTriggers() {
    if (!this.isBrowser() || !this.ScrollTrigger) return;
    try {
      this.ScrollTrigger.getAll().forEach((t: any) => t.kill());
    } catch {}
  }

  /** ====== Media ====== */
  private async resolveMedia(idOrUrl: any): Promise<string> {
    if (!idOrUrl) return '';

    if (typeof idOrUrl === 'object') {
      const src = idOrUrl?.source_url || idOrUrl?.url || idOrUrl?.medium_large || idOrUrl?.large || '';
      if (src) return src;
      if (idOrUrl?.id != null) idOrUrl = idOrUrl.id;
    }

    if (typeof idOrUrl === 'number' || (typeof idOrUrl === 'string' && /^\d+$/.test(idOrUrl.trim()))) {
      try {
        return (await firstValueFrom(this.wp.getMediaUrl(+idOrUrl))) || '';
      } catch {
        return '';
      }
    }

    if (typeof idOrUrl === 'string') {
      const s = idOrUrl.trim();
      if (!s) return '';
      if (/^(https?:)?\/\//.test(s) || s.startsWith('/') || s.startsWith('data:')) return s;
      return s;
    }

    return '';
  }

  private preload(src: string): Promise<void> {
    if (!src || !this.isBrowser()) return Promise.resolve();
    return new Promise<void>((res) => {
      const img = new Image();
      img.onload = () => res();
      img.onerror = () => res();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = src;
    });
  }

  private async runWithLimit<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
    const results: T[] = [];
    let i = 0;

    const workers = new Array(Math.max(1, limit)).fill(0).map(async () => {
      while (i < tasks.length) {
        const idx = i++;
        try {
          results[idx] = await tasks[idx]();
        } catch {
          // @ts-ignore
          results[idx] = undefined;
        }
      }
    });

    await Promise.all(workers);
    return results;
  }

  private async hydratePostMedia(items: NewsPost[]): Promise<void> {
    // 1) Résout les URLs (sans tout précharger d’un coup)
    await this.runWithLimit(
      items.map((p) => async () => {
        const img = await this.resolveMedia(p.imageUrl);
        const logo = await this.resolveMedia(p.firmLogo);
        p._imageUrl = img || p._imageUrl || '';
        p._firmLogoUrl = logo || p._firmLogoUrl || '';
        return true;
      }),
      4,
    );

    // 2) Précharge seulement ce qui est très probable above-the-fold (1ère page)
    const firstSlice = items.slice(0, Math.max(this.pageSize, 3));
    const preloadTasks: Array<() => Promise<void>> = [];

    firstSlice.forEach((p) => {
      if (p._imageUrl) preloadTasks.push(() => this.preload(p._imageUrl!));
      if (p._firmLogoUrl) preloadTasks.push(() => this.preload(p._firmLogoUrl!));
    });

    // Idle + concurrency bornée
    this.defer(() => {
      void this.runWithLimit(preloadTasks, this.MAX_PARALLEL_PRELOAD);
    });
  }

  /** ====== SEO helpers ====== */
  private currentPath(): string {
    if (this.isBrowser()) {
      try {
        return window?.location?.pathname || '/';
      } catch {
        return this.router?.url || '/';
      }
    }
    return this.router?.url || '/';
  }

  private normalizeUrl(base: string, path: string): string {
    const b = base.endsWith('/') ? base.slice(0, -1) : base;
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${b}${p}`;
  }
}
