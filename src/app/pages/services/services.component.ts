import {
  Component, OnInit, AfterViewInit, OnDestroy,
  inject, ElementRef, ViewChild, ViewChildren, QueryList
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
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
  private wp  = inject(WordpressService);
  private seo = inject(SeoService);
  private sanitizer = inject(DomSanitizer);
  private faq = inject(FaqService);

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
    try { return (window?.location?.pathname || '/').startsWith('/en'); }
    catch { return false; }
  }
  trackByIndex(i: number){ return i; }

  /* ===================== FAQ – contenus Matthieu ===================== */
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
  private readonly SERVICES_FAQ_EN: FaqItem[] | undefined = undefined;

  /* ===================== Chargement data ===================== */
  ngOnInit(): void {
    // Pousser la FAQ de la page dans la bulle
    this.faq.set(this.SERVICES_FAQ_FR, this.SERVICES_FAQ_EN);

    this.wp.getServicesData().subscribe(async (payload: any) => {
      const root = Array.isArray(payload) ? payload[0] : payload;
      const acf  = root?.acf ?? {};

      /* ---------- HERO & CONTEXT INTRO ---------- */
      this.pageTitle = acf?.hero?.section_title || 'Nos services';
      const heroCtx  = acf?.hero?.contexts ?? {};
      this.ctxIntro = {
        title: heroCtx?.section_title || 'Contextes d’interventions',
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

      // ⬇️ Hydratation des icônes en batch et attente avant animations
      await this.hydrateContextIcons();

      /* ---------- CLIENTS ---------- */
      const clientsRoot = acf?.clients ?? {};
      const sectionClients = clientsRoot?.section_clients ?? {};
      this.clientsTitle = sectionClients?.title || 'Nos Clients';
      this.clients = Object.entries(clientsRoot)
        .filter(([k, v]) => /^client_type_/i.test(k) && v)
        .map(([, v]: any) => ({
          title: v?.client_title || '',
          html : this.safe(v?.client_description || '')
        }));
      this.cliOpen = new Array(this.clients.length).fill(false);

      /* ---------- RÉFÉRENCES ---------- */
      const refs = acf?.references ?? {};
      this.refsTitle = refs?.section_title || 'Ils nous font confiance';
      const logoTokens = Object.entries(refs)
        .filter(([k, v]) => /^logo_/i.test(k) && v != null && v !== '')
        .map(([, v]: any) =>
          (typeof v === 'number' || typeof v === 'string') ? v : (v?.id ?? v?.url ?? '')
        )
        .filter((v: any) => v !== '' && v != null) as Array<string | number>;

      this.hydrateReferences(logoTokens);

      /* ---------- SEO (Matthieu) ---------- */
      this.applySeo(String(heroCtx?.section_presentation || ''));

      // Animations après hydratation pour éviter tout “retard” visuel
      this.scheduleBind();
    });
  }

  ngOnDestroy(): void {
    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}
    try { gsap.globalTimeline.clear(); } catch {}
    // Option : this.faq.clear();
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

  // ⬇️ Nouvelle version batchée + retournant une Promise qu’on attend dans ngOnInit
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

  /* ===================== SEO (Matthieu) ===================== */
  private applySeo(rawIntro: string): void {
    const isEN = this.isEnglish();
    const siteUrl = (environment.siteUrl || '').replace(/\/+$/,'') || 'https://groupe-abc.fr';

    // Slugs canoniques validés
    const pathFR = '/expertise-immobiliere-services';
    const pathEN = '/en/expertise-immobiliere-services';
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

    const title = isEN ? META_TITLE_EN : META_TITLE_FR;
    const description = isEN ? META_DESC_EN : META_DESC_FR;

    const service = {
      '@type': 'Service',
      'serviceType': 'Expertise immobilière – Valeur vénale et locative',
      'provider': 'Groupe ABC – Experts agréés',
      'areaServed': 'France métropolitaine et Outre-mer'
    };

    const faqList = (this.SERVICES_FAQ_EN && isEN ? this.SERVICES_FAQ_EN : this.SERVICES_FAQ_FR)
      .map(q => ({
        '@type': 'Question',
        'name': q.q,
        'acceptedAnswer': { '@type': 'Answer', 'text': q.a }
      }));
    const faq = { '@type': 'FAQPage', 'mainEntity': faqList };

    const ogImage = '/assets/og/og-default.jpg';
    const ogAbs = this.absUrl(ogImage, siteUrl);

    this.seo.update({
      title,
      description,
      canonical: canonicalAbs, // absolu
      robots: 'index,follow',
      image: ogAbs,
      imageAlt: isEN ? 'Groupe ABC – Services' : 'Groupe ABC – Services',
      type: 'website',
      locale: isEN ? 'en_US' : 'fr_FR',
      alternates,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', '@id': `${siteUrl}/#website`, url: siteUrl, name: 'Groupe ABC', inLanguage: isEN ? 'en-US' : 'fr-FR', publisher: { '@id': `${siteUrl}/#organization` } },
          { '@type': 'Organization', '@id': `${siteUrl}/#organization`, name: 'Groupe ABC', url: siteUrl, logo: `${siteUrl}/assets/favicons/android-chrome-512x512.png` },
          { '@type': 'WebPage', '@id': `${canonicalAbs}#webpage`, url: canonicalAbs, name: title, description, inLanguage: isEN ? 'en-US' : 'fr-FR', isPartOf: { '@id': `${siteUrl}/#website` }, primaryImageOfPage: ogAbs },
          { '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: isEN ? 'Home' : 'Accueil', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: isEN ? 'Services' : 'Services', item: canonicalAbs }
          ]},
          service,
          faq
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
  ngAfterViewInit(): void {
    gsap.registerPlugin(ScrollTrigger);

    // Rebind uniquement si pas de lock (évite le clignotement)
    this.ctxRows?.changes?.subscribe(() => { if (!this.animLock) this.scheduleBind(); });
    this.cliRows?.changes?.subscribe(() => { if (!this.animLock) this.scheduleBind(); });
    this.refLogos?.changes?.subscribe(() => { if (!this.animLock) this.scheduleBind(); });

    this.scheduleBind();
  }

  private scheduleBind(){
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

  /** Force l’état initial (évite le flash si la CSS charge tard) */
  private forceInitialHidden(root: HTMLElement){
    if (this.animLock) return; // ne rien cacher pendant la séquence héro
    const pre  = Array.from(root.querySelectorAll<HTMLElement>('.prehide'));
    const rows = Array.from(root.querySelectorAll<HTMLElement>('.prehide-row'));
    if (pre.length)  gsap.set(pre,  { autoAlpha: 0, y: 20, visibility: 'hidden' });
    if (rows.length) gsap.set(rows, { autoAlpha: 0, visibility: 'hidden' });
  }

  /** Cache totalement la section Contextes pendant le hero */
  private hideContextsSectionOnce(){
    const contextsSection = document.querySelector('.contexts') as HTMLElement | null;
    const ctxListEl = this.ctxListRef?.nativeElement;
    this.animLock = true; // verrou pendant la séquence hero

    if (contextsSection) {
      gsap.set(contextsSection, { autoAlpha: 0, visibility: 'hidden', pointerEvents: 'none' });
    }
    if (ctxListEl) {
      (ctxListEl as HTMLElement).style.setProperty('border-top-color', 'transparent', 'important');
    }
  }

  /** Révèle la section Contextes après le Sub, sans flicker */
  private revealContextsAfterHero(){
    if (this.contextsPlayed || this.contextsVisible) return;

    const contextsSection = document.querySelector('.contexts') as HTMLElement | null;
    const ctxListEl = this.ctxListRef?.nativeElement;
    const ctxRowEls = (this.ctxRows?.toArray() || []).map(r => r.nativeElement);
    const EASE = 'power3.out';

    // retirer les classes susceptibles d'être recachées par forceInitialHidden
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
      // ⬇️ Toutes les lignes en même temps, exactement au même instant que la liste
      tl.to(ctxRowEls, {
        autoAlpha: 1, y: 0, duration: 0.24,
        onComplete: () => { gsap.set(ctxRowEls, { clearProps: 'transform,opacity' }); }
      }, '<'); // '<' = même repère temporel que l'étape précédente
    }
  }

  private bindAnimations(): void {
    const host = document.querySelector('.services-wrapper') as HTMLElement | null;
    if (host) this.forceInitialHidden(host);

    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}
    const EASE = 'power3.out';

    const rmPrehide = (els: Element | Element[]) => {
      (Array.isArray(els) ? els : [els]).forEach(el => el.classList.remove('prehide','prehide-row'));
    };
    const show = (el?: Element | null) => {
      if (!el) return;
      rmPrehide(el);
      gsap.set(el, { visibility: 'visible' });
    };

    // Assure que Contextes est bien caché pendant le hero au premier passage
    if (!this.heroPlayed) this.hideContextsSectionOnce();

    /* ---------- HERO : H1 -> H3 -> Sub ---------- */
    const h1     = this.heroTitle?.nativeElement;
    const tTitle = this.ctxTitleRef?.nativeElement;
    const tSub   = this.ctxSubRef?.nativeElement;

    gsap.killTweensOf([h1, tTitle, tSub].filter(Boolean) as HTMLElement[]);

    if (!this.heroPlayed && h1) {
      this.animLock = true; // garde-fou
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
