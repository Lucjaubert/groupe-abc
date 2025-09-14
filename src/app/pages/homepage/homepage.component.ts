import {
  Component, OnDestroy, OnInit, AfterViewInit, inject,
  ViewChildren, QueryList, ElementRef, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';

/* === GSAP === */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AlignFirstWordDirective } from '../../shared/directives/align-first-word.directive';

type Slide = { title: string; subtitle: string; bg: string };

type KeyFigure = {
  value: number;
  label: string;
  labelBis?: string;
  display: string;
  typed: string;
  fullLabel: string;
  digits: number;
  played: boolean;
};

type Identity = {
  whoTitle: string;
  whoHtml: string;
  whereTitle: string;
  whereMap?: string;
  whereItems: string[];
};

type WhatHow = {
  whatTitle: string;
  whatItems: string[];
  howTitle: string;
  howItems: string[];
};

type Presentation = {
  text1: string;
  text2: string;
  file: string | null;
};

type ContextItem = { icon: string; label: string };
type ExpertiseContext = { title: string; items: ContextItem[] };

/* ===== Clients ===== */
type Clients = { icon: string; title: string; items: string[] };

/* ===== Team ===== */
type TeamMember = {
  photo: string;
  nameFirst: string;
  nameLast: string;
  area: string;
  jobHtml: string;
};

/* ===== THEME (News) ===== */
type ThemeKey = 'marche' | 'juridique' | 'expertise' | 'autre';

/* ===== NEWS (Home) ===== */
type NewsItem = {
  logo?: string;
  firm?: string;
  theme?: string;            // libellé WP (Marché, Juridique, Expertise…)
  authorDate?: string;
  title?: string;
  html?: string;
  link?: string;             // URL « lire la suite »
  id?: number | string;
  slug?: string;
  themeKey?: ThemeKey;       // ajouté côté front pour la classe de thème
};
type News = { title: string; items: NewsItem[] };

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [CommonModule, RouterModule, AlignFirstWordDirective],
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.scss']
})
export class HomepageComponent implements OnInit, AfterViewInit, OnDestroy {
  acf: any = {};

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

  // Flags de synchronisation
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
  /** Largeur (en ch) réservée à la colonne chiffres en mobile (non bloquante) */
  maxValueCh = 6; // fallback

  /* ---------- IDENTITY / WHAT-HOW / DOWNLOAD ---------- */
  identity: Identity = {
    whoTitle: '',
    whoHtml: '',
    whereTitle: '',
    whereMap: '',
    whereItems: []
  };
  whereItems: string[] = [];
  whereOpen = false;
  toggleWhere(): void { this.whereOpen = !this.whereOpen; }

  whatHow: WhatHow | null = null;
  presentation: Presentation = { text1: '', text2: '', file: null };

  /* ---------- CONTEXTES ---------- */
  contexts: ExpertiseContext | null = null;

  /* ---------- CLIENTS ---------- */
  clients: Clients | null = null;

  /* ---------- TEAM ---------- */
  teamTitle = '';
  teamMembers: TeamMember[] = [];
  teamPages: TeamMember[][] = [];
  teamPageIndex = 0;
  private teamAutoplayRef: any = null;
  teamAutoplayMs = 5000;
  teamAutoplayStoppedByUser = false;

  get currentSlide(): Slide | undefined { return this.heroSlides[this.heroIndex]; }

  private wp = inject(WordpressService);
  private seo = inject(SeoService);

  // Titre sur 2 lignes
  teamTitleLine1 = 'Une équipe';
  teamTitleLine2 = 'de 8 experts à vos côtés';

  /* NEWS */
  news: News | null = null;

  /* ==================================================== */
  /*                        LIFECYCLE                     */
  /* ==================================================== */
  ngOnInit(): void {
    try { gsap.registerPlugin(ScrollTrigger); } catch {}

    this.wp.getHomepageData().subscribe(acf => {
      this.acf = acf;

      // HERO
      this.extractHero();
      this.preloadHeroImages();
      this.applySeoFromHero();
      this.heroDataReady = true;
      this.tryInitHeroIntro();

      // CONTENT
      this.extractKeyFigures();
      this.extractIdentity();
      this.extractWhatHowAndPresentation();
      this.extractExpertiseContext();
      this.extractClientsSection();

      // TEAM
      this.extractTeamSection();
      this.startTeamAutoplay();

      // NEWS (depuis le champ Relation `news_featured`)
      this.loadFeaturedNews();

      setTimeout(() => { this.bindScrollAnimations(); }, 0);
    });

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  ngAfterViewInit(): void {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const idx = Number((e.target as HTMLElement).dataset['index']);
          this.playFigure(idx);
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.25 });

