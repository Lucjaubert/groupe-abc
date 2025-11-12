import {
  Component, OnInit, AfterViewInit, OnDestroy,
  inject, ElementRef, ViewChild, ViewChildren, QueryList, PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { ImgFastDirective } from '../../directives/img-fast.directive';
import { FaqService, FaqItem } from '../../services/faq.service';
import { environment } from '../../../environments/environment';

type ContextIntro = { title: string; html: SafeHtml | string };
type ContextItem  = { icon?: string | number; iconUrl?: string; title: string; html?: SafeHtml | string };
type ClientItem   = { title: string; html?: SafeHtml | string };

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule, ImgFastDirective],
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.scss']
})
export class ServicesComponent implements OnInit, AfterViewInit, OnDestroy {
  private wp        = inject(WordpressService);
  private seo       = inject(SeoService);
  private sanitizer = inject(DomSanitizer);
  private faq       = inject(FaqService);
  private platformId = inject(PLATFORM_ID);

  // GSAP lazy (SSR-safe)
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

  s(v: unknown): string { return v == null ? '' : '' + v; }

  /* ===== Données ===== */
  pageTitle = 'Nos services';

  ctxIntro: ContextIntro = { title: '', html: '' };
  contexts: ContextItem[] = [];
  ctxOpen: boolean[] = [];

  clientsTitle = '';
  clients: ClientItem[] = [];
  cliOpen: boolean[] = [];

  isReady = false;

  refsTitle = 'Ils nous font confiance';
  references: string[] = [];

  /* ===== FAQ (bulle & SEO) ===== */
  faqItems: FaqItem[] = [];
  faqOpen: boolean[] = [];
  isEN = false;

  /* ===== État visuel des chevrons ===== */
  deonOpen: boolean[] = [];

  /* ===== Fallbacks ===== */
  defaultCtxIcon = '/assets/fallbacks/icon-placeholder.svg';
  defaultRefLogo = '/assets/fallbacks/logo-placeholder.svg';

  /* ===== Refs Animations ===== */
  @ViewChild('heroTitle') heroTitle!: ElementRef<HTMLElement>;

  @ViewChild('ctxTitle') ctxTitleRef!: ElementRef<HTMLElement>;
  @ViewChild('ctxSub')   ctxSubRef!: ElementRef<HTMLElement>;
  @ViewChildren('ctxRow') ctxRows!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('ctxList')  ctxListRef!: ElementRef<HTMLElement>;

  @ViewChild('clientsTitleEl') clientsTitleRef!: ElementRef<HTMLElement>;
  @ViewChildren('cliRow') cliRows!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('cliList')  cliListRef!: ElementRef<HTMLElement>;

  @ViewChild('refsTitleEl') refsTitleRef!: ElementRef<HTMLElement>;
  @ViewChildren('refLogo') refLogos!: QueryList<ElementRef<HTMLImageElement>>;
  @ViewChild('refsGrid')  refsGridRef!: ElementRef<HTMLElement>;

  /* ===== Flags / Locks ===== */
  private heroPlayed = false;
  private contextsPlayed = false;
  private contextsVisible = false;
  private bindScheduled = false;
  private animLock = false; // verrou pendant la séquence hero→contexts

