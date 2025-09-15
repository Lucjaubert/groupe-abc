import {
  Component, OnInit, AfterViewInit, OnDestroy,
  inject, ElementRef, ViewChild, ViewChildren, QueryList
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

type ContextIntro = { title: string; html: SafeHtml | string };
type ContextItem  = { icon?: string; title: string; html?: SafeHtml | string };
type ClientItem   = { title: string; html?: SafeHtml | string };

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.scss']
})
export class ServicesComponent implements OnInit, AfterViewInit, OnDestroy {
  private wp  = inject(WordpressService);
  private seo = inject(SeoService);
  private sanitizer = inject(DomSanitizer);

  /* Champs */
  pageTitle = 'Nos services';

  ctxIntro: ContextIntro = { title: '', html: '' };
  contexts: ContextItem[] = [];
  ctxOpen: boolean[] = [];

  clientsTitle = '';
  clients: ClientItem[] = [];
  cliOpen: boolean[] = [];

  refsTitle = 'Ils nous font confiance';
  references: string[] = [];

  /* Icônes / fallbacks */
  defaultCtxIcon = 'assets/fallbacks/icon-placeholder.svg';
  defaultRefLogo = 'assets/fallbacks/logo-placeholder.svg';

  /* ===== Refs pour animations ===== */
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

  /* ===== Guards pour éviter les doubles animations ===== */
  private heroPlayed = false;

  ngOnInit(): void {
    this.wp.getServicesData().subscribe((payload: any) => {
      const root = Array.isArray(payload) ? payload[0] : payload;
      const acf  = root?.acf ?? {};

      /* ===== HERO ===== */
      this.pageTitle = acf?.hero?.section_title || 'Nos services';
      const heroCtx  = acf?.hero?.contexts ?? {};
      this.ctxIntro = {
        title: heroCtx?.section_title || 'Contextes d’interventions',
        html : this.safe(heroCtx?.section_presentation || '')
      };

      /* ===== CONTEXTES ===== */
      const ctxObj = acf?.contexts ?? {};
      this.contexts = Object.values(ctxObj)
        .filter((it: any) => it && (it.title || it.description || it.icon))
        .map((it: any) => ({
          icon : it.icon || '',
          title: it.title || '',
          html : this.safe(it.description || '')
        }));
      this.ctxOpen = new Array(this.contexts.length).fill(false);

      /* ===== CLIENTS ===== */
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

      /* ===== RÉFÉRENCES ===== */
      const refs = acf?.references ?? {};
      this.refsTitle = refs?.section_title || 'Ils nous font confiance';
      const logos = Object.entries(refs)
        .filter(([k, v]) => /^logo_/i.test(k) && v)
        .map(([, v]) => String(v));
      this.references = this.shuffleArray(logos);

      /* ===== SEO bilingue ===== */
      this.applySeo(String(heroCtx?.section_presentation || ''));

      // Lier/relier les animations après rendu
      this.scheduleBind();
    });
  }

  /* ===== Accordéons : un seul ouvert ===== */
  toggleCtx(i: number){ this.setSingleOpen(this.ctxOpen, i); }
  toggleCli(i: number){ this.setSingleOpen(this.cliOpen, i); }
  private setSingleOpen(arr: boolean[], i: number){
    const willOpen = !arr[i];
    arr.fill(false);
    if (willOpen) arr[i] = true;
  }

  /* ===== Img fallbacks ===== */
  onImgError(evt: Event){ const img = evt.target as HTMLImageElement; if (img) img.src = this.defaultCtxIcon; }
  onRefImgError(evt: Event){ const img = evt.target as HTMLImageElement; if (img) img.src = this.defaultRefLogo; }

