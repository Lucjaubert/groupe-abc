// src/app/pages/services/services.component.ts

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
import { Router, NavigationEnd } from '@angular/router';
import { firstValueFrom, Subscription, filter } from 'rxjs';

import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { ImgFastDirective } from '../../directives/img-fast.directive';
import { FaqItem, getFaqForRoute } from '../../config/faq.routes';
import { getSeoForRoute } from '../../config/seo.routes';
import { environment } from '../../../environments/environment';

type Lang = 'fr' | 'en';

type ContextIntro = { title: string; html: SafeHtml | string };
type ContextItem = {
  icon?: string | number;
  iconUrl?: string;
  title: string;
  html?: SafeHtml | string;
};
type ClientItem = { title: string; html?: SafeHtml | string };

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule, ImgFastDirective],
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.scss'],
})
export class ServicesComponent implements OnInit, AfterViewInit, OnDestroy {
  private wp = inject(WordpressService);
  private seo = inject(SeoService);
  private sanitizer = inject(DomSanitizer);

  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private doc = inject(DOCUMENT);

  private navSub?: Subscription;
  private weglotOff?: () => void;

  // GSAP lazy (SSR-safe)
  private gsap: any | null = null;
  private ScrollTrigger: any | null = null;

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
    } catch {}
  }

  /* ===== Données ===== */
  pageTitle = 'Nos services';

  ctxIntro: ContextIntro = { title: '', html: '' };
  contexts: ContextItem[] = [];
  contextsText: SafeHtml | string = '';

  ctxOpen: boolean[] = [];

  clientsTitle = '';
  clientsText: SafeHtml | string = '';
  clients: ClientItem[] = [];
  cliOpen: boolean[] = [];

  isReady = false;

  refsTitle = 'Ils nous font confiance';
  references: string[] = [];

  /* ===== FAQ (affichage bas de page + JSON-LD) ===== */
  faqItems: FaqItem[] = [];
  faqOpen: boolean[] = [];
  isEN = false;

  /** FAQ */
  openFaqIndexes = new Set<number>();

  /* ===== Fallbacks ===== */
  defaultCtxIcon = '/assets/fallbacks/icon-placeholder.svg';
  defaultRefLogo = '/assets/fallbacks/logo-placeholder.svg';

  /* ===== Refs Animations ===== */
  @ViewChild('heroTitle') heroTitle!: ElementRef<HTMLElement>;

  @ViewChild('ctxTitle') ctxTitleRef!: ElementRef<HTMLElement>;
  @ViewChild('ctxSub') ctxSubRef!: ElementRef<HTMLElement>;
  @ViewChildren('ctxRow') ctxRows!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('ctxList') ctxListRef!: ElementRef<HTMLElement>;

  @ViewChild('clientsTitleEl') clientsTitleRef!: ElementRef<HTMLElement>;
  @ViewChild('clientsTextEl') clientsTextRef!: ElementRef<HTMLElement>; // ✅ AJOUT
  @ViewChildren('cliRow') cliRows!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('cliList') cliListRef!: ElementRef<HTMLElement>;

  @ViewChild('refsTitleEl') refsTitleRef!: ElementRef<HTMLElement>;
  @ViewChildren('refLogo') refLogos!: QueryList<ElementRef<HTMLImageElement>>;
  @ViewChild('refsGrid') refsGridRef!: ElementRef<HTMLElement>;

  /* ===== Flags / Locks ===== */
  private heroPlayed = false;
  private contextsPlayed = false;
  private contextsVisible = false;
  private bindScheduled = false;
  private animLock = false; // verrou pendant la séquence hero→contexts

  /* ===== Helpers ===== */
  private safe(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html || '');
  }

  private currentPath(): string {
    if (this.isBrowser()) {
      try {
        return window?.location?.pathname || this.router?.url || '/';
      } catch {
        return this.router?.url || '/';
      }
    }
    return this.router?.url || '/';
  }

  toggleFaqItem(i: number): void {
    if (this.openFaqIndexes.has(i)) this.openFaqIndexes.delete(i);
    else this.openFaqIndexes.add(i);
  }

  isFaqItemOpen(i: number): boolean {
    return this.openFaqIndexes.has(i);
  }

  /**
   * Détection langue SSR-safe :
   * 1) Weglot si dispo côté navigateur
   * 2) <html lang="">
   * 3) path (/en/...)
   */
  private getLang(): Lang {
    if (this.isBrowser()) {
      try {
        const wg: any = (window as any).Weglot;
        const l = wg?.getCurrentLang?.();
        if (l === 'en' || l === 'fr') return l;
      } catch {}
    }

    try {
      const htmlLang = (this.doc?.documentElement?.lang || '').toLowerCase();
      if (htmlLang.startsWith('en')) return 'en';
      if (htmlLang.startsWith('fr')) return 'fr';
    } catch {}

    try {
      const p = this.currentPath();
      if (p.startsWith('/en')) return 'en';
    } catch {}

    return 'fr';
  }

  private isEnglish(): boolean {
    return this.getLang() === 'en';
  }

  trackByIndex(i: number) {
    return i;
  }

  // ✅ (Optionnel recommandé) : évite le re-render complet lors du shuffle
  trackByRefUrl(_: number, url: string) {
    return url;
  }

  // ✅ Shuffle (Fisher–Yates)
  private shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ===================== Lifecycle ===================== */
  ngOnInit(): void {
    // Langue + FAQ + SEO (source unique = faq.routes.ts)
    this.refreshLangFaqSeo();

    // Data WP
    this.wp.getServicesData().subscribe(async (payload: any) => {
      const root = Array.isArray(payload) ? payload[0] : payload;
      const acf = root?.acf ?? {};

      /* ---------- HERO & CONTEXT INTRO ---------- */
      this.pageTitle = acf?.hero?.section_title || (this.isEN ? 'Our services' : 'Nos services');

      const heroCtx = acf?.hero?.contexts ?? {};
      this.ctxIntro = {
        title:
          heroCtx?.section_title ||
          (this.isEN ? 'Contexts of intervention' : 'Contextes d’interventions'),
        html: this.safe(heroCtx?.section_presentation || ''),
      };

      /* ---------- CONTEXTES ---------- */
      const ctxObj = acf?.contexts ?? {};
      const raw: ContextItem[] = Object.values(ctxObj)
        .filter((it: any) => it && (it.title || it.description || it.icon))
        .map((it: any) => ({
          icon: it?.icon ?? '',
          title: it?.title || '',
          html: this.safe(it?.description || ''),
        }));

      this.contexts = raw.map((it) => ({ ...it, iconUrl: this.defaultCtxIcon }));
      this.ctxOpen = new Array(this.contexts.length).fill(false);

      await this.hydrateContextIcons();

      /* ---------- CLIENTS ---------- */
      const clientsRoot = acf?.clients ?? {};
      const sectionClients = clientsRoot?.section_clients ?? {};

      this.clientsTitle = sectionClients?.title || (this.isEN ? 'Clients' : 'Nos Clients');

      // ✅ Champ ACF = "clients-text" (avec tiret)
      const rawClientsText =
        (clientsRoot?.['clients-text'] ??
          clientsRoot?.['clients_text'] ?? // fallback au cas où
          clientsRoot?.clients_text ??
          clientsRoot?.clientsText ??
          '') as string;

      this.clientsText = rawClientsText ? this.safe(rawClientsText) : '';

      this.clients = Object.entries(clientsRoot)
        .filter(([k, v]) => /^client_type_/i.test(k) && v)
        .map(([, v]: any) => ({
          title: v?.client_title || '',
          html: this.safe(v?.client_description || ''),
        }));

      this.cliOpen = new Array(this.clients.length).fill(false);

      /* ---------- RÉFÉRENCES ---------- */
      const refs = acf?.references ?? {};
      this.refsTitle = refs?.section_title || (this.isEN ? 'They trust us' : 'Ils nous font confiance');

      const logoTokens = Object.entries(refs)
        .filter(([k, v]) => /^logo_/i.test(k) && v != null && v !== '')
        .map(([, v]: any) => (typeof v === 'number' || typeof v === 'string' ? v : v?.id ?? v?.url ?? ''))
        .filter((v: any) => v !== '' && v != null) as Array<string | number>;

      this.hydrateReferences(logoTokens);

      this.scheduleBind();
    });

    // NavigationEnd : au cas où (route /en/...) + SEO/FAQ doivent suivre
    this.navSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.refreshLangFaqSeo());

    // Weglot : changement de langue sans navigation
    this.bindWeglotLangEvents();
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser()) return;
    await this.setupGsap();

    this.ctxRows?.changes?.subscribe(() => {
      if (!this.animLock) this.scheduleBind();
    });
    this.cliRows?.changes?.subscribe(() => {
      if (!this.animLock) this.scheduleBind();
    });
    this.refLogos?.changes?.subscribe(() => {
      if (!this.animLock) this.scheduleBind();
    });

    this.scheduleBind();
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
    this.weglotOff?.();

    if (this.isBrowser() && this.ScrollTrigger) {
      try {
        this.ScrollTrigger.getAll().forEach((t: any) => t.kill());
      } catch {}
      try {
        this.gsap?.globalTimeline?.clear?.();
      } catch {}
    }
  }

  /* ===================== Lang / FAQ / SEO ===================== */

  private refreshLangFaqSeo(): void {
    const lang: Lang = this.getLang();
    this.isEN = lang === 'en';

    this.faqItems = getFaqForRoute('services', lang) || [];
    this.faqOpen = new Array(this.faqItems.length).fill(false);

    // SEO centralisé + FAQ JSON-LD basé sur la FAQ réellement affichée
    this.applySeoFromConfig(this.faqItems);
  }

  private bindWeglotLangEvents(): void {
    if (!this.isBrowser()) return;

    try {
      const wg: any = (window as any).Weglot;
      if (!wg?.on || !wg?.getCurrentLang) return;

      const onChanged = (l: string) => {
        const next: Lang = l === 'en' ? 'en' : 'fr';
        if ((this.isEN ? 'en' : 'fr') === next) return;
        this.isEN = next === 'en';
        this.refreshLangFaqSeo();
      };

      wg.on('initialized', () => onChanged(wg.getCurrentLang?.()));
      wg.on('languageChanged', (newLang: string) => onChanged(newLang));

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

  /* ===================== Hydratations asynchrones ===================== */
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

  private async hydrateContextIcons(): Promise<void> {
    if (!this.contexts?.length) return;
    const urls = await Promise.all(this.contexts.map((it) => this.resolveMedia(it.icon)));
    this.contexts = this.contexts.map((it, idx) => ({
      ...it,
      iconUrl: urls[idx] || this.defaultCtxIcon,
    }));
  }

  // ✅ Références : shuffle côté navigateur uniquement (SSR-safe)
  private hydrateReferences(tokens: Array<string | number>): void {
    if (!tokens?.length) {
      this.references = [];
      return;
    }

    Promise.all(tokens.map((t) => this.resolveMedia(t)))
      .then((urls) => {
        const cleaned = urls.filter(Boolean) as string[];

        // 1) ordre “normal” d’abord (SSR/hydration friendly)
        this.references = cleaned;

        // 2) shuffle uniquement côté browser, après un tick
        if (this.isBrowser() && this.references.length > 1) {
          setTimeout(() => {
            this.references = this.shuffleArray(this.references);
          }, 0);
        }
      })
      .catch(() => {
        this.references = [];
      });
  }

  /* ===================== Accordéons ===================== */
  toggleCtx(i: number) {
    const willOpen = !this.ctxOpen[i];
    this.ctxOpen.fill(false);
    if (willOpen) this.ctxOpen[i] = true;
  }

  toggleCli(i: number) {
    const willOpen = !this.cliOpen[i];
    this.cliOpen.fill(false);
    if (willOpen) this.cliOpen[i] = true;
  }

  /* ===================== Img fallbacks ===================== */
  onImgError(evt: Event) {
    const img = evt.target as HTMLImageElement;
    if (img) img.src = this.defaultCtxIcon;
  }

  onRefImgError(evt: Event) {
    const img = evt.target as HTMLImageElement;
    if (img) img.src = this.defaultRefLogo;
  }

  /* ===================== SEO (centralisé + FAQ JSON-LD) ===================== */
  private applySeoFromConfig(faqItems: FaqItem[] = []): void {
    const lang: Lang = this.getLang();
    const baseSeo = getSeoForRoute('services', lang);

    const siteUrl = (environment.siteUrl || 'https://groupe-abc.fr').replace(/\/+$/, '');

    // Canonical absolu (priorité config)
    const canonicalAbs =
      baseSeo.canonical && /^https?:\/\//i.test(baseSeo.canonical)
        ? baseSeo.canonical
        : this.normalizeUrl(siteUrl, baseSeo.canonical || '/expertise-immobiliere-services');

    // Image OG absolue (si SeoService l’utilise)
    const ogCandidate = baseSeo.image || '/assets/og/og-default.jpg';
    const ogAbs = this.absUrl(ogCandidate, siteUrl);

    // JSON-LD "base"
    const existingJsonLd: any = baseSeo.jsonLd;
    let baseGraph: any[] = [];
    let baseContext = 'https://schema.org';

    if (existingJsonLd) {
      if (Array.isArray(existingJsonLd['@graph'])) baseGraph = existingJsonLd['@graph'];
      else baseGraph = [existingJsonLd];
      if (typeof existingJsonLd['@context'] === 'string') baseContext = existingJsonLd['@context'];
    }

    // FAQ JSON-LD basé sur la FAQ réellement affichée
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
      image: ogAbs,
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

  private absUrl(url: string, origin: string): string {
    if (!url) return '';
    try {
      if (/^https?:\/\//i.test(url)) return url;
      if (/^\/\//.test(url)) return 'https:' + url;
      const o = origin.endsWith('/') ? origin.slice(0, -1) : origin;
      return url.startsWith('/') ? o + url : `${o}/${url}`;
    } catch {
      return url;
    }
  }

  /* ================= Animations ================= */
  private scheduleBind() {
    if (!this.isBrowser() || !this.gsap) return;
    if (this.bindScheduled) return;

    if (this.animLock) {
      queueMicrotask(() => requestAnimationFrame(() => this.scheduleBind()));
      return;
    }

    this.bindScheduled = true;
    queueMicrotask(() =>
      requestAnimationFrame(() => {
        this.bindScheduled = false;
        this.bindAnimations();
      }),
    );
  }

  private forceInitialHidden(root: HTMLElement) {
    if (!this.isBrowser() || !this.gsap) return;
    if (this.animLock) return;

    const gsap = this.gsap!;
    const pre = Array.from(root.querySelectorAll<HTMLElement>('.prehide'));
    const rows = Array.from(root.querySelectorAll<HTMLElement>('.prehide-row'));

    if (pre.length) gsap.set(pre, { autoAlpha: 0, y: 20, visibility: 'hidden' });
    if (rows.length) gsap.set(rows, { autoAlpha: 0, visibility: 'hidden' });
  }

  private hideContextsSectionOnce() {
    if (!this.isBrowser() || !this.gsap) return;
    const gsap = this.gsap!;
    const contextsSection = this.doc.querySelector('.contexts') as HTMLElement | null;
    const ctxListEl = this.ctxListRef?.nativeElement;

    this.animLock = true;

    if (contextsSection) {
      gsap.set(contextsSection, { autoAlpha: 0, visibility: 'hidden', pointerEvents: 'none' });
    }

    if (ctxListEl) {
      (ctxListEl as HTMLElement).style.setProperty('border-top-color', 'transparent', 'important');
    }
  }

  private revealContextsAfterHero() {
    if (!this.isBrowser() || !this.gsap || !this.ScrollTrigger) return;
    if (this.contextsPlayed || this.contextsVisible) return;

    const gsap = this.gsap!;
    const ScrollTrigger = this.ScrollTrigger!;
    const contextsSection = this.doc.querySelector('.contexts') as HTMLElement | null;
    const ctxListEl = this.ctxListRef?.nativeElement;
    const ctxRowEls = (this.ctxRows?.toArray() || []).map((r) => r.nativeElement);
    const EASE = 'power3.out';

    if (ctxListEl) (ctxListEl as HTMLElement).classList.remove('prehide', '_hold-bar');
    ctxRowEls.forEach((el) => el.classList.remove('prehide-row'));

    if (contextsSection) {
      gsap.set(contextsSection, { visibility: 'visible', pointerEvents: 'auto', autoAlpha: 1 });
    }

    const tl = gsap.timeline({
      defaults: { ease: EASE },
      onComplete: () => {
        this.contextsPlayed = true;
        this.contextsVisible = true;
        this.animLock = false;
        this.isReady = true;
        this.scheduleBind();
        try {
          ScrollTrigger.refresh();
        } catch {}
      },
    });

    if (ctxListEl) {
      tl.fromTo(
        ctxListEl,
        { autoAlpha: 0, y: 12 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.28,
          immediateRender: false,
          onStart: () => {
            (ctxListEl as HTMLElement).style.removeProperty('border-top-color');
          },
          onComplete: () => gsap.set(ctxListEl, { clearProps: 'transform,opacity' }),
        },
        0,
      );
    }

    if (ctxRowEls.length) {
      gsap.set(ctxRowEls, { autoAlpha: 0, y: 8 });
      tl.to(
        ctxRowEls,
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.24,
          onComplete: () => gsap.set(ctxRowEls, { clearProps: 'transform,opacity' }),
        },
        '<',
      );
    }
  }

  private bindAnimations(): void {
    if (!this.isBrowser() || !this.gsap || !this.ScrollTrigger) return;

    const gsap = this.gsap!;
    const ScrollTrigger = this.ScrollTrigger!;
    const host = this.doc.querySelector('.services-wrapper') as HTMLElement | null;
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

    if (!this.heroPlayed) this.hideContextsSectionOnce();

    const h1 = this.heroTitle?.nativeElement;
    const tTitle = this.ctxTitleRef?.nativeElement;
    const tSub = this.ctxSubRef?.nativeElement;

    gsap.killTweensOf([h1, tTitle, tSub].filter(Boolean) as HTMLElement[]);

    if (!this.heroPlayed && h1) {
      this.animLock = true;
      gsap
        .timeline({ defaults: { ease: EASE } })
        .fromTo(
          h1,
          { autoAlpha: 0, y: 20, visibility: 'hidden' },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.42,
            onStart: () => show(h1),
            onComplete: () => gsap.set(h1, { clearProps: 'all' }),
          },
        )
        .fromTo(
          tTitle,
          { autoAlpha: 0, y: 14, visibility: 'hidden' },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.3,
            onStart: () => show(tTitle),
            onComplete: () => tTitle && gsap.set(tTitle, { clearProps: 'all' }),
          },
        )
        .fromTo(
          tSub,
          { autoAlpha: 0, y: 12, visibility: 'hidden' },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.28,
            onStart: () => show(tSub),
            onComplete: () => tSub && gsap.set(tSub, { clearProps: 'all' }),
          },
        )
        .add(() => {
          this.heroPlayed = true;
        })
        .add(() => this.revealContextsAfterHero());
    } else {
      [h1, tTitle, tSub].forEach((el) => {
        if (!el) return;
        show(el);
        gsap.set(el, { autoAlpha: 1, y: 0, clearProps: 'transform,opacity,visibility' });
      });
      this.revealContextsAfterHero();
    }

    /* ---------- CLIENTS (scroll) ---------- */
    const cliTitleEl = this.clientsTitleRef?.nativeElement;
    const cliTextEl = this.clientsTextRef?.nativeElement; // ✅ AJOUT
    const cliListEl = this.cliListRef?.nativeElement;
    const cliRowEls = (this.cliRows?.toArray() || []).map((r) => r.nativeElement);

    if (cliTitleEl) {
      gsap.fromTo(
        cliTitleEl,
        { autoAlpha: 0, y: 18 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.38,
          ease: EASE,
          scrollTrigger: { trigger: cliTitleEl, start: 'top 85%', once: true },
          onStart: () => show(cliTitleEl),
          onComplete: () => gsap.set(cliTitleEl, { clearProps: 'all' }),
        },
      );
    }

    // ✅ Animation du bloc .clients-text (sinon il peut rester masqué par .prehide)
    if (cliTextEl) {
      gsap.fromTo(
        cliTextEl,
        { autoAlpha: 0, y: 14 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.32,
          ease: EASE,
          scrollTrigger: { trigger: cliTextEl, start: 'top 85%', once: true },
          onStart: () => show(cliTextEl),
          onComplete: () => gsap.set(cliTextEl, { clearProps: 'all' }),
        },
      );
    }

    if (cliListEl) {
      gsap.fromTo(
        cliListEl,
        { autoAlpha: 0, y: 10 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.3,
          ease: EASE,
          scrollTrigger: { trigger: cliListEl, start: 'top 85%', once: true },
          immediateRender: false,
          onStart: () => show(cliListEl),
          onComplete: () => gsap.set(cliListEl, { clearProps: 'all' }),
        },
      );
    }

    if (cliRowEls.length) {
      gsap.set(cliRowEls, { autoAlpha: 0, y: 10 });
      gsap.to(cliRowEls, {
        autoAlpha: 1,
        y: 0,
        duration: 0.28,
        stagger: 0.06,
        ease: EASE,
        scrollTrigger: { trigger: cliListEl || cliRowEls[0], start: 'top 85%', once: true },
      });
    }

    /* ---------- RÉFÉRENCES (scroll) ---------- */
    const refsTitleEl = this.refsTitleRef?.nativeElement;
    const refsGridEl = this.refsGridRef?.nativeElement;
    const logoEls = (this.refLogos?.toArray() || []).map((r) => r.nativeElement);

    if (refsTitleEl) {
      gsap.fromTo(
        refsTitleEl,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.32,
          ease: EASE,
          scrollTrigger: { trigger: refsTitleEl, start: 'top 85%', once: true },
          onStart: () => show(refsTitleEl),
          onComplete: () => gsap.set(refsTitleEl, { clearProps: 'all' }),
        },
      );
    }

    if (refsGridEl) {
      gsap.fromTo(
        refsGridEl,
        { autoAlpha: 0, y: 8 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.26,
          ease: EASE,
          scrollTrigger: { trigger: refsGridEl, start: 'top 88%', once: true },
          immediateRender: false,
          onStart: () => show(refsGridEl),
          onComplete: () => gsap.set(refsGridEl, { clearProps: 'all' }),
        },
      );
    }

    if (logoEls.length) {
      gsap.set(logoEls, { autoAlpha: 0, y: 10, scale: 0.985 });
      gsap.to(logoEls, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.3,
        stagger: 0.1,
        ease: EASE,
        scrollTrigger: { trigger: refsGridEl || logoEls[0], start: 'top 88%', once: true },
      });
    }

    try {
      ScrollTrigger.refresh();
    } catch {}
  }
}