  /* ===== Helpers ===== */
  private safe(html: string): SafeHtml { return this.sanitizer.bypassSecurityTrustHtml(html || ''); }
  private strip(html: string, max = 160): string {
    const t = (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }
  private isEnglish(): boolean {
    if (!this.isBrowser()) return false;
    try { return (window?.location?.pathname || '/').startsWith('/en'); }
    catch { return false; }
  }
  trackByIndex(i: number){ return i; }

  /* ===================== FAQ – contenus ===================== */
  private readonly SERVICES_FAQ_FR: FaqItem[] = [
    {
      q: 'Quels types de biens peuvent faire l’objet d’une expertise immobilière ?',
      a: 'L’expertise peut concerner tous types de biens bâtis et non bâtis : logements, immeubles de bureaux, locaux commerciaux, entrepôts, terrains nus ou constructibles, actifs industriels ou propriétés spécifiques. L’expert adapte sa méthodologie selon la nature du bien et son usage.'
    },
    {
      q: 'Quelles sont les principales méthodes d’évaluation utilisées ?',
      a: 'Selon le contexte : méthode par comparaison, capitalisation du revenu (rendement), coût de remplacement net, Discounted Cash Flow (DCF) pour les actifs à revenus, et bilan promoteur pour les opérations de promotion. Chaque rapport précise les hypothèses retenues et les calculs effectués.'
    },
    {
      q: 'Dans quels contextes réaliser une expertise immobilière ?',
      a: 'Succession ou donation, divorce ou partage, financement bancaire ou garantie hypothécaire, litige locatif ou révision de loyer, cession ou arbitrage d’actifs, expropriation ou procédure judiciaire. L’expertise fournit une valeur certifiée et opposable.'
    },
    {
      q: 'Quelle est la différence entre expertise amiable et judiciaire ?',
      a: 'L’expertise amiable est demandée par un particulier, une entreprise ou une institution dans un cadre volontaire. L’expertise judiciaire est ordonnée par un tribunal et réalisée par un expert inscrit près une Cour d’appel. Les deux obéissent à la même rigueur méthodologique.'
    },
    {
      q: 'Quelle est la durée de validité d’un rapport d’expertise immobilière ?',
      a: 'Le rapport reste valable tant que les conditions économiques et physiques du bien n’évoluent pas significativement. Une mise à jour est généralement recommandée tous les 12 à 24 mois, surtout en période de forte variation de marché.'
    },
    {
      q: 'Un expert immobilier peut-il intervenir sur plusieurs régions ?',
      a: 'Oui, les experts du réseau interviennent sur tout le territoire national et en Outre-mer. Si une connaissance fine du marché local est requise, un expert régional est mandaté pour garantir la fiabilité de l’évaluation.'
    }
  ];
  private readonly SERVICES_FAQ_EN: FaqItem[] = [
    { q: 'What types of assets can be appraised?', a: 'All asset types: residential, office buildings, retail, warehouses, land (raw or buildable), industrial assets or specific properties. The methodology is adapted to the asset’s nature and use.' },
    { q: 'What are the main valuation methods?', a: 'Depending on the context: comparable approach, income capitalization (yield), depreciated replacement cost, discounted cash flow (DCF) for income-producing assets, and developer’s residual method for development projects.' },
    { q: 'In which situations should you request an appraisal?', a: 'Inheritance or donation, divorce or partition, bank financing or mortgage security, lease disputes or rent review, sale or arbitration, expropriation or court proceedings. The appraisal delivers a certified, defensible value.' },
    { q: 'Difference between amicable and judicial appraisal?', a: 'Amicable appraisals are commissioned voluntarily by private or corporate clients. Judicial appraisals are ordered by courts and carried out by experts registered with a Court of Appeal. Both follow strict, documented methodologies.' },
    { q: 'How long is an appraisal report valid?', a: 'As long as the asset and market conditions remain stable. A refresh is usually recommended every 12–24 months, especially in volatile markets.' },
    { q: 'Do experts operate nationwide?', a: 'Yes, experts cover mainland France and overseas territories. When deep local knowledge is required, a regional expert is mandated.' }
  ];

  /* ===================== Chargement data ===================== */
  ngOnInit(): void {
    // Langue + FAQ
    this.isEN = this.isEnglish();

    // Expose la FAQ (FR + EN) au service global
    this.faq.set(this.SERVICES_FAQ_FR, this.SERVICES_FAQ_EN);

    // Données FAQ locales (bloc accordéon)
    this.faqItems = this.isEN ? this.SERVICES_FAQ_EN : this.SERVICES_FAQ_FR;
    this.faqOpen  = new Array(this.faqItems.length).fill(false);

    this.wp.getServicesData().subscribe(async (payload: any) => {
      const root = Array.isArray(payload) ? payload[0] : payload;
      const acf  = root?.acf ?? {};

      /* ---------- HERO & CONTEXT INTRO ---------- */
      this.pageTitle = acf?.hero?.section_title || (this.isEN ? 'Our services' : 'Nos services');
      const heroCtx  = acf?.hero?.contexts ?? {};
      this.ctxIntro = {
        title: heroCtx?.section_title || (this.isEN ? 'Contexts of intervention' : 'Contextes d’interventions'),
        html : this.safe(heroCtx?.section_presentation || '')
      };

      /* ---------- CONTEXTES ---------- */
      const ctxObj = acf?.contexts ?? {};
      const raw: ContextItem[] = Object.values(ctxObj)
        .filter((it: any) => it && (it.title || it.description || it.icon))
        .map((it: any) => ({
          icon : it?.icon ?? '',
          title: it?.title || '',
          html : this.safe(it?.description || '')
        }));

      this.contexts = raw.map(it => ({ ...it, iconUrl: this.defaultCtxIcon }));
      this.ctxOpen  = new Array(this.contexts.length).fill(false);

      await this.hydrateContextIcons();

      /* ---------- CLIENTS ---------- */
      const clientsRoot = acf?.clients ?? {};
      const sectionClients = clientsRoot?.section_clients ?? {};
      this.clientsTitle = sectionClients?.title || (this.isEN ? 'Clients' : 'Nos Clients');
      this.clients = Object.entries(clientsRoot)
        .filter(([k, v]) => /^client_type_/i.test(k) && v)
        .map(([, v]: any) => ({
          title: v?.client_title || '',
          html : this.safe(v?.client_description || '')
        }));
      this.cliOpen = new Array(this.clients.length).fill(false);

      /* ---------- RÉFÉRENCES ---------- */
      const refs = acf?.references ?? {};
      this.refsTitle = refs?.section_title || (this.isEN ? 'They trust us' : 'Ils nous font confiance');
      const logoTokens = Object.entries(refs)
        .filter(([k, v]) => /^logo_/i.test(k) && v != null && v !== '')
        .map(([, v]: any) =>
          (typeof v === 'number' || typeof v === 'string') ? v : (v?.id ?? v?.url ?? '')
        )
        .filter((v: any) => v !== '' && v != null) as Array<string | number>;

      this.hydrateReferences(logoTokens);

      /* ---------- SEO ---------- */
      this.applySeo(String(heroCtx?.section_presentation || ''));

      this.scheduleBind();
    });
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser()) return;
    await this.setupGsap();

    this.ctxRows?.changes?.subscribe(() => { if (!this.animLock) this.scheduleBind(); });
    this.cliRows?.changes?.subscribe(() => { if (!this.animLock) this.scheduleBind(); });
    this.refLogos?.changes?.subscribe(() => { if (!this.animLock) this.scheduleBind(); });

    this.scheduleBind();
  }

