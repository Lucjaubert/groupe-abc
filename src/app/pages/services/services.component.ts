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
import { ImgFromPipe } from '../../pipes/img-from.pipe';

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
  trackByIndex(i: number){ return i; }

  /* ===================== Chargement data ===================== */
  ngOnInit(): void {
    this.wp.getServicesData().subscribe((payload: any) => {
      const root = Array.isArray(payload) ? payload[0] : payload;
      const acf  = root?.acf ?? {};

      /* ---------- HERO & CONTEXT INTRO ---------- */
      this.pageTitle = acf?.hero?.section_title || 'Nos services';
      const heroCtx  = acf?.hero?.contexts ?? {};
      this.ctxIntro = {
        title: heroCtx?.section_title || 'Contextes d’interventions',
        html : this.safe(heroCtx?.section_presentation || '')
      };

      // Animations non bloquantes
      this.scheduleBind();

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
      this.hydrateContextIcons();

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

      /* ---------- SEO ---------- */
      this.applySeo(String(heroCtx?.section_presentation || ''));

      /* ---------- Chevrons : aligner la taille ---------- */
      this.resizeDeon();
    });
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

  private hydrateContextIcons(): void {
    this.contexts.forEach(async (it, idx) => {
      const url = await this.resolveMedia(it.icon);
      if (url) this.contexts[idx] = { ...this.contexts[idx], iconUrl: url };
    });
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

  /* ===================== SEO ===================== */
  private applySeo(rawIntro: string): void {
    const path = this.currentPath();
    const isEN = path.startsWith('/en/');
    const site = 'https://groupe-abc.fr';
    const pathFR = '/services';
    const pathEN = '/en/services';
    const canonPath = isEN ? pathEN : pathFR;

    const alternates = [
      { lang: 'fr',        href: this.normalizeUrl(site, pathFR) },
      { lang: 'en',        href: this.normalizeUrl(site, pathEN) },
      { lang: 'x-default', href: this.normalizeUrl(site, pathFR) }
    ];

    const orgName = 'Groupe ABC';
    const introText = this.strip(rawIntro, 120);
    const orgBlurbFR = `Le Groupe ABC est un groupement d’Experts immobiliers indépendants présent à Paris, en Régions et DOM-TOM (6 cabinets, 20+ collaborateurs), intervenant en amiable et judiciaire pour biens résidentiels, commerciaux, tertiaires, industriels, hôtellerie, loisirs, santé, charges foncières et terrains. Membres RICS, IFEI, CNEJI.`;
    const orgBlurbEN = `Groupe ABC is a network of independent real-estate valuation experts across Paris, Regions and Overseas (6 firms, 20+ staff), acting in amicable and judicial contexts for residential, commercial, office, industrial, hospitality, leisure & healthcare assets, land and development rights. Members of RICS, IFEI, CNEJI.`;

    const title = isEN ? `Our services – ${orgName}` : `Nos services – ${orgName}`;
    const description = this.strip((introText ? `${introText} ` : '') + (isEN ? orgBlurbEN : orgBlurbFR), 160);

    const ogImage = '/assets/og/og-default.jpg';
    const ogAbs = this.absUrl(ogImage, site);
    const isDefaultOg = ogImage.endsWith('/og-default.jpg');

    this.seo.update({
      title,
      description,
      canonical: canonPath,
      image: ogAbs,
      imageAlt: isEN ? `${orgName} – Our services` : `${orgName} – Nos services`,
      ...(isDefaultOg ? { imageWidth: 1200, imageHeight: 630 } : {}),
      type: 'website',
      locale: isEN ? 'en_US' : 'fr_FR',
      alternates,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', '@id': `${site}/#website`, url: site, name: 'Groupe ABC', inLanguage: isEN ? 'en-US' : 'fr-FR', publisher: { '@id': `${site}/#organization` } },
          { '@type': 'Organization', '@id': `${site}/#organization`, name: 'Groupe ABC', url: site, logo: `${site}/assets/favicons/android-chrome-512x512.png` },
          { '@type': 'WebPage', url: this.normalizeUrl(site, canonPath), name: title, description, inLanguage: isEN ? 'en-US' : 'fr-FR', isPartOf: { '@id': `${site}/#website` }, primaryImageOfPage: ogAbs },
          { '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: isEN ? 'Home' : 'Accueil', item: site },
            { '@type': 'ListItem', position: 2, name: isEN ? 'Services' : 'Services', item: this.normalizeUrl(site, canonPath) }
          ]}
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
  private currentPath(): string {
    try { return window?.location?.pathname || '/'; } catch { return '/'; }
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

  ngOnDestroy(): void {
    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}
    try { gsap.globalTimeline.clear(); } catch {}
  }

  private scheduleBind(){
    if (this.bindScheduled) return;

    // Si verrou actif, replanifie proprement à la prochaine frame
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
        this.isReady = true
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
        }
      );
    }

    if (ctxRowEls.length) {
      gsap.set(ctxRowEls, { autoAlpha: 0, y: 8 });
      tl.to(ctxRowEls, {
        autoAlpha: 1, y: 0, duration: 0.28, stagger: 0.05,
        onComplete: () => { gsap.set(ctxRowEls, { clearProps: 'transform,opacity' }); }
      }, '>-0.08');
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