  /* ===== Utils ===== */
  trackByIndex(i: number){ return i; }
  private safe(html: string): SafeHtml { return this.sanitizer.bypassSecurityTrustHtml(html || ''); }
  private strip(html: string, max = 160): string {
    const t = (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }
  private shuffleArray<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ===================== SEO ===================== */
  private applySeo(rawIntro: string): void {
    // Détection langue par path
    const path = this.currentPath();
    const isEN = path.startsWith('/en/');

    // Domain + chemins
    const site = 'https://groupe-abc.fr';
    const pathFR = '/services';
    const pathEN = '/en/services';
    const canonPath = isEN ? pathEN : pathFR;
    const canonical = this.normalizeUrl(site, canonPath);

    // hreflang alternates
    const alternates = [
      { lang: 'fr',        href: this.normalizeUrl(site, pathFR) },
      { lang: 'en',        href: this.normalizeUrl(site, pathEN) },
      { lang: 'x-default', href: this.normalizeUrl(site, pathFR) }
    ];

    // Titre / description localisés (+ texte institutionnel condensé)
    const orgName = 'Groupe ABC';

    const introText = this.strip(rawIntro, 120); // on garde un peu de place pour la suite
    const orgBlurbFR = `Le Groupe ABC est un groupement d’Experts immobiliers indépendants présent à Paris, en Régions et DOM-TOM (6 cabinets, 20+ collaborateurs), intervenant en amiable et judiciaire pour biens résidentiels, commerciaux, tertiaires, industriels, hôtellerie, loisirs, santé, charges foncières et terrains. Membres RICS, IFEI, CNEJI.`;
    const orgBlurbEN = `Groupe ABC is a network of independent real-estate valuation experts across Paris, Regions and Overseas (6 firms, 20+ staff), acting in amicable and judicial contexts for residential, commercial, office, industrial, hospitality, leisure & healthcare assets, land and development rights. Members of RICS, IFEI, CNEJI.`;

    const title = isEN ? `Our services – ${orgName}` : `Nos services – ${orgName}`;
    const description = this.strip(
      (introText ? `${introText} ` : '') + (isEN ? orgBlurbEN : orgBlurbFR),
      160
    );

    // Open Graph
    const ogImage = '/assets/og/og-default.jpg';
    const ogAbs = this.absUrl(ogImage, site);
    const isDefaultOg = ogImage.endsWith('/og-default.jpg');

    // JSON-LD IDs
    const siteId = site.replace(/\/+$/, '') + '#website';
    const orgId  = site.replace(/\/+$/, '') + '#organization';

    // JSON-LD graph (localisé)
    const organization = {
      '@type': 'Organization',
      '@id': orgId,
      name: orgName,
      url: site,
      logo: `${site}/assets/favicons/android-chrome-512x512.png`, // adapte si besoin
      sameAs: ['https://www.linkedin.com/company/groupe-abc-experts/']
    };

    const website = {
      '@type': 'WebSite',
      '@id': siteId,
      url: site,
      name: orgName,
      inLanguage: isEN ? 'en-US' : 'fr-FR',
      publisher: { '@id': orgId },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${site}/?s={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    };

    const collectionPage = {
      '@type': 'CollectionPage',
      name: title,
      description,
      url: canonical,
      inLanguage: isEN ? 'en-US' : 'fr-FR',
      isPartOf: { '@id': siteId },
      about: { '@id': orgId },
      primaryImageOfPage: ogAbs
    };

    const breadcrumb = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: isEN ? 'Home' : 'Accueil',  item: site },
        { '@type': 'ListItem', position: 2, name: isEN ? 'Services' : 'Services', item: canonical }
      ]
    };

