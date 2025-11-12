import {
  Component, OnInit, AfterViewInit, OnDestroy,
  inject, ElementRef, ViewChild, ViewChildren, QueryList, PLATFORM_ID
} from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { ImgFastDirective } from '../../directives/img-fast.directive';
import { FaqService, FaqItem } from '../../services/faq.service';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';

/* ===== Types ===== */
type Hero = { title: string; subtitle?: string; html?: SafeHtml | string };
type DomainItem = { kind: 'text' | 'group'; text?: string; title?: string; sub?: string[] };
type Domain = { title: string; icon?: string | number; iconUrl?: string; items: DomainItem[] };
type Wheel = { title: string; image?: string | number; imageUrl?: string; centerAlt?: string };
type EvalMethod = { icon?: string | number; iconUrl?: string; title: string; html?: SafeHtml | string };
type Piloting = { html?: SafeHtml | string; flows: { src: string | number; url?: string; caption?: string }[] };

@Component({
  selector: 'app-methods',
  standalone: true,
  imports: [CommonModule, ImgFastDirective],
  templateUrl: './methods.component.html',
  styleUrls: ['./methods.component.scss']
})
export class MethodsComponent implements OnInit, AfterViewInit, OnDestroy {
  private wp  = inject(WordpressService);
  private seo = inject(SeoService);
  private sanitizer = inject(DomSanitizer);
  private faq = inject(FaqService);

  // SSR/browser helpers
  private platformId = inject(PLATFORM_ID);
  private doc = inject(DOCUMENT);
  private router = inject(Router);
  private gsap: any | null = null;
  private ScrollTrigger: any | null = null;

  private isBrowser(): boolean { return isPlatformBrowser(this.platformId); }

  private async setupGsap(): Promise<void> {
    if (!this.isBrowser() || this.gsap) return;
    const { gsap } = await import('gsap');
    const { ScrollTrigger } = await import('gsap/ScrollTrigger');
    this.gsap = gsap;
    this.ScrollTrigger = ScrollTrigger;
    try { this.gsap.registerPlugin(this.ScrollTrigger); } catch {}
  }

  private assetsBound = false;

  s(v: unknown): string { return v == null ? '' : '' + v; }

  /* ===== Données ===== */
  hero: Hero = { title: 'Biens & Méthodes', subtitle: '', html: '' };

  domains: Domain[] = [];
  wheel: Wheel = { title: '', image: '', imageUrl: '', centerAlt: '' };

  evalTitleText = 'Nos méthodes d’évaluation';
  methods: EvalMethod[] = [];
  evalOpen: boolean[] = [];

  pilotingTitle = 'Pilotage des missions';
  piloting: Piloting = { html: '', flows: [] };

  /* ===== Fallbacks ===== */
  defaultDomainIcon = '/assets/fallbacks/icon-placeholder.svg';
  defaultEvalIcon   = '/assets/fallbacks/icon-placeholder.svg';
  defaultPilotImg   = '/assets/fallbacks/image-placeholder.svg';
  defaultWheelImg   = '/assets/fallbacks/image-placeholder.svg';

  /* ===== Refs Animations ===== */
  @ViewChild('heroTitle')     heroTitleRef!: ElementRef<HTMLElement>;
  @ViewChild('heroSubtitle')  heroSubRef!: ElementRef<HTMLElement>;
  @ViewChild('heroIntro')     heroIntroRef!: ElementRef<HTMLElement>;

  @ViewChildren('assetCol') assetCols!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('assetsList') assetsListRef!: ElementRef<HTMLElement>;

  @ViewChild('wheelTitle') wheelTitleRef!: ElementRef<HTMLElement>;
  @ViewChild('wheelWrap')  wheelWrapRef!: ElementRef<HTMLElement>;

  @ViewChild('evalTitle') evalTitleRef!: ElementRef<HTMLElement>;
  @ViewChildren('evalRow') evalRows!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('evalList')  evalListRef!: ElementRef<HTMLElement>;

  @ViewChild('pilotTitle') pilotTitleRef!: ElementRef<HTMLElement>;
  @ViewChild('pilotIntro') pilotIntroRef!: ElementRef<HTMLElement>;
  @ViewChild('pilotGrid')  pilotGridRef!: ElementRef<HTMLElement>;

  /* ===== Flags ===== */
  private heroBound = false;
  private bindScheduled = false;