  ngOnDestroy(): void {
    if (this.isBrowser() && this.ScrollTrigger) {
      try { this.ScrollTrigger.getAll().forEach((t: any) => t.kill()); } catch {}
      try { this.gsap?.globalTimeline?.clear?.(); } catch {}
    }
    this.faq.clear();
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

  private async hydrateContextIcons(): Promise<void> {
    if (!this.contexts?.length) return;
    const urls = await Promise.all(this.contexts.map(it => this.resolveMedia(it.icon)));
    this.contexts = this.contexts.map((it, idx) => ({
      ...it,
      iconUrl: urls[idx] || this.defaultCtxIcon
    }));
  }

  private hydrateReferences(tokens: Array<string | number>): void {
    if (!tokens?.length) { this.references = []; return; }
    Promise.all(tokens.map(t => this.resolveMedia(t)))
      .then(urls => this.references = (urls.filter(Boolean) as string[]))
      .catch(() => { this.references = []; });
  }

  /* ===================== Accordéons + chevrons ===================== */
  toggleCtx(i: number){
    this.setSingleOpen(this.ctxOpen, i);
    this.syncChevronFrom(this.ctxOpen);
  }
  toggleCli(i: number){
    this.setSingleOpen(this.cliOpen, i);
    this.syncChevronFrom(this.cliOpen);
  }
  toggleFaq(i: number){
    const willOpen = !this.faqOpen[i];
    this.faqOpen.fill(false);
    if (willOpen) this.faqOpen[i] = true;
  }

  toggleDeon(i: number, ev?: MouseEvent){
    ev?.stopPropagation();
    this.ensureDeonIndex(i);
    this.deonOpen[i] = !this.deonOpen[i];
  }

  private setSingleOpen(arr: boolean[], i: number){
    const willOpen = !arr[i];
    arr.fill(false);
    if (willOpen) arr[i] = true;
    this.resizeDeon();
  }

  private syncChevronFrom(source: boolean[]){
    this.resizeDeon();
    source.forEach((v, i) => { this.deonOpen[i] = v; });
  }

  private ensureDeonIndex(i: number){
    if (this.deonOpen.length <= i) {
      const old = this.deonOpen.length;
      this.deonOpen.length = i + 1;
      this.deonOpen.fill(false, old);
    }
  }
  private resizeDeon(){
    const maxLen = Math.max(this.contexts.length, this.clients.length, this.deonOpen.length);
    if (this.deonOpen.length < maxLen) {
      const old = this.deonOpen.length;
      this.deonOpen.length = maxLen;
      this.deonOpen.fill(false, old);
    }
  }

  /* ===================== Img fallbacks ===================== */
  onImgError(evt: Event){ const img = evt.target as HTMLImageElement; if (img) img.src = this.defaultCtxIcon; }
  onRefImgError(evt: Event){ const img = evt.target as HTMLImageElement; if (img) img.src = this.defaultRefLogo; }

  /* ===================== SEO ===================== */
  private applySeo(_rawIntro: string): void {
    const isEN   = this.isEN;
    const siteUrl = (environment.siteUrl || 'https://groupe-abc.fr').replace(/\/+$/,'');
    const pathFR = '/expertise-immobiliere-services';
    const pathEN = '/en/real-estate-valuation-services';
    const canonPath = isEN ? pathEN : pathFR;
    const canonicalAbs = this.normalizeUrl(siteUrl, canonPath);

    const alternates = [
      { lang: 'fr',        href: this.normalizeUrl(siteUrl, pathFR) },
      { lang: 'en',        href: this.normalizeUrl(siteUrl, pathEN) },
      { lang: 'x-default', href: this.normalizeUrl(siteUrl, pathFR) }
    ];

    const META_TITLE_FR = 'Services d’expertise immobilière – Valeur vénale et locative';
    const META_DESC_FR  = 'Découvrez nos services d’expertise immobilière : valeur vénale, valeur locative, droit au bail, arbitrage, succession, financement et expropriation.';
    const META_TITLE_EN = 'Real-estate appraisal services – Market and rental value';
    const META_DESC_EN  = 'Discover our real-estate appraisal services: market value, rental value, leasehold, arbitration, inheritance, financing and expropriation.';

    const title       = isEN ? META_TITLE_EN : META_TITLE_FR;
    const description = (isEN ? META_DESC_EN : META_DESC_FR).slice(0, 160);

    const siteId = `${siteUrl}#website`;
    const orgId  = `${siteUrl}#org`;

    const ogImage = '/assets/og/og-default.jpg';
    const ogAbs   = this.absUrl(ogImage, siteUrl);

    // Service spécifique à la page
    const service = {
      '@type': 'Service',
      '@id': `${canonicalAbs}#service`,
      serviceType: isEN
        ? 'Real-estate appraisal – Market & rental value'
        : 'Expertise immobilière – Valeur vénale et locative',
      provider: 'Groupe ABC – Experts agréés',
      areaServed: 'France métropolitaine et Outre-mer'
    };

    // FAQ JSON-LD (FR/EN)
    const faqSource = isEN ? this.SERVICES_FAQ_EN : this.SERVICES_FAQ_FR;
    const faqLd = {
      '@type': 'FAQPage',
      '@id': `${canonicalAbs}#faq`,
      mainEntity: faqSource.map(q => ({
        '@type': 'Question',
        name: q.q,
        acceptedAnswer: { '@type': 'Answer', text: q.a }
      }))
    };

    const webPage = {
      '@type': 'WebPage',
      '@id': `${canonicalAbs}#webpage`,
      url: canonicalAbs,
      name: title,
      description,
      inLanguage: isEN ? 'en-US' : 'fr-FR',
      isPartOf: { '@id': siteId },
      about: { '@id': orgId },
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: ogAbs
      }
    };

    const breadcrumb = {
      '@type': 'BreadcrumbList',
      '@id': `${canonicalAbs}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: isEN ? 'Home' : 'Accueil',
          item: `${siteUrl}/`
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: isEN ? 'Services' : 'Services',
          item: canonicalAbs
        }
      ]
    };

    this.seo.update({
      title,
      description,
      canonical: canonicalAbs,
      robots: 'index,follow',
      image: ogAbs,
      imageAlt: isEN ? 'Groupe ABC – Services' : 'Groupe ABC – Services',
      type: 'website',
      locale: isEN ? 'en_US' : 'fr_FR',
      alternates,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          webPage,
          breadcrumb,
          service,
          faqLd
        ]
      }
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
    } catch { return url; }
  }

  /* ================= Animations ================= */
  private scheduleBind(){
    if (!this.isBrowser() || !this.gsap) return;
    if (this.bindScheduled) return;

    if (this.animLock) {
      queueMicrotask(() => requestAnimationFrame(() => this.scheduleBind()));
      return;
    }

    this.bindScheduled = true;
    queueMicrotask(() => requestAnimationFrame(() => {
      this.bindScheduled = false;
      this.bindAnimations();
    }));
  }

  private forceInitialHidden(root: HTMLElement){
    if (!this.isBrowser() || !this.gsap) return;
    if (this.animLock) return;
    const gsap = this.gsap!;
    const pre  = Array.from(root.querySelectorAll<HTMLElement>('.prehide'));
    const rows = Array.from(root.querySelectorAll<HTMLElement>('.prehide-row'));
    if (pre.length)  gsap.set(pre,  { autoAlpha: 0, y: 20, visibility: 'hidden' });
    if (rows.length) gsap.set(rows, { autoAlpha: 0, visibility: 'hidden' });
  }

  private hideContextsSectionOnce(){
    if (!this.isBrowser() || !this.gsap) return;
    const gsap = this.gsap!;
    const contextsSection = document.querySelector('.contexts') as HTMLElement | null;
    const ctxListEl = this.ctxListRef?.nativeElement;
    this.animLock = true;

    if (contextsSection) {
      gsap.set(contextsSection, { autoAlpha: 0, visibility: 'hidden', pointerEvents: 'none' });
    }
    if (ctxListEl) {
      (ctxListEl as HTMLElement).style.setProperty('border-top-color', 'transparent', 'important');
    }
  }

  private revealContextsAfterHero(){
    if (!this.isBrowser() || !this.gsap) return;
    if (this.contextsPlayed || this.contextsVisible) return;

    const gsap = this.gsap!;
    const ScrollTrigger = this.ScrollTrigger!;
    const contextsSection = document.querySelector('.contexts') as HTMLElement | null;
    const ctxListEl = this.ctxListRef?.nativeElement;
    const ctxRowEls = (this.ctxRows?.toArray() || []).map(r => r.nativeElement);
    const EASE = 'power3.out';

    if (ctxListEl) (ctxListEl as HTMLElement).classList.remove('prehide', '_hold-bar');
    ctxRowEls.forEach(el => el.classList.remove('prehide-row'));

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
        try { ScrollTrigger.refresh(); } catch {}
      }
    });

    if (ctxListEl) {
      tl.fromTo(ctxListEl,
        { autoAlpha: 0, y: 12 },
        {
          autoAlpha: 1, y: 0, duration: 0.28, immediateRender: false,
          onStart: () => { (ctxListEl as HTMLElement).style.removeProperty('border-top-color'); },
          onComplete: () => { gsap.set(ctxListEl, { clearProps: 'transform,opacity' }); }
        },
        0
      );
    }

    if (ctxRowEls.length) {
      gsap.set(ctxRowEls, { autoAlpha: 0, y: 8 });
      tl.to(ctxRowEls, {
        autoAlpha: 1, y: 0, duration: 0.24,
        onComplete: () => { gsap.set(ctxRowEls, { clearProps: 'transform,opacity' }); }
      }, '<');
    }
  }

  private bindAnimations(): void {
    if (!this.isBrowser() || !this.gsap || !this.ScrollTrigger) return;
    const gsap = this.gsap!;
    const ScrollTrigger = this.ScrollTrigger!;

    const host = document.querySelector('.services-wrapper') as HTMLElement | null;
    if (host) this.forceInitialHidden(host);

    try { ScrollTrigger.getAll().forEach((t: any) => t.kill()); } catch {}
    const EASE = 'power3.out';

    const rmPrehide = (els: Element | Element[]) => {
      (Array.isArray(els) ? els : [els]).forEach(el => el.classList.remove('prehide','prehide-row'));
    };
    const show = (el?: Element | null) => {
      if (!el) return;
      rmPrehide(el);
      gsap.set(el, { visibility: 'visible' });
    };

    if (!this.heroPlayed) this.hideContextsSectionOnce();

    const h1     = this.heroTitle?.nativeElement;
    const tTitle = this.ctxTitleRef?.nativeElement;
    const tSub   = this.ctxSubRef?.nativeElement;

    gsap.killTweensOf([h1, tTitle, tSub].filter(Boolean) as HTMLElement[]);

    if (!this.heroPlayed && h1) {
      this.animLock = true;
      gsap.timeline({ defaults: { ease: EASE } })
        .fromTo(h1, { autoAlpha: 0, y: 20, visibility: 'hidden' }, {
          autoAlpha: 1, y: 0, duration: 0.42,
          onStart: () => { show(h1); },
          onComplete: () => { gsap.set(h1, { clearProps: 'all' }); }
        })
        .fromTo(tTitle, { autoAlpha: 0, y: 14, visibility: 'hidden' }, {
          autoAlpha: 1, y: 0, duration: 0.30,
          onStart: () => { show(tTitle); },
          onComplete: () => { if (tTitle) gsap.set(tTitle, { clearProps: 'all' }); }
        })
        .fromTo(tSub, { autoAlpha: 0, y: 12, visibility: 'hidden' }, {
          autoAlpha: 1, y: 0, duration: 0.28,
          onStart: () => { show(tSub); },
          onComplete: () => { if (tSub) gsap.set(tSub, { clearProps: 'all' }); }
        })
        .add(() => { this.heroPlayed = true; })
        .add(() => this.revealContextsAfterHero());
    } else {
      [h1, tTitle, tSub].forEach(el => {
        if (!el) return;
        show(el);
        gsap.set(el, { autoAlpha: 1, y: 0, clearProps: 'transform,opacity,visibility' });
      });
      this.revealContextsAfterHero();
    }

    /* ---------- CLIENTS (scroll) ---------- */
    const cliTitleEl = this.clientsTitleRef?.nativeElement;
    const cliListEl  = this.cliListRef?.nativeElement;
    const cliRowEls  = (this.cliRows?.toArray() || []).map(r => r.nativeElement);

    if (cliTitleEl) {
      gsap.fromTo(
        cliTitleEl,
        { autoAlpha: 0, y: 18 },
        {
          autoAlpha: 1, y: 0, duration: 0.38, ease: EASE,
          scrollTrigger: { trigger: cliTitleEl, start: 'top 85%', once: true },
          onStart: () => { show(cliTitleEl); },
          onComplete: () => { gsap.set(cliTitleEl, { clearProps: 'all' }); }
        }
      );
    }

    if (cliListEl) {
      gsap.fromTo(
        cliListEl,
        { autoAlpha: 0, y: 10 },
        {
          autoAlpha: 1, y: 0, duration: 0.30, ease: EASE,
          scrollTrigger: { trigger: cliListEl, start: 'top 85%', once: true },
          immediateRender: false,
          onStart: () => { show(cliListEl); },
          onComplete: () => { gsap.set(cliListEl, { clearProps: 'all' }); }
        }
      );
    }

    if (cliRowEls.length) {
      gsap.set(cliRowEls, { autoAlpha: 0, y: 10 });
      gsap.to(cliRowEls, {
        autoAlpha: 1, y: 0, duration: 0.28, stagger: 0.06, ease: EASE,
        scrollTrigger: { trigger: cliListEl || cliRowEls[0], start: 'top 85%', once: true }
      });
    }

    /* ---------- RÉFÉRENCES (scroll) ---------- */
    const refsTitleEl = this.refsTitleRef?.nativeElement;
    const refsGridEl  = this.refsGridRef?.nativeElement;
    const logoEls     = (this.refLogos?.toArray() || []).map(r => r.nativeElement);

    if (refsTitleEl) {
      gsap.fromTo(
        refsTitleEl,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1, y: 0, duration: 0.32, ease: EASE,
          scrollTrigger: { trigger: refsTitleEl, start: 'top 85%', once: true },
          onStart: () => { show(refsTitleEl); },
          onComplete: () => { gsap.set(refsTitleEl, { clearProps: 'all' }); }
        }
      );
    }

    if (refsGridEl) {
      gsap.fromTo(
        refsGridEl,
        { autoAlpha: 0, y: 8 },
        {
          autoAlpha: 1, y: 0, duration: 0.26, ease: EASE,
          scrollTrigger: { trigger: refsGridEl, start: 'top 88%', once: true },
          immediateRender: false,
          onStart: () => { show(refsGridEl); },
          onComplete: () => { gsap.set(refsGridEl, { clearProps: 'all' }); }
        }
      );
    }

    if (logoEls.length) {
      gsap.set(logoEls, { autoAlpha: 0, y: 10, scale: 0.985 });
      gsap.to(logoEls, {
        autoAlpha: 1, y: 0, scale: 1, duration: 0.30, stagger: 0.10, ease: EASE,
        scrollTrigger: { trigger: refsGridEl || logoEls[0], start: 'top 88%', once: true }
      });
    }

    try { ScrollTrigger.refresh(); } catch {}
  }
}
