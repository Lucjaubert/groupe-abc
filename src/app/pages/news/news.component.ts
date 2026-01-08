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
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { ImgFastDirective } from '../../directives/img-fast.directive';
import { FaqService, FaqItem } from '../../services/faq.service';
import { environment } from '../../../environments/environment';
import { getSeoForRoute } from '../../config/seo.routes';

type Lang = 'fr' | 'en';

type NewsIntro = {
  title: string;
  html: string;
  linkedinUrl?: string;
};
type ThemeKey = 'expertise' | 'juridique' | 'marche' | 'autre';

type NewsPost = {
  id?: number | string;
  slug?: string;
  uid?: string;
  theme?: string;
  themeKey?: ThemeKey;
  firmLogo?: string | number;
  firmName?: string;
  author?: string;
  date?: string;
  title?: string;
  html?: string;
  imageUrl?: string | number;
  linkedinUrl?: string;
  _imageUrl?: string;
  _firmLogoUrl?: string;
};

@Component({
  selector: 'app-news',
  standalone: true,
  imports: [CommonModule, ImgFastDirective],
  templateUrl: './news.component.html',
  styleUrls: ['./news.component.scss'],
})
export class NewsComponent implements OnInit, AfterViewInit, OnDestroy {
  private wp = inject(WordpressService);
  private seo = inject(SeoService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private faq = inject(FaqService);

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

  s(v: unknown): string {
    return v == null ? '' : '' + v;
  }

  /* ===== Données ===== */
  intro: NewsIntro = {
    title: 'Actualités',
    html:
      'Retrouvez nos points de marché, décryptages réglementaires, retours d’expérience et temps forts de nos huit cabinets…<br/>À suivre ici et sur notre compte LinkedIn',
    linkedinUrl: '',
  };

  posts: NewsPost[] = [];
  private baseOrder: NewsPost[] = [];
  viewPosts: NewsPost[] = [];
  pagedPosts: NewsPost[] = [];
  expanded: boolean[] = [];

  @ViewChild('introTitle')
  introTitle!: ElementRef<HTMLElement>;
  @ViewChild('introSubtitle')
  introSubtitle!: ElementRef<HTMLElement>;
  @ViewChild('introLinkedin')
  introLinkedin!: ElementRef<HTMLElement>;
  @ViewChildren('newsRow')
  rows!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('excerptClip')
  clips!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('excerptBody')
  bodies!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('pagerWrapper')
  pagerWrapper!: ElementRef<HTMLElement>;
  @ViewChild('pager')
  pager!: ElementRef<HTMLElement>;

  private rowsAnimationsInitialized = false;

  pageSize = 3;
  currentPage = 1;
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.viewPosts.length / this.pageSize));
  }

  promoteTheme: ThemeKey | null = null;
  filterTheme: ThemeKey | null = null;

  private introPlayed = false;

  /* ===== FAQ SEO – page News ===== */
  private readonly NEWS_FAQ_FR: FaqItem[] = [
    {
      q: 'À quelle fréquence publiez-vous des actualités ?',
      a: 'Nous publions au fil des décisions marquantes, des évolutions réglementaires et des analyses de marché. Le rythme varie selon l’actualité, avec un minimum d’une à deux publications par mois.',
    },
    {
      q: 'D’où proviennent vos contenus ?',
      a: 'Les articles sont rédigés par nos experts et responsables de pôles. Les sources utilisées sont citées lorsqu’il s’agit de textes officiels, décisions de justice ou données publiques.',
    },
    {
      q: 'Comment être informé des nouvelles publications ?',
      a: 'Le plus simple est de suivre la page LinkedIn du Groupe ABC : vous serez notifié lors de chaque nouveau post.',
    },
    {
      q: 'Puis-je proposer un sujet ou une question ?',
      a: 'Oui. Vous pouvez nous écrire via la page Contact pour suggérer un thème (marché, juridique, méthodologie).',
    },
  ];
  private readonly NEWS_FAQ_EN: FaqItem[] | undefined = undefined;

  async ngOnInit(): Promise<void> {
    // Expose la FAQ (affichage + éventuel JSON-LD géré par FaqService)
    this.faq.set(this.NEWS_FAQ_FR, this.NEWS_FAQ_EN);

    const list: any[] = await firstValueFrom(this.wp.getAllNews());

    /* ===== Intro depuis le post "news" (ACF news.section_title / intro_body / linkedin_url) ===== */
    const introSource = list.find(
      (it: any) => it?.slug === 'news' && it?.acf?.news,
    );
    if (introSource?.acf?.news) {
      const n = introSource.acf.news;
      if (n.section_title) this.intro.title = n.section_title;
      if (n.intro_body) this.intro.html = n.intro_body;
      if (n.linkedin_url) this.intro.linkedinUrl = n.linkedin_url;
    } else {
      // Fallback : récupérer au moins l’URL LinkedIn si elle existe quelque part
      this.intro.linkedinUrl =
        list.find((it: any) => it?.acf?.news?.linkedin_url)?.acf?.news
          ?.linkedin_url || '';
    }

    /* ===== Mapping des posts depuis l’API /wp-json/wp/v2/news ===== */
    const mapped: NewsPost[] = [];
    for (const it of list) {
      const p = it?.acf?.post || {};
      if (!p) continue;

      const firmLogo: string | number | undefined =
        typeof p.logo_firm === 'string' || typeof p.logo_firm === 'number'
          ? p.logo_firm
          : undefined;

      const imageUrl: string | number | undefined =
        typeof p.post_image === 'string' || typeof p.post_image === 'number'
          ? p.post_image
          : undefined;

      mapped.push({
        id: it?.id,
        slug: it?.slug,
        uid:
          (it?.id ? String(it.id) : '') +
          '|' +
          (p.post_title || '') +
          '|' +
          (p.date || ''),
        theme: p.theme || '',
        themeKey: this.toThemeKey(p.theme),
        firmLogo,
        firmName: p.nam_firm || '',
        author: p.author || '',
        date: p.date || it?.date || '',
        title: p.post_title || it?.title?.rendered || '',
        html: p.post_content || it?.content?.rendered || '',
        imageUrl,
        linkedinUrl: p.linkedin_link || '',
      });
    }

    // Résolution/préchargement médias (URL directes ou ID WP)
    await this.hydratePostMedia(mapped);

    this.posts = mapped;
    this.expanded = new Array(this.posts.length).fill(false);

    // Réordonner si ?open= est présent
    const open = this.route.snapshot.queryParamMap.get('open');
    if (open) {
      const idx = this.posts.findIndex(
        (p) =>
          (p.slug && p.slug === open) || (p.id && String(p.id) === open),
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

    // Ouvrir l’article ciblé puis nettoyer l’URL
    if (open) {
      setTimeout(() => {
        this.expanded[0] = true;
        if (this.isBrowser()) {
          try {
            window.scrollTo({ top: 0 });
          } catch {}
        }
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
      });
    }

    /* ======================= SEO via config centrale ======================= */

    const isEN = this.currentPath().startsWith('/en/');
    const lang: Lang = isEN ? 'en' : 'fr';

    const baseSeo = getSeoForRoute('news-list', lang);

    const siteUrl = (environment.siteUrl || 'https://groupe-abc.fr').replace(
      /\/+$/,
      '',
    );
    const defaultPathFR = '/actualites-expertise-immobiliere';
    const defaultPathEN = '/en/news-real-estate-valuation';

    const canonicalAbs =
      baseSeo.canonical ||
      `${siteUrl}${isEN ? defaultPathEN : defaultPathFR}`;

    // ItemList pour quelques articles de la page courante
    const itemListElements =
      this.pagedPosts.slice(0, 5).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${canonicalAbs}#${encodeURIComponent(
          p.slug || String(p.id || i),
        )}`,
      })) || [];

    // FAQ JSON-LD sur cette page (en plus de ce que fait FaqService)
    const faqSource: FaqItem[] = isEN
      ? this.NEWS_FAQ_EN ?? []
      : this.NEWS_FAQ_FR ?? [];

    const nodes: any[] = [];

    if (itemListElements.length) {
      nodes.push({
        '@type': 'ItemList',
        '@id': `${canonicalAbs}#list`,
        itemListElement: itemListElements,
      });
    }

    if (faqSource.length) {
      nodes.push({
        '@type': 'FAQPage',
        '@id': `${canonicalAbs}#faq`,
        mainEntity: faqSource.map((q) => ({
          '@type': 'Question',
          name: q.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: q.a,
          },
        })),
      });
    }

    // Merge avec un éventuel JSON-LD déjà présent dans la config centrale
    const existingJsonLd: any = baseSeo.jsonLd;
    let baseGraph: any[] = [];
    let baseContext = 'https://schema.org';

    if (existingJsonLd) {
      if (Array.isArray(existingJsonLd['@graph'])) {
        baseGraph = existingJsonLd['@graph'];
      } else {
        baseGraph = [existingJsonLd];
      }
      if (typeof existingJsonLd['@context'] === 'string') {
        baseContext = existingJsonLd['@context'];
      }
    }

    const jsonLd =
      nodes.length || baseGraph.length
        ? {
            '@context': baseContext,
            '@graph': [...baseGraph, ...nodes],
          }
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
    const ScrollTrigger = this.ScrollTrigger!;

    const host = document.querySelector(
      '.news-wrapper',
    ) as HTMLElement | null;
    if (host) this.forceInitialHidden(host);

    if (this.pagerWrapper?.nativeElement) {
      gsap.to(this.pagerWrapper.nativeElement, {
        autoAlpha: 1,
        duration: 0.01,
      });
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
    if (!titleEl || !subEl || !linkEl) {
      onComplete?.();
      return;
    }

    gsap.set([titleEl, subEl, linkEl], { autoAlpha: 0, y: 20 });

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to(titleEl, { autoAlpha: 1, y: 0, duration: 0.65 })
      .to(
        subEl,
        { autoAlpha: 1, y: 0, duration: 0.65 },
        '-=0.35',
      )
      .to(
        linkEl,
        { autoAlpha: 1, y: 0, duration: 0.55 },
        '-=0.40',
      )
      .add(() => {
        onComplete && onComplete();
      });
  }

  private animateFirstRow(): void {
    if (!this.isBrowser() || !this.gsap) return;
    const gsap = this.gsap!;

    const first = this.rows?.first?.nativeElement;
    if (!first) return;
    if ((first as any).__bound) return;
    (first as any).__bound = true;

    const bg = first.querySelector('.news-bg') as HTMLElement | null;
    const box = first.querySelector('.news-box') as HTMLElement | null;
    const items = first.querySelectorAll<HTMLElement>(
      '.theme-chip, .meta-line, .post-title, .post-excerpt, .card-cta, .news-col--image',
    );
    if (!box || !bg) return;

    if (items.length)
      gsap.set(items, {
        autoAlpha: 0,
        y: 24,
        willChange: 'transform,opacity',
      });

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.to(bg, {
      autoAlpha: 1,
      duration: 0.35,
      onStart: () => {
        bg.classList.remove('prehide-row');
      },
      onComplete: () => {
        gsap.set(bg, { clearProps: 'all' });
      },
    });

    tl.fromTo(
      box,
      { autoAlpha: 0, y: 26 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.55,
        immediateRender: false,
        onStart: () => {
          box.classList.remove('prehide-row');
        },
        onComplete: () => {
          gsap.set(box, { clearProps: 'all' });
        },
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
        onComplete: () => {
          gsap.set(items, {
            clearProps: 'transform,opacity,willChange',
          });
        },
      },
      '-=0.35',
    );
  }

  private initRowsScrollAnimations(): void {
    if (!this.isBrowser() || !this.gsap || !this.ScrollTrigger) return;
    const gsap = this.gsap!;
    const ScrollTrigger = this.ScrollTrigger!;

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
        onStart: () => {
          bg.classList.remove('prehide-row');
        },
        onComplete: () => {
          gsap.set(bg, { clearProps: 'all' });
        },
      })
        .fromTo(
          box,
          { autoAlpha: 0, y: 26 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.55,
            immediateRender: false,
            onStart: () => {
              box.classList.remove('prehide-row');
            },
            onComplete: () => {
              gsap.set(box, { clearProps: 'all' });
            },
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
            onComplete: () => {
              gsap.set(items, {
                clearProps: 'transform,opacity',
              });
            },
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

    const firstPage: NewsPost[] = [];
    (['marche', 'juridique', 'expertise'] as ThemeKey[]).forEach((k) => {
      if (byTheme[k].length) {
        const pick =
          byTheme[k].splice(
            Math.floor(Math.random() * byTheme[k].length),
            1,
          )[0];
        firstPage.push(pick);
      }
    });

    const restPool = this.shuffle([
      ...byTheme.expertise,
      ...byTheme.juridique,
      ...byTheme.marche,
      ...byTheme.autre,
    ]);
    while (firstPage.length < this.pageSize && restPool.length)
      firstPage.push(restPool.shift()!);
    const remaining = restPool;

    return [...firstPage, ...remaining];
  }

  private restoreOrBuildOrder(items: NewsPost[]): NewsPost[] {
    const key = 'abc_news_order_v1';
    const uids = items.map((p) => p.uid || '').join(',');
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          uids: string;
          order: string[];
        };
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
      sessionStorage.setItem(
        key,
        JSON.stringify({ uids, order: order.map((p) => p.uid) }),
      );
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

    this.killAllScrollTriggers();

    setTimeout(() => {
      this.rows?.forEach((r) => {
        (r.nativeElement as any).__bound = false;
      });

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

  /* ============ Extrait repliable ============ */
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
    const nextFrame = () =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => r()),
      );

    if (!this.expanded[i]) {
      const startH = body.getBoundingClientRect().height;
      gsap.set(clip, {
        height: startH,
        overflow: 'hidden',
        willChange: 'height',
      });

      body.classList.remove('is-clamped');
      await nextFrame();

      const targetH = body.scrollHeight;
      this.expanded[i] = true;

      const ro = new ResizeObserver(() => {
        if (clip.style.height !== 'auto')
          gsap.set(clip, { height: body.scrollHeight });
      });
      ro.observe(body);

      gsap.to(clip, {
        height: targetH,
        duration: 0.9,
        ease: 'power3.out',
        onComplete: () => {
          ro.disconnect();
          gsap.set(clip, {
            height: 'auto',
            clearProps: 'willChange,overflow',
          });
        },
      });
    } else {
      const startH =
        clip.getBoundingClientRect().height || body.scrollHeight;
      body.classList.add('is-clamped');
      await nextFrame();
      const targetH = body.getBoundingClientRect().height;

      gsap.set(clip, {
        height: startH,
        overflow: 'hidden',
        willChange: 'height',
      });
      gsap.to(clip, {
        height: targetH,
        duration: 0.8,
        ease: 'power3.inOut',
        onComplete: () => {
          this.expanded[i] = false;
          gsap.set(clip, {
            height: 'auto',
            clearProps: 'willChange,overflow',
          });
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

  private strip(html: string, max = 160) {
    const t = (html || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  private forceInitialHidden(host: HTMLElement) {
    if (!this.isBrowser() || !this.gsap) return;
    const gsap = this.gsap!;
    const pre = Array.from(
      host.querySelectorAll<HTMLElement>('.prehide'),
    );
    const rows = Array.from(
      host.querySelectorAll<HTMLElement>('.prehide-row'),
    );
    if (pre.length)
      gsap.set(pre, {
        autoAlpha: 0,
        y: 20,
        visibility: 'hidden',
      });
    if (rows.length)
      gsap.set(rows, {
        autoAlpha: 0,
        visibility: 'hidden',
      });
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
      const src =
        idOrUrl?.source_url ||
        idOrUrl?.url ||
        idOrUrl?.medium_large ||
        idOrUrl?.large ||
        '';
      if (src) return src;
      if (idOrUrl?.id != null) idOrUrl = idOrUrl.id;
    }
    if (
      typeof idOrUrl === 'number' ||
      (typeof idOrUrl === 'string' &&
        /^\d+$/.test(idOrUrl.trim()))
    ) {
      try {
        return (
          (await firstValueFrom(
            this.wp.getMediaUrl(+idOrUrl),
          )) || ''
        );
      } catch {
        return '';
      }
    }
    if (typeof idOrUrl === 'string') {
      const s = idOrUrl.trim();
      if (!s) return '';
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
    if (!src || !this.isBrowser())
      return Promise.resolve();
    return new Promise<void>((res) => {
      const img = new Image();
      img.onload = () => res();
      img.onerror = () => res();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = src;
    });
  }

  private async hydratePostMedia(items: NewsPost[]): Promise<void> {
    await Promise.all(
      items.map(async (p) => {
        const img = await this.resolveMedia(p.imageUrl);
        const logo = await this.resolveMedia(p.firmLogo);
        if (img) {
          await this.preload(img);
          p._imageUrl = img;
        }
        if (logo) {
          await this.preload(logo);
          p._firmLogoUrl = logo;
        }
      }),
    );
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
}