  /* ===================== FAQ – page Méthodes ===================== */
  private readonly METHODS_FAQ_FR: FaqItem[] = [
    {
      q: 'Quelles sont les principales méthodes utilisées pour évaluer un bien immobilier ?',
      a: 'L’expert applique plusieurs approches reconnues selon la nature du bien et le contexte : comparaison directe, capitalisation du revenu (rendement locatif), coût de remplacement net, Discounted Cash Flow (DCF) et bilan promoteur. Chaque méthode est justifiée et pondérée dans le rapport final.'
    },
    {
      q: 'Quelle méthode privilégier selon le type de bien ?',
      a: 'Pour un bien résidentiel, la comparaison est privilégiée. Pour un immeuble de rapport ou un local commercial, les méthodes par rendement ou DCF sont adaptées. Pour les terrains ou biens atypiques, les approches Sol + Construction ou bilan promoteur sont souvent retenues.'
    },
    {
      q: 'Comment l’expert garantit-il la fiabilité de la valeur calculée ?',
      a: 'La fiabilité repose sur la qualité des données (références de marché, indices, ratios) et la cohérence entre les approches retenues. Le rapport est documenté, argumenté et conforme à la Charte de l’expertise et aux standards RICS / TEGoVA.'
    },
    {
      q: 'Quelle est la différence entre valeur vénale et valeur d’investissement ?',
      a: 'La valeur vénale correspond au prix estimé de vente dans des conditions normales de marché. La valeur d’investissement dépend, elle, du rendement attendu par un investisseur donné et de son profil de risque. Elles peuvent être calculées conjointement.'
    },
    {
      q: 'Les méthodes d’évaluation sont-elles normalisées ?',
      a: 'Oui. Elles reposent sur des normes reconnues : Charte de l’expertise en évaluation immobilière (édition 2024), RICS Red Book et EVS/TEGoVA. Ces référentiels garantissent transparence et comparabilité.'
    },
    {
      q: 'Pourquoi faire appel à un expert agréé pour une évaluation complexe ?',
      a: 'Un expert agréé maîtrise les modèles de valorisation avancés (DCF, bilans promoteurs, ratios) et engage sa responsabilité sur la valeur produite. Il est particulièrement recommandé pour les actifs complexes ou à forte valeur.'
    }
  ];
  private readonly METHODS_FAQ_EN: FaqItem[] | undefined = undefined;