    this.kfItems.changes.subscribe(() => {
      this.kfItems.forEach(el => io.observe(el.nativeElement));
    });
    setTimeout(() => this.kfItems.forEach(el => io.observe(el.nativeElement)));

    this.viewReady = true;
    this.tryInitHeroIntro();

    setTimeout(() => { this.bindScrollAnimations(); }, 0);
  }

  ngOnDestroy(): void {
    this.clearAutoplay();
    this.clearTeamAutoplay();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}
    try { gsap.globalTimeline.clear(); } catch {}
  }

  /* ==================================================== */
  /*                         HERO                         */
  /* ==================================================== */
  private extractHero(): void {
    const h = this.acf?.hero_section || {};
    this.heroSlides = [
      { title: h.hero_title_1 || '', subtitle: h.hero_subtitle_1 || '', bg: h.hero_background_1 || '' },
      { title: h.hero_title_2 || '', subtitle: h.hero_subtitle_2 || '', bg: h.hero_background_2 || '' },
      { title: h.hero_title_3 || '', subtitle: h.hero_subtitle_3 || '', bg: h.hero_background_3 || '' }
    ].filter(s => !!s.bg);

    if (!this.heroSlides.length && (h.hero_background || '')) {
      this.heroSlides = [{ title: h.hero_title || '', subtitle: h.hero_subtitle || '', bg: h.hero_background || '' }];
    }
    this.heroIndex = 0;
  }

  private preloadHeroImages(): void {
    for (const s of this.heroSlides) {
      const img = new Image();
      img.src = s.bg;
    }
  }

  private tryInitHeroIntro(): void {
    if (this.heroIntroDone || !this.viewReady || !this.heroDataReady) return;
    queueMicrotask(() => setTimeout(() => this.initHeroIntroNow(), 0));
  }

  private initHeroIntroNow(): void {
    if (this.heroIntroDone) return;

    this.prefersReduced = typeof window !== 'undefined'
      ? (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false)
      : false;

    const bg      = this.heroBgRef?.nativeElement;
    const layers  = this.heroLayerEls?.toArray().map(r => r.nativeElement) ?? [];
    const titleEl = this.heroTitleEl?.nativeElement;
    const subEl   = this.heroSubtitleEl?.nativeElement;

    if (layers.length) {
      layers.forEach((el, i) => gsap.set(el, { opacity: i === this.heroIndex ? 1 : 0 }));
      if (bg) bg.classList.add('is-ready');
    }

    if (titleEl) gsap.set(titleEl, { autoAlpha: 0, y: 16, willChange: 'transform,opacity' });
    if (subEl)   gsap.set(subEl,   { autoAlpha: 0, y: 12, willChange: 'transform,opacity' });

    const heroEl = document.getElementById('hero');
    const dots = heroEl ? Array.from(heroEl.querySelectorAll<HTMLButtonElement>('.hero-dots .hero-dot')) : [];
    if (dots.length) gsap.set(dots, { autoAlpha: 0, y: 10, willChange: 'transform,opacity' });

    const DUR_T = this.prefersReduced ? 0.001 : 2.5;
    const DUR_S = this.prefersReduced ? 0.001 : 1;

    this.pauseAutoplay();

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => {
        this.heroIntroDone = true;
        if (titleEl) gsap.set(titleEl, { clearProps: 'willChange' });
        if (subEl)   gsap.set(subEl,   { clearProps: 'willChange' });
        if (dots.length) gsap.set(dots, { clearProps: 'willChange' });
        this.resumeAutoplay();
      }
    });

    tl.to(titleEl, { autoAlpha: 1, y: 0, duration: DUR_T }, 0.5)
      .to(subEl,   { autoAlpha: 1, y: 0, duration: DUR_S }, 0.8)
      .to(dots,    { autoAlpha: 1, y: 0, duration: 0.5, stagger: { each: 0.08, from: 'start' } }, 1.5);

    if (this.prefersReduced) {
      this.heroIntroDone = true;
      this.resumeAutoplay();
    }
  }

  /* Navigation Hero */
  goTo(i: number): void {
    if (!this.heroSlides.length) return;
    const len = this.heroSlides.length;
    this.heroIndex = ((i % len) + len) % len;
  }
  next(): void { this.goTo(this.heroIndex + 1); }
  prev(): void { this.goTo(this.heroIndex - 1); }

  /* Autoplay */
  startAutoplay(): void {
    this.clearAutoplay();
    if (this.heroSlides.length > 1) {
      this.autoplayRef = setInterval(() => this.next(), this.autoplayMs);
    }
  }
  pauseAutoplay(): void { this.clearAutoplay(); }
  resumeAutoplay(): void {
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
    if (document.visibilityState === 'hidden') {
      this.pauseAutoplay();
      this.clearTeamAutoplay();
    } else {
      this.resumeAutoplay();
      if (!this.teamAutoplayStoppedByUser) this.startTeamAutoplay();
    }
  };

  onKeydown(evt: KeyboardEvent): void {
    if (this.heroSlides.length < 2) return;
    if (evt.key === 'ArrowRight') { this.pauseAutoplay(); this.next(); }
    else if (evt.key === 'ArrowLeft') { this.pauseAutoplay(); this.prev(); }
  }
  onPointerDown(evt: PointerEvent): void { this.pointerStartX = evt.clientX; }
  onPointerUp(evt: PointerEvent): void {
    if (this.pointerStartX == null) return;
    const dx = evt.clientX - this.pointerStartX;
    this.pointerStartX = null;
    if (Math.abs(dx) > this.swipeThreshold) {
      this.pauseAutoplay();
      if (dx < 0) this.next(); else this.prev();
    }
  }

  /* ==================================================== */
  /*                     KEY FIGURES                      */
  /* ==================================================== */
  private extractKeyFigures(): void {
    const fig = this.acf?.key_figures_section || {};
    const out: KeyFigure[] = [];
    const widths: number[] = [];

    let i = 1;
    while (fig[`figure_value_${i}`] || fig[`figure_label_${i}`] || fig[`figure_value_${i}_bis`]) {
      const vRaw = fig[`figure_value_${i}`];
      const l = fig[`figure_label_${i}`];
      const lBisMerge = fig[`figure_label_${i}_bis`];

      if (vRaw && (l || lBisMerge)) {
        widths.push(this.widthChFromRaw(vRaw));
        const value = Number(String(vRaw).replace(/[^\d]/g, '')) || 0;
        const fullLabel = (l || '') + (lBisMerge ? ` ${lBisMerge}` : '');
        out.push({
          value, label: l || '', labelBis: lBisMerge || '',
          display: '', typed: '', fullLabel,
          digits: String(value).length || 1, played: false
        });
      }

      if (fig[`figure_value_${i}_bis`] && fig[`figure_label_${i}_bis`]) {
        const v2raw = fig[`figure_value_${i}_bis`];
        widths.push(this.widthChFromRaw(v2raw));
        const v2 = Number(String(v2raw).replace(/[^\d]/g, '')) || 0;
        const l2 = String(fig[`figure_label_${i}_bis`]);
        out.push({
          value: v2, label: l2, labelBis: '',
          display: '', typed: '', fullLabel: l2,
          digits: String(v2).length || 1, played: false
        });
      }
      i++;
    }

    this.keyFigures = out;
    this.maxValueCh = Math.max(6, ...(widths.length ? widths : [6]));
  }

  private playFigure(index: number): void {
    const f = this.keyFigures[index];
    if (!f || f.played) return;
    f.played = true;

    const target = f.value;
    const dur = 4000;
    const start = performance.now();
    const totalChars = f.fullLabel.length;

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const p = easeOutCubic(t);

      const val = Math.round(target * p);
      f.display = val ? String(val) : '';

      const chars = Math.floor(totalChars * p);
      f.typed = f.fullLabel.slice(0, chars);

      if (t < 1) requestAnimationFrame(step);
      else {
        f.display = String(target);
        f.typed = f.fullLabel;
      }
    };

    requestAnimationFrame(step);
  }

  /**** UTILS ****/
  private widthChFromRaw(raw: any): number {
    // Calcule une largeur "ch" approximative pour la valeur brute (gère espaces + virgule/point)
    const s = String(raw ?? '').replace(/\s/g, '');     // retire espaces (y compris insécables)
    const digits = (s.match(/\d/g) ?? []).length;       // nombre de chiffres
    const hasDecimal = /[,.]/.test(s);                  // virgule/point présent ?
    return Math.max(digits + (hasDecimal ? 2 : 0), 1);  // réserve 1–2ch pour la virgule
  }

  /* ==================================================== */
  /*                     IDENTITY / WH                    */
  /* ==================================================== */
  private extractIdentity(): void {
    const id = this.acf?.identity_section || {};
    this.identity = {
      whoTitle: id.who_title || 'Qui ?',
      whoHtml: id.who_text || '',
      whereTitle: id.where_title || 'Où ?',
      whereMap: id.where_map || '',
      whereItems: [
        id.where_item_1, id.where_item_2, id.where_item_3, id.where_item_4,
        id.where_item_5, id.where_item_6, id.where_item_7, id.where_item_8
      ].filter(Boolean)
    };
    this.whereItems = this.identity.whereItems;
  }

  private applySeoFromHero(): void {
    const s = this.acf?.seo_section || {};
    const first = this.heroSlides[0] || { title: '', subtitle: '', bg: '' };
    const seoImage = (s.seo_image && (s.seo_image.url || s.seo_image)) || first.bg;

    this.seo.update({
      title: s.seo_title || first.title || 'Groupe ABC – Expertise immobilière',
      description: s.seo_description || first.subtitle,
      keywords: s.seo_keywords,
      image: seoImage,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Groupe ABC',
        url: window.location.href,
        logo: seoImage,
        description: s.seo_description || first.subtitle
      }
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

  /* ==================================================== */
  /*       ANIMS (ScrollTrigger)                          */
  /* ==================================================== */
  private bindScrollAnimations(): void {
    const EASE = 'power3.out';
    const prefersReduced =
      typeof window !== 'undefined'
        ? (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false)
        : false;

    const DUR_TITLE   = prefersReduced ? 0.001 : 0.55;
    const DUR_BLOCK   = prefersReduced ? 0.001 : 0.45;
    const STAG_SMALL  = prefersReduced ? 0     : 0.06;
    const STAG_ITEM   = prefersReduced ? 0     : 0.10;
    const STAG_CARD   = prefersReduced ? 0     : 0.08;

    const els = <T extends Element>(xs: (T | null | undefined)[]) =>
      xs.filter(Boolean) as T[];

    // Identity
    {
      const identity = document.getElementById('identity');
      if (identity) {
        const whoTitle   = identity.querySelector<HTMLElement>('.who .block-title');
        const whereTitle = identity.querySelector<HTMLElement>('.where .block-title');
        const whoText = identity.querySelector<HTMLElement>('.who .who-text');
        const whoBtn  = identity.querySelector<HTMLElement>('.who .cta-btn');
        const whereMap =
          identity.querySelector<HTMLElement>('.where .where-map') ??
          identity.querySelector<HTMLElement>('.where .panel-map');

        gsap.set(els([whoTitle, whereTitle]), { autoAlpha: 0, y: 16 });
        gsap.set(els([whoText, whoBtn, whereMap]), { autoAlpha: 0, y: 14 });

        gsap.timeline({
          defaults: { ease: EASE },
          scrollTrigger: { trigger: identity, start: 'top 75%', once: true }
        })
        .to(els([whoTitle, whereTitle]), { autoAlpha: 1, y: 0, duration: 0.55 }, 0)
        .to(els([whoText, whoBtn, whereMap]), {
          autoAlpha: 1, y: 0, duration: 0.45, stagger: STAG_SMALL
        }, 0.10);
      }
    }

    // WH
    {
      const wh = document.querySelector<HTMLElement>('.wh');
      if (wh) {
        const whatTitle = wh.querySelector<HTMLElement>('.what .block-title') ??
                          wh.querySelector<HTMLElement>('.wh-left  .block-title');
        const howTitle  = wh.querySelector<HTMLElement>('.how  .block-title') ??
                          wh.querySelector<HTMLElement>('.wh-right .block-title');

        const whatItems = Array.from(
          wh.querySelectorAll<HTMLElement>('.what .dash-list li, .wh-left .dash-list li')
        );
        const howItems = Array.from(
          wh.querySelectorAll<HTMLElement>('.how .dash-list li, .wh-right .dash-list li')
        );

        const rightBtn = wh.querySelector<HTMLElement>('.wh-right .wh-actions .cta-btn') ??
                         wh.querySelector<HTMLElement>('.wh-actions .cta-btn');
        const dlLink   = wh.querySelector<HTMLElement>('.download .dl-link');

        gsap.set(els([whatTitle, howTitle]), { autoAlpha: 0, y: 16 });
        if (whatItems.length) gsap.set(whatItems, { autoAlpha: 0, y: 12 });
        if (howItems.length)  gsap.set(howItems,  { autoAlpha: 0, y: 12 });
        gsap.set(els([rightBtn, dlLink]), { autoAlpha: 0, y: 10 });

        const tl = gsap.timeline({
          defaults: { ease: EASE },
          scrollTrigger: { trigger: wh, start: 'top 78%', once: true }
        });

        tl.to(els([whatTitle, howTitle]), { autoAlpha: 1, y: 0, duration: DUR_TITLE }, 0);

        if (whatItems.length) {
          tl.to(whatItems, { autoAlpha: 1, y: 0, duration: DUR_BLOCK, stagger: STAG_SMALL }, 0.12);
        }
        if (howItems.length) {
          tl.to(howItems,  { autoAlpha: 1, y: 0, duration: DUR_BLOCK, stagger: STAG_SMALL }, 0.12);
        }

        tl.to(els([dlLink, rightBtn]), { autoAlpha: 1, y: 0, duration: DUR_BLOCK }, '+=0.10');
      }
    }

    // Contexts
    {
      const ctx = document.querySelector<HTMLElement>('.contexts');
      if (ctx) {
        const title = ctx.querySelector<HTMLElement>('.contexts-title');
        const items = Array.from(ctx.querySelectorAll<HTMLElement>('.contexts-grid .ctx-item'));
        const icons = items.map(li => li.querySelector<HTMLElement>('.ctx-icon, .ctx-img') || null);
        const labels = items.map(li => li.querySelector<HTMLElement>('.ctx-label') || null);

        gsap.set(title, { autoAlpha: 0, y: 16 });
        gsap.set(els(icons),  { autoAlpha: 0, y: 14 });
        gsap.set(els(labels), { autoAlpha: 0, y: 10 });

        const tl = gsap.timeline({
          defaults: { ease: EASE },
          scrollTrigger: { trigger: ctx, start: 'top 75%', once: true }
        });

        tl.to(title, { autoAlpha: 1, y: 0, duration: 0.55 }, 0);

        items.forEach((_, i) => {
          const at = 0.12 + i * (prefersReduced ? 0 : 0.10);
          const ico = icons[i];
          const lbl = labels[i];
          if (ico) tl.to(ico, { autoAlpha: 1, y: 0, duration: 0.45 }, at);
          if (lbl) tl.to(lbl, { autoAlpha: 1, y: 0, duration: 0.40 }, at + 0.08);
        });
      }
    }

    // Clients
    {
      const clients = document.querySelector<HTMLElement>('.clients');
      if (clients) {
        const icon  = clients.querySelector<HTMLElement>('.clients-icon');
        const title = clients.querySelector<HTMLElement>('.clients-title');
        const listItems = Array.from(clients.querySelectorAll<HTMLElement>('.clients-list li'));

        gsap.set(els([icon, title]), { autoAlpha: 0, y: 16 });
        if (listItems.length) gsap.set(listItems, { autoAlpha: 0, y: 12 });

        const tl = gsap.timeline({
          defaults: { ease: EASE },
          scrollTrigger: { trigger: clients, start: 'top 80%', once: true }
        } as any);

        (tl as gsap.core.Timeline)
          .to(icon,  { autoAlpha: 1, y: 0, duration: 0.45 }, 0.00)
          .to(title, { autoAlpha: 1, y: 0, duration: 0.55 }, 0.10);

        if (listItems.length) {
          (tl as gsap.core.Timeline)
            .to(listItems, { autoAlpha: 1, y: 0, duration: 0.45, stagger: prefersReduced ? 0 : 0.06 }, 0.28);
        }
      }
    }

    // News
    {
      const news = document.querySelector<HTMLElement>('.news');
      if (news) {
        const title = news.querySelector<HTMLElement>('.news-title');
        const cards = Array.from(news.querySelectorAll<HTMLElement>('.news-card'));
        const side  = news.querySelector<HTMLElement>('.news-side-btn');

        gsap.set(title, { autoAlpha: 0, y: 16 });
        if (cards.length) gsap.set(cards, { autoAlpha: 0, y: 14 });
        if (side) gsap.set(side, { autoAlpha: 0, y: 10 });

        const tl = gsap.timeline({
          defaults: { ease: EASE },
          scrollTrigger: { trigger: news, start: 'top 80%', once: true }
        });

        tl.to(title, { autoAlpha: 1, y: 0, duration: 0.55 }, 0);

        if (cards.length) {
          tl.to(cards, { autoAlpha: 1, y: 0, duration: 0.45, stagger: prefersReduced ? 0 : 0.08 }, 0.15);
        }

        if (side) tl.to(side, { autoAlpha: 1, y: 0, duration: 0.45 }, '+=0.10');
      }
    }

    try { ScrollTrigger.refresh(); } catch {}
  }

  /* ===== NEWS (Home) ===== */
  private loadFeaturedNews(): void {
    this.wp.getHomepageFeaturedNews(2).subscribe((items: any[]) => {
      // enrichit les items : ajoute themeKey + slug (si absent)
      const mapped: NewsItem[] = (items || []).map((it: any) => {
        const themeKey = this.toThemeKey(it?.theme);
        const slug = it?.slug || this.slugFromLink(it?.link);
        return { ...it, themeKey, slug };
      });
      this.news = mapped.length ? { title: 'Actualités', items: mapped } : null;
    });
  }

  /* ==================================================== */
  /*                       CONTEXTES                      */
  /* ==================================================== */
  private extractExpertiseContext(): void {
    const ctx = this.acf?.expertise_contact_section || {};
    const items: ContextItem[] = [];
    for (let i = 1; i <= 8; i++) {
      const icon = ctx[`context_icon_${i}`];
      const label = ctx[`context_label_${i}`];
      if (label) items.push({ icon: icon || '', label });
    }
    this.contexts = { title: ctx.context_title || 'Contextes d’intervention', items };
  }

  firstWord(label: string = ''): string {
    const m = (label || '').trim().match(/^\S+/);
    return m ? m[0] : '';
  }

  restWords(label: string = ''): string {
    return (label || '').trim().replace(/^\S+\s*/, '');
  }

  /* ==================================================== */
  /*                         CLIENTS                      */
  /* ==================================================== */
  private extractClientsSection(): void {
    const c = this.acf?.clients_section || {};
    const items = [
      c.client_item_1, c.client_item_2, c.client_item_3,
      c.client_item_4, c.client_item_5, c.client_item_6
    ].filter(Boolean) as string[];

    this.clients = (c.clients_title || items.length)
      ? { icon: c.clients_icon || '', title: c.clients_title || 'Nos clients', items }
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
        tmp.push({ photo: photo || '', nameFirst, nameLast, area, jobHtml });
      }
    }

    this.teamMembers = this.shuffleArray(tmp);
    this.teamPages = [];
    for (let i = 0; i < this.teamMembers.length; i += 2) {
      this.teamPages.push(this.teamMembers.slice(i, i + 2));
    }
    if (this.teamPages.length) {
      this.teamPageIndex = Math.floor(Math.random() * this.teamPages.length);
    }
  }

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

  /* Navigation Team */
  goTeamTo(i: number): void {
    if (!this.teamPages.length) return;
    const len = this.teamPages.length;
    this.teamPageIndex = ((i % len) + len) % len;
    this.stopTeamAutoplayByUser();
  }
  nextTeam(): void { this.goTeamTo(this.teamPageIndex + 1); }
  prevTeam(): void { this.goTeamTo(this.teamPageIndex - 1); }

  private startTeamAutoplay(): void {
    this.clearTeamAutoplay();
    if (this.teamPages.length < 2) return;
    if (this.teamAutoplayStoppedByUser) return;

    this.teamAutoplayRef = setInterval(() => {
      const len = this.teamPages.length;
      if (len < 2) return;

      let next = this.teamPageIndex;
      while (next === this.teamPageIndex) {
        next = Math.floor(Math.random() * len);
      }
      this.teamPageIndex = next;
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

  /* ==================================================== */
  /*                        UTILS                         */
  /* ==================================================== */

  /** Transforme le libellé WP en clé de thème normalisée */
  private toThemeKey(raw?: string): ThemeKey {
    const s = (raw || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if (s.includes('march'))   return 'marche';
    if (s.includes('jurid'))   return 'juridique';
    if (s.includes('expert'))  return 'expertise';
    return 'autre';
  }

  /** Classe CSS de thème pour le template */
  themeClass(k?: ThemeKey): string { return `theme-${k || 'autre'}`; }

  /** Récupère le slug depuis l’URL fournie par WP (ex: /actualites/article-5/) */
  private slugFromLink(link?: string): string | undefined {
    if (!link) return undefined;
    try {
      const u = new URL(link, window.location.origin);
      const parts = u.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || undefined;
    } catch { return undefined; }
  }

  trackByIndex(i: number): number { return i; }
}