    this.seo.update({
      title,
      description,
      canonical: canonPath, // ton SeoService absolutise avec l’origin courant
      image: ogAbs,
      imageAlt: isEN ? `${orgName} – Our services` : `${orgName} – Nos services`,
      ...(isDefaultOg ? { imageWidth: 1200, imageHeight: 630 } : {}),
      type: 'website',
      locale: isEN ? 'en_US' : 'fr_FR',
      alternates,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [website, organization, collectionPage, breadcrumb]
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
  private currentPath(): string {
    try { return window?.location?.pathname || '/'; } catch { return '/'; }
  }

  /* ================= Animations ================= */
  ngAfterViewInit(): void {
    gsap.registerPlugin(ScrollTrigger);
    this.ctxRows?.changes?.subscribe(() => this.scheduleBind());
    this.cliRows?.changes?.subscribe(() => this.scheduleBind());
    this.refLogos?.changes?.subscribe(() => this.scheduleBind());
    this.scheduleBind();
  }

  ngOnDestroy(): void {
    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}
    try { gsap.globalTimeline.clear(); } catch {}
  }

  private bindScheduled = false;
  private scheduleBind(){
    if (this.bindScheduled) return;
    this.bindScheduled = true;
    queueMicrotask(() =>
      requestAnimationFrame(() => {
        this.bindScheduled = false;
        this.bindAnimations();
      })
    );
  }

  /** Force l’état initial comme sur About (évite le flash si la CSS charge tard) */
  private forceInitialHidden(root: HTMLElement){
    const pre = Array.from(root.querySelectorAll<HTMLElement>('.prehide'));
    const rows = Array.from(root.querySelectorAll<HTMLElement>('.prehide-row'));
    if (pre.length)  gsap.set(pre,  { autoAlpha: 0, y: 20 });
    if (rows.length) gsap.set(rows, { autoAlpha: 0 });
  }

  private bindAnimations(): void {
    const host = document.querySelector('.services-wrapper') as HTMLElement | null;
    if (host) this.forceInitialHidden(host);

    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}
    const EASE = 'power3.out';

    const rmPrehide = (els: Element | Element[]) => {
      const list = Array.isArray(els) ? els : [els];
      list.forEach(el => el.classList.remove('prehide', 'prehide-row'));
    };

    /* ---------- HERO (joué une seule fois) ---------- */
    if (this.heroTitle?.nativeElement && !this.heroPlayed) {
      const el = this.heroTitle.nativeElement;
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 20 },
        {
          autoAlpha: 1, y: 0, duration: 0.6, ease: EASE,
          onStart: () => { rmPrehide(el); },
          onComplete: () => { gsap.set(el, { clearProps: 'all' }); this.heroPlayed = true; }
        }
      );
    }

    /* ---------- CONTEXTES ---------- */
    const ctxTitleEl = this.ctxTitleRef?.nativeElement;
    const ctxSubEl   = this.ctxSubRef?.nativeElement;
    const ctxListEl  = this.ctxListRef?.nativeElement;
    const ctxRowEls  = (this.ctxRows?.toArray() || []).map(r => r.nativeElement);

    if (ctxTitleEl) {
      gsap.fromTo(ctxTitleEl, { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1, y: 0, duration: 0.52, ease: EASE,
        scrollTrigger: { trigger: ctxTitleEl, start: 'top 85%', once: true },
        onStart: () => { rmPrehide(ctxTitleEl); },
        onComplete: () => { gsap.set(ctxTitleEl, { clearProps: 'all' }); }
      });
    }
    if (ctxSubEl) {
      gsap.fromTo(ctxSubEl, { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1, y: 0, duration: 0.52, ease: EASE,
        scrollTrigger: { trigger: ctxSubEl, start: 'top 85%', once: true },
        onStart: () => { rmPrehide(ctxSubEl); },
        onComplete: () => { gsap.set(ctxSubEl, { clearProps: 'all' }); }
      });
    }
    if (ctxListEl && ctxRowEls.length) {
      gsap.fromTo(
        ctxListEl,
        { autoAlpha: 0, y: 12 },
        {
          autoAlpha: 1, y: 0, duration: 0.48, ease: EASE,
          scrollTrigger: { trigger: ctxListEl, start: 'top 85%', once: true },
          onStart: () => { rmPrehide([ctxListEl, ...ctxRowEls]); },
          onComplete: () => { gsap.set(ctxListEl, { clearProps: 'all' }); }
        }
      );
    }

    /* ---------- CLIENTS ---------- */
    const cliTitleEl = this.clientsTitleRef?.nativeElement;
    const cliListEl  = this.cliListRef?.nativeElement;
    const cliRowEls  = (this.cliRows?.toArray() || []).map(r => r.nativeElement);

    if (cliTitleEl) {
      gsap.fromTo(cliTitleEl, { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1, y: 0, duration: 0.52, ease: EASE,
        scrollTrigger: { trigger: cliTitleEl, start: 'top 85%', once: true },
        onStart: () => { rmPrehide(cliTitleEl); },
        onComplete: () => { gsap.set(cliTitleEl, { clearProps: 'all' }); }
      });
    }
    if (cliListEl && cliRowEls.length) {
      gsap.fromTo(
        cliListEl,
        { autoAlpha: 0, y: 12 },
        {
          autoAlpha: 1, y: 0, duration: 0.46, ease: EASE,
          scrollTrigger: { trigger: cliListEl, start: 'top 85%', once: true },
          onStart: () => { rmPrehide([cliListEl, ...cliRowEls]); },
          onComplete: () => { gsap.set(cliListEl, { clearProps: 'all' }); }
        }
      );
    }

    /* ---------- RÉFÉRENCES ---------- */
    const refsTitleEl = this.refsTitleRef?.nativeElement;
    const refsGridEl  = this.refsGridRef?.nativeElement;
    const logoEls     = (this.refLogos?.toArray() || []).map(r => r.nativeElement);

    if (refsTitleEl) {
      gsap.fromTo(refsTitleEl, { autoAlpha: 0, y: 16 }, {
        autoAlpha: 1, y: 0, duration: 0.5, ease: EASE,
        scrollTrigger: { trigger: refsTitleEl, start: 'top 85%', once: true },
        onStart: () => { rmPrehide(refsTitleEl); },
        onComplete: () => { gsap.set(refsTitleEl, { clearProps: 'all' }); }
      });
    }

    if (refsGridEl && logoEls.length) {
      const tl = gsap.timeline({
        defaults: { ease: EASE },
        scrollTrigger: { trigger: refsGridEl, start: 'top 88%', once: true }
      });

      tl.to(refsGridEl, {
        autoAlpha: 1, duration: 0.2,
        onStart: () => { rmPrehide(refsGridEl); }
      });

      tl.fromTo(
        logoEls,
        { autoAlpha: 0, y: 12, scale: 0.985 },
        {
          autoAlpha: 1, y: 0, scale: 1,
          duration: 0.42,
          ease: 'power2.out',
          stagger: 0.12,
          onStart: () => { rmPrehide(logoEls); },
          onComplete: () => { gsap.set([refsGridEl, ...logoEls], { clearProps: 'all' }); }
        },
        '-=0.05'
      );
    }

    try { ScrollTrigger.refresh(); } catch {}
  }
}