  /* ===== Init ===== */
  ngOnInit(): void {
    // FAQ de la page
    this.faq.set(this.METHODS_FAQ_FR, this.METHODS_FAQ_EN);

    this.wp.getMethodsData().subscribe(async (payload: any) => {
      const root = Array.isArray(payload) ? payload[0] : payload;
      const acf  = root?.acf ?? {};

      /* ---------- HERO ---------- */
      this.hero = {
        title   : acf?.hero?.section_title || 'Biens & Méthodes',
        subtitle: acf?.hero?.section_subtitle || '',
        html    : this.safe(acf?.hero?.intro_body || '')
      };

      /* ---------- DOMAINES ---------- */
      const ad = acf?.asset_domains ?? {};
      const list: any[] = [ad?.domain_1, ad?.domain_2, ad?.domain_3].filter(Boolean);

      this.domains = await Promise.all(
        list.map(async (d: any) => {
          const items: DomainItem[] = [];
          for (let i = 1; i <= 4; i++) {
            const v = d?.[`item_${i}`];
            if (typeof v === 'string' && v.trim()) {
              items.push({ kind: 'text', text: v.trim() });
            }
          }
          const it5 = d?.item_5;
          if (it5 && (it5.item_5_title || it5.item_5_subtitle_1 || it5.item_5_subtitle_2 || it5.item_5_subtitle_3)) {
            const sub = [it5.item_5_subtitle_1, it5.item_5_subtitle_2, it5.item_5_subtitle_3]
              .filter((s: any) => (s || '').toString().trim())
              .map((s: string) => s.trim());
            items.push({ kind: 'group', title: (it5.item_5_title || '').trim(), sub });
          }
          if (typeof d?.item_6 === 'string' && d.item_6.trim()) {
            items.push({ kind: 'text', text: d.item_6.trim() });
          }

          const iconToken = d?.icon ?? d?.icon_1 ?? d?.icon_2 ?? '';
          const iconUrl   = (await this.resolveMedia(iconToken)) || this.defaultDomainIcon;

          return { title: d?.title || '', icon: iconToken, iconUrl, items } as Domain;
        })
      );

      /* ---------- WHEEL ---------- */
      const vw = acf?.values_wheel ?? {};
      const wimg = vw?.wheel_image;
      const wheelToken =
        (typeof wimg === 'number' || typeof wimg === 'string')
          ? wimg
          : (wimg?.id ?? wimg?.url ?? wimg?.source_url ?? '');
      const wheelUrl = (await this.resolveMedia(wheelToken)) || this.defaultWheelImg;

      this.wheel = {
        title    : vw?.section_title || 'Un immeuble, des valeurs',
        image    : wheelToken,
        imageUrl : wheelUrl,
        centerAlt: (vw?.center_label || '').toString()
      };

      /* ---------- MÉTHODES ---------- */
      const mroot = acf?.methods ?? {};
      this.evalTitleText = mroot?.section_title || 'Nos méthodes d’évaluation';

      const keys = Object.keys(mroot).filter(k => /^method_\d+$/i.test(k));
      const coll = keys.map(k => mroot[k]).filter(Boolean);

      this.methods = await Promise.all(
        coll
          .filter((m: any) => m?.title || m?.description || m?.icon)
          .map(async (m: any) => {
            const iconUrl = (await this.resolveMedia(m?.icon ?? '')) || this.defaultEvalIcon;
            return {
              icon: m?.icon ?? '',
              iconUrl,
              title: m?.title || '',
              html: this.safe(m?.description || '')
            } as EvalMethod;
          })
      );
      this.evalOpen = new Array(this.methods.length).fill(false);

      /* ---------- PILOTAGE ---------- */
      const pil = acf?.mission_piloting ?? {};
      this.pilotingTitle = pil?.section_title || 'Pilotage des missions';

      const flowsSrcs: Array<{ src: string | number; caption?: string }> = [];
      if (pil?.flow_1) flowsSrcs.push({ src: pil.flow_1 });
      if (pil?.flow_2) flowsSrcs.push({ src: pil.flow_2 });

      const flowsWithUrl = await Promise.all(
        flowsSrcs.map(async f => ({
          ...f,
          url: (await this.resolveMedia(f.src)) || this.defaultPilotImg
        }))
      );

      this.piloting = {
        html: this.safe(pil?.intro_body || ''),
        flows: flowsWithUrl
      };

      /* ---------- SEO (conforme au brief) ---------- */
      const isEN    = this.currentPath().startsWith('/en/');
      const siteUrl = (environment.siteUrl || '').replace(/\/+$/,'') || 'https://groupe-abc.fr';

      const pathFR  = '/methodes-evaluation-immobiliere';
      const pathEN  = '/en/methods-real-estate-valuation'; // slug EN propre, à aligner avec le routage réel
      const canonical = `${siteUrl}${isEN ? pathEN : pathFR}`;

      const lang      = isEN ? 'en'    : 'fr';
      const locale    = isEN ? 'en_US' : 'fr_FR';
      const localeAlt = isEN ? ['fr_FR'] : ['en_US'];

      const alternates = [
        { lang: 'fr',        href: `${siteUrl}${pathFR}` },
        { lang: 'en',        href: `${siteUrl}${pathEN}` },
        { lang: 'x-default', href: `${siteUrl}${pathFR}` }
      ];

      // Textes SEO (FR = brief Matthieu)
      const titleFR = 'Méthodes d’évaluation immobilière – Approches et calculs de valeur';
      const descFR  = 'Découvrez les principales méthodes d’évaluation : comparaison, rendement, coût de remplacement, DCF et bilan promoteur. Des analyses rigoureuses pour une expertise fiable.';

      const titleEN = 'Real-estate valuation methods – Approaches and value calculations';
      const descEN  = 'Discover key valuation methods: comparison, yield, replacement cost, DCF and development appraisals. Robust analyses for reliable, compliant appraisals.';

      const pageTitle   = isEN ? titleEN : titleFR;
      const description = (isEN ? descEN : descFR).slice(0, 160);

      const ogCandidate = (typeof this.wheel.imageUrl === 'string' && this.wheel.imageUrl.trim())
        ? (this.wheel.imageUrl as string)
        : '/assets/og/og-default.jpg';
      const ogAbs = this.absUrl(ogCandidate, siteUrl);
      const ogIsDefault = ogAbs.endsWith('/assets/og/og-default.jpg');

      // IDs cohérents avec setSitewideJsonLd (app.component)
      const siteId = `${siteUrl}#website`;
      const orgId  = `${siteUrl}#org`;

      const webPage = {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: pageTitle,
        description,
        inLanguage: isEN ? 'en-US' : 'fr-FR',
        isPartOf: { '@id': siteId },
        about: { '@id': orgId },
        primaryImageOfPage: ogAbs
      };

      const breadcrumb = {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: isEN ? 'Home' : 'Accueil',
            item: siteUrl + '/'
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: isEN ? 'Methods' : 'Méthodes d’évaluation immobilière',
            item: canonical
          }
        ]
      };

      // FAQPage JSON-LD uniquement si FAQ dispo dans la langue
      let faqSource: FaqItem[] = [];
      if (isEN) {
        faqSource = this.METHODS_FAQ_EN ?? [];
      } else {
        faqSource = this.METHODS_FAQ_FR ?? [];
      }

      const faqLd = faqSource.length
        ? {
            '@type': 'FAQPage',
            '@id': `${canonical}#faq`,
            mainEntity: faqSource.map(q => ({
              '@type': 'Question',
              name: q.q,
              acceptedAnswer: {
                '@type': 'Answer',
                text: q.a
              }
            }))
          }
        : null;

      const graph: any[] = [webPage, breadcrumb];
      if (faqLd) graph.push(faqLd);

      this.seo.update({
        title: pageTitle,
        description,
        lang,
        locale,
        localeAlt,
        canonical,
        robots: 'index,follow',
        image: ogAbs,
        imageAlt: isEN
          ? 'Real-estate valuation methods – Groupe ABC'
          : 'Méthodes d’évaluation immobilière – Groupe ABC',
        ...(ogIsDefault ? { imageWidth: 1200, imageHeight: 630 } : {}),
        type: 'website',
        alternates,
        jsonLd: {
          '@context': 'https://schema.org',
          '@graph': graph
        }
      });

      this.scheduleBind();
    });
  }

  /* ===== Accordéon ===== */
  toggleEval(i: number){ this.setSingleOpen(this.evalOpen, i); }
  private setSingleOpen(arr: boolean[], i: number){
    const willOpen = !arr[i];
    arr.fill(false);
    if (willOpen) arr[i] = true;
  }

  /* ===== Img fallbacks ===== */
  onDomainImgError(e: Event){ const img = e.target as HTMLImageElement; if (img) img.src = this.defaultDomainIcon; }
  onMethodImgError(e: Event){ const img = e.target as HTMLImageElement; if (img) img.src = this.defaultEvalIcon; }
  onPilotImgError(e: Event){ const img = e.target as HTMLImageElement; if (img) img.src = this.defaultPilotImg; }
  onWheelImgError(e: Event){ const img = e.target as HTMLImageElement; if (img) img.src = this.defaultWheelImg; }

  /* ===== Utils ===== */
  trackByIndex(i: number){ return i; }
  private safe(html: string): SafeHtml { return this.sanitizer.bypassSecurityTrustHtml(html || ''); }
  private strip(html: string, max = 160): string {
    const t = (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  private currentPath(): string {
    if (this.isBrowser()) {
      try { return window?.location?.pathname || '/'; } catch { return this.router?.url || '/'; }
    }
    return this.router?.url || '/';
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

  /** Résout ID WP / objet / string → URL */
  private async resolveMedia(token: any): Promise<string> {
    if (!token) return '';
    if (typeof token === 'object') {
      const u = token?.source_url || token?.url || '';
      if (u) return u;
      if (token?.id != null) token = token.id;
    }
    if (typeof token === 'number') {
      try { return (await firstValueFrom(this.wp.getMediaUrl(token))) || ''; }
      catch { return ''; }
    }
    if (typeof token === 'string') {
      const s = token.trim();
      if (/^\d+$/.test(s)) {
        try { return (await firstValueFrom(this.wp.getMediaUrl(+s))) || ''; }
        catch { return ''; }
      }
      return s;
    }
    return '';
  }

  /* ================= Animations ================= */
  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser()) return;
    await this.setupGsap();
    this.assetCols?.changes?.subscribe(() => this.scheduleBind());
    this.evalRows?.changes?.subscribe(() => this.scheduleBind());
    this.scheduleBind();
  }

  ngOnDestroy(): void {
    if (!this.isBrowser()) return;
    try { this.gsap?.globalTimeline?.clear?.(); } catch {}
  }

  private scheduleBind(){
    if (!this.isBrowser() || !this.gsap) return;
    if (this.bindScheduled) return;
    this.bindScheduled = true;
    queueMicrotask(() =>
      requestAnimationFrame(() => {
        this.bindScheduled = false;
        this.bindAnimations();
      })
    );
  }

  private forceInitialHidden(host: HTMLElement){
    const gsap = this.gsap!;
    const pre  = Array.from(host.querySelectorAll<HTMLElement>('.prehide'));
    const rows = Array.from(host.querySelectorAll<HTMLElement>('.prehide-row'));
    if (pre.length)  gsap.set(pre,  { autoAlpha: 0, y: 20 });
    if (rows.length) gsap.set(rows, { autoAlpha: 0 });
  }

  private bindAnimations(): void {
    if (!this.isBrowser() || !this.gsap || !this.ScrollTrigger) return;
    const gsap = this.gsap!;
    const ScrollTrigger = this.ScrollTrigger!;

    const host = document.querySelector('.methods-wrapper') as HTMLElement | null;
    if (host) this.forceInitialHidden(host);

    try { ScrollTrigger.getAll().forEach((t: any) => t.kill()); } catch {}

    const EASE = 'power3.out';
    const rmPrehide = (els: Element | Element[]) => {
      (Array.isArray(els) ? els : [els]).forEach(el =>
        el.classList.remove('prehide','prehide-row')
      );
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
          { autoAlpha: 0, y: 20 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.6,
            onStart: () => { rmPrehide(h1); },
            onComplete: () => { gsap.set(h1, { clearProps: 'all' }); }
          },
          0
        );
      }

      if (h2) {
        tl.fromTo(
          h2,
          { autoAlpha: 0, y: 18 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            delay: 0.08,
            onStart: () => { rmPrehide(h2); },
            onComplete: () => { gsap.set(h2, { clearProps: 'all' }); }
          },
          0
        );
      }

      if (hi) {
        tl.fromTo(
          hi,
          { autoAlpha: 0, y: 18 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            delay: 0.14,
            onStart: () => { rmPrehide(hi); },
            onComplete: () => { gsap.set(hi, { clearProps: 'all' }); }
          },
          0
        );
      }

      this.heroBound = true;
    } else {
      [h1, h2, hi].forEach(el => {
        if (!el) return;
        rmPrehide(el);
        gsap.set(el, {
          autoAlpha: 1,
          y: 0,
          clearProps: 'transform,opacity,visibility'
        });
      });
    }

    /* DOMAINES (assets) */
    const assetsList = this.assetsListRef?.nativeElement;
    const cols = (this.assetCols?.toArray() || []).map(r => r.nativeElement);

    if (assetsList && cols.length) {
      let heads: (HTMLElement | null)[] = [];
      let lists: HTMLElement[][] = [];

      if (!this.assetsBound) {
        heads = cols.map(c => c.querySelector<HTMLElement>('.asset-head'));
        lists = cols.map(c => Array.from(c.querySelectorAll<HTMLElement>('.panel-list > li')));

        const headsOk = heads.filter(Boolean) as HTMLElement[];
        if (headsOk.length) gsap.set(headsOk, { autoAlpha: 0, y: 14 });
        lists.forEach(arr => arr.length && gsap.set(arr, { autoAlpha: 0, y: 10 }));
      }

      if (!this.assetsBound) {
        const tl = gsap.timeline({
          defaults: { ease: EASE },
          scrollTrigger: {
            id: 'assets-grid',
            trigger: assetsList,
            start: 'top 85%',
            once: true
          },
          onStart: () => { rmPrehide([assetsList, ...cols]); },
          onComplete: () => {
            this.assetsBound = true;
            try {
              const all = [
                assetsList,
                ...cols,
                ...(heads.filter(Boolean) as HTMLElement[]),
                ...lists.flat()
              ];
              gsap.set(all, { clearProps: 'all' });
            } catch {}
          }
        });

        tl.fromTo(
          assetsList,
          { autoAlpha: 0, y: 12 },
          { autoAlpha: 1, y: 0, duration: 0.38, immediateRender: false },
          0
        );

        cols.forEach((_, i) => {
          const at  = 0.10 + i * 0.12;
          const hd  = heads[i] as HTMLElement | undefined;
          const its = (lists[i] || []) as HTMLElement[];

          if (hd) {
            tl.to(hd, { autoAlpha: 1, y: 0, duration: 0.40 }, at);
          }
          if (its.length) {
            tl.to(
              its,
              { autoAlpha: 1, y: 0, duration: 0.40, stagger: 0.04 },
              at + 0.06
            );
          }
        });
      }
    }

    /* WHEEL */
    const wTitle = this.wheelTitleRef?.nativeElement;
    const wWrap  = this.wheelWrapRef?.nativeElement;

    if (wTitle){
      gsap.fromTo(
        wTitle,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.52,
          ease: EASE,
          scrollTrigger:{ trigger: wTitle, start: 'top 85%', once: true },
          onStart: () => { rmPrehide(wTitle); },
          onComplete: () => { gsap.set(wTitle, { clearProps: 'all' }); }
        }
      );
    }
    if (wWrap){
      gsap.fromTo(
        wWrap,
        { autoAlpha: 0, scale: 0.985 },
        {
          autoAlpha: 1,
          scale: 1,
          duration: 0.52,
          ease: 'power2.out',
          scrollTrigger:{ trigger: wWrap, start: 'top 85%', once: true },
          onStart: () => { rmPrehide(wWrap); },
          onComplete: () => { gsap.set(wWrap, { clearProps: 'all' }); }
        }
      );
    }

    /* MÉTHODES */
    const eTitle = this.evalTitleRef?.nativeElement;
    const eList  = this.evalListRef?.nativeElement;
    const eRows  = (this.evalRows?.toArray() || []).map(r => r.nativeElement);

    if (eTitle){
      gsap.fromTo(
        eTitle,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.52,
          ease: EASE,
          scrollTrigger:{ trigger: eTitle, start: 'top 85%', once: true },
          onStart: () => { rmPrehide(eTitle); },
          onComplete: () => { gsap.set(eTitle, { clearProps: 'all' }); }
        }
      );
    }
    if (eList && eRows.length){
      gsap.set(eRows, { autoAlpha: 0, y: 12 });
      gsap.timeline({
        defaults: { ease: EASE },
        scrollTrigger:{ trigger: eList, start: 'top 85%', once: true },
        onStart: () => { rmPrehide([eList, ...eRows]); }
      })
      .fromTo(eList, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.36 }, 0)
      .to(eRows, { autoAlpha: 1, y: 0, duration: 0.40, stagger: 0.08 }, 0.08);
    }

    /* PILOTAGE */
    const pTitle = this.pilotTitleRef?.nativeElement;
    const pIntro = this.pilotIntroRef?.nativeElement;
    const pGrid  = this.pilotGridRef?.nativeElement;

    if (pTitle){
      gsap.fromTo(
        pTitle,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1, y: 0, duration: 0.5, ease: EASE,
          scrollTrigger:{ trigger: pTitle, start: 'top 85%', once: true },
          onStart: () => { rmPrehide(pTitle); },
          onComplete: () => { gsap.set(pTitle, { clearProps: 'all' }); }
        }
      );
    }
    if (pIntro){
      gsap.fromTo(
        pIntro,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1, y: 0, duration: 0.5, ease: EASE,
          scrollTrigger:{ trigger: pIntro, start: 'top 85%', once: true },
          onStart: () => { rmPrehide(pIntro); },
          onComplete: () => { gsap.set(pIntro, { clearProps: 'all' }); }
        }
      );
    }
    if (pGrid){
      const figures = Array.from(pGrid.querySelectorAll<HTMLElement>('.pilot-figure'));
      gsap.set(figures, { autoAlpha: 0, y: 12 });
      gsap.timeline({
        defaults: { ease: EASE },
        scrollTrigger:{ trigger: pGrid, start: 'top 85%', once: true },
        onStart: () => { rmPrehide([pGrid, ...figures]); }
      })
      .fromTo(pGrid, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.38 }, 0)
      .to(figures, { autoAlpha: 1, y: 0, duration: 0.40, stagger: 0.08 }, 0.06);
    }

    try { ScrollTrigger.refresh(); } catch {}
  }
}
