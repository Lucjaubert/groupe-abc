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
import { ImgFromPipe } from '../../pipes/img-from.pipe';
import { ImgFastDirective } from '../../directives/img-fast.directive';

/* ===== Types (résolution d’IDs → URLs en TS) ===== */
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

  /* ===== Init ===== */
  ngOnInit(): void {
    this.wp.getMethodsData().subscribe(async (payload: any) => {
      const root = Array.isArray(payload) ? payload[0] : payload;
      const acf  = root?.acf ?? {};

      /* ---------- HERO ---------- */
      this.hero = {
        title   : acf?.hero?.section_title || 'Biens & Méthodes',
        subtitle: acf?.hero?.section_subtitle || '',
        html    : this.safe(acf?.hero?.intro_body || '')
      };

      /* ---------- DOMAINES (résolution icons) ---------- */
      const ad = acf?.asset_domains ?? {};
      const list: any[] = [ad?.domain_1, ad?.domain_2, ad?.domain_3].filter(Boolean);

      this.domains = await Promise.all(
        list.map(async (d: any) => {
          const items: DomainItem[] = [];
          for (let i = 1; i <= 4; i++) {
            const v = d?.[`item_${i}`];
            if (typeof v === 'string' && v.trim()) items.push({ kind: 'text', text: v.trim() });
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

          return {
            title  : d?.title || '',
            icon   : iconToken,
            iconUrl,
            items
          } as Domain;
        })
      );

      /* ---------- VALEURS (wheel) ---------- */
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

      /* ---------- MÉTHODES (résolution icons) ---------- */
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
              icon   : m?.icon ?? '',
              iconUrl,
              title  : m?.title || '',
              html   : this.safe(m?.description || '')
            } as EvalMethod;
          })
      );
      this.evalOpen = new Array(this.methods.length).fill(false);

      /* ---------- PILOTAGE (résolution flows) ---------- */
      const pil = acf?.mission_piloting ?? {};
      this.pilotingTitle = pil?.section_title || 'Pilotage des missions';

      const flowsSrcs: Array<{ src: string | number; caption?: string }> = [];
      if (pil?.flow_1) flowsSrcs.push({ src: pil.flow_1 });
      if (pil?.flow_2) flowsSrcs.push({ src: pil.flow_2 });

      const flowsWithUrl = await Promise.all(
        flowsSrcs.map(async f => ({ ...f, url: (await this.resolveMedia(f.src)) || this.defaultPilotImg }))
      );

      this.piloting = {
        html : this.safe(pil?.intro_body || ''),
        flows: flowsWithUrl
      };

      /* ---------- SEO (inchangé dans l’esprit) ---------- */
      const isEN       = this.currentPath().startsWith('/en/');
      const siteUrl    = 'https://groupe-abc.fr';
      const pathFR     = '/biens-et-methodes';
      const pathEN     = '/en/assets-methods';
      const canonical  = isEN ? pathEN : pathFR;

      const alternates = [
        { lang: 'fr',        href: `${siteUrl}${pathFR}` },
        { lang: 'en',        href: `${siteUrl}${pathEN}` },
        { lang: 'x-default', href: `${siteUrl}${pathFR}` }
      ];

      const introForDesc = (acf?.hero?.intro_body || '').toString();
      const baseDesc = this.strip(introForDesc, 160);
      const extraFR  = ' Biens résidentiels, commerciaux, tertiaires, industriels, hôtellerie, santé, charges foncières et terrains.';
      const extraEN  = ' Residential, commercial, office, industrial, hospitality, healthcare, land & development charges.';
      const desc = (isEN ? baseDesc + extraEN : baseDesc + extraFR).trim();

      const titleFR = `${this.hero.title || 'Biens & Méthodes'} – Groupe ABC`;
      const titleEN = `${(this.hero.title || 'Assets & Methods').replace('Biens & Méthodes','Assets & Methods')} – Groupe ABC`;
      const pageTitle = isEN ? titleEN : titleFR;

      const ogCandidate = (typeof this.wheel.imageUrl === 'string' && this.wheel.imageUrl.trim())
        ? this.wheel.imageUrl as string
        : '/assets/og/og-default.jpg';
      const ogAbs       = this.absUrl(ogCandidate, siteUrl);
      const ogIsDefault = ogAbs.endsWith('/assets/og/og-default.jpg');

      const logoUrl = `${siteUrl}/assets/favicons/android-chrome-512x512.png`;

      this.seo.update({
        title: pageTitle,
        description: desc,
        keywords: isEN
          ? 'valuation methods, DCF, market comparison, yield, real estate assets, France, Paris, DOM-TOM'
          : 'méthodes d’évaluation, DCF, comparaison, rendement, biens immobiliers, France, Paris, DOM-TOM',
        canonical,
        robots: 'index,follow',
        locale: isEN ? 'en_US' : 'fr_FR',
        image: ogAbs,
        imageAlt: isEN ? 'Valuation methods – Groupe ABC' : 'Méthodes d’évaluation – Groupe ABC',
        ...(ogIsDefault ? { imageWidth: 1200, imageHeight: 630 } : {}),
        type: 'website',
        alternates,
        jsonLd: {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebSite',
              '@id': `${siteUrl}/#website`,
              url: siteUrl,
              name: 'Groupe ABC',
              inLanguage: isEN ? 'en-US' : 'fr-FR',
              publisher: { '@id': `${siteUrl}/#organization` },
              potentialAction: {
                '@type': 'SearchAction',
                target: `${siteUrl}/?s={search_term_string}`,
                'query-input': 'required name=search_term_string'
              }
            },
            {
              '@type': 'Organization',
              '@id': `${siteUrl}/#organization`,
              name: 'Groupe ABC',
              url: siteUrl,
              logo: { '@type': 'ImageObject', url: logoUrl, width: 512, height: 512 },
              sameAs: ['https://www.linkedin.com/company/groupe-abc']
            },
            {
              '@type': 'WebPage',
              '@id': `${siteUrl}${canonical}#webpage`,
              url: `${siteUrl}${canonical}`,
              name: pageTitle,
              description: desc,
              inLanguage: isEN ? 'en-US' : 'fr-FR',
              isPartOf: { '@id': `${siteUrl}/#website` },
              primaryImageOfPage: { '@type': 'ImageObject', url: ogAbs }
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: isEN ? 'Home' : 'Accueil', item: siteUrl },
                { '@type': 'ListItem', position: 2, name: isEN ? 'Assets & Methods' : 'Biens & Méthodes', item: `${siteUrl}${canonical}` }
              ]
            }
          ]
        }
      });

      this.scheduleBind();
    });
  }

  /* ===== Accordéon ===== */
  toggleEval(i: number){ this.setSingleOpen(this.evalOpen, i); }
  private setSingleOpen(arr: boolean[], i: number){
    const willOpen = !arr[i]; arr.fill(false); if (willOpen) arr[i] = true;
  }

  /* ===== Img fallbacks (utiles si ImgFast est absent sur un img) ===== */
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

  /* === Helpers SEO === */
  private currentPath(): string {
    try { return window?.location?.pathname || '/'; } catch { return '/'; }
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

  /** Résout ID WP / objet / string → URL utilisable */
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
  ngAfterViewInit(): void {
    gsap.registerPlugin(ScrollTrigger);
    this.assetCols?.changes?.subscribe(() => this.scheduleBind());
    this.evalRows?.changes?.subscribe(() => this.scheduleBind());
    this.scheduleBind();
  }

  ngOnDestroy(): void {
    try { gsap.globalTimeline.clear(); } catch {}
  }

  private scheduleBind(){
    if (this.bindScheduled) return;
    this.bindScheduled = true;
    queueMicrotask(() => requestAnimationFrame(() => {
      this.bindScheduled = false;
      this.bindAnimations();
    }));
  }

  private forceInitialHidden(host: HTMLElement){
    const pre  = Array.from(host.querySelectorAll<HTMLElement>('.prehide'));
    const rows = Array.from(host.querySelectorAll<HTMLElement>('.prehide-row'));
    if (pre.length)  gsap.set(pre,  { autoAlpha: 0, y: 20 });
    if (rows.length) gsap.set(rows, { autoAlpha: 0 });
  }

  private bindAnimations(): void {
    const host = document.querySelector('.methods-wrapper') as HTMLElement | null;
    if (host) this.forceInitialHidden(host);

    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}

    const EASE = 'power3.out';
    const rmPrehide = (els: Element | Element[]) => {
      (Array.isArray(els) ? els : [els]).forEach(el => el.classList.remove('prehide','prehide-row'));
    };

    /* HERO */
    const h1 = this.heroTitleRef?.nativeElement;
    const h2 = this.heroSubRef?.nativeElement;
    const hi = this.heroIntroRef?.nativeElement;

    gsap.killTweensOf([h1, h2, hi].filter(Boolean) as HTMLElement[]);

    if (!this.heroBound) {
      const tl = gsap.timeline({ defaults: { ease: EASE } });

      if (h1) tl.fromTo(h1, { autoAlpha: 0, y: 20 }, {
        autoAlpha: 1, y: 0, duration: 0.6,
        onStart: () => { rmPrehide(h1); },
        onComplete: () => { gsap.set(h1, { clearProps: 'all' }); }
      }, 0);

      if (h2) tl.fromTo(h2, { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1, y: 0, duration: 0.5, delay: 0.08,
        onStart: () => { rmPrehide(h2); },
        onComplete: () => { gsap.set(h2, { clearProps: 'all' }); }
      }, 0);

      if (hi) tl.fromTo(hi, { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1, y: 0, duration: 0.5, delay: 0.14,
        onStart: () => { rmPrehide(hi); },
        onComplete: () => { gsap.set(hi, { clearProps: 'all' }); }
      }, 0);

      this.heroBound = true;
    } else {
      [h1, h2, hi].forEach(el => {
        if (!el) return;
        rmPrehide(el);
        gsap.set(el, { autoAlpha: 1, y: 0, clearProps: 'transform,opacity,visibility' });
      });
    }

    /* DOMAINES */
    const assetsList = this.assetsListRef?.nativeElement;
    const cols = (this.assetCols?.toArray() || []).map(r => r.nativeElement);

    if (assetsList && cols.length) {
      // Ne préparer (set à 0) qu’une seule fois pour éviter le flash
      let heads: (HTMLElement | null)[] = [];
      let lists: HTMLElement[][] = [];

      if (!this.assetsBound) {
        heads = cols.map(c => c.querySelector<HTMLElement>('.asset-head'));
        lists = cols.map(c => Array.from(c.querySelectorAll<HTMLElement>('.panel-list > li')));

        const headsOk = heads.filter(Boolean) as HTMLElement[];
        if (headsOk.length) gsap.set(headsOk, { autoAlpha: 0, y: 14 });
        lists.forEach(arr => arr.length && gsap.set(arr, { autoAlpha: 0, y: 10 }));
      }

      // Si l’anim est déjà liée et jouée, on ne rebâtit rien (évite tout flicker)
      if (!this.assetsBound) {
        const tl = gsap.timeline({
          defaults: { ease: EASE },
          scrollTrigger: {
            id: 'assets-grid',
            trigger: assetsList,
            start: 'top 85%',
            once: true
          },
          onStart: () => {
            // On enlève prehide au moment où ça va jouer (pas avant)
            rmPrehide([assetsList, ...cols]);
          },
          onComplete: () => {
            this.assetsBound = true;
            // Libère les styles inline une fois visible, pour ne plus rien toucher ensuite
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

        // IMPORTANT: immediateRender:false pour empêcher l’application immédiate du "from" (le hide)
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
            tl.to(its, { autoAlpha: 1, y: 0, duration: 0.40, stagger: 0.04 }, at + 0.06);
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
          autoAlpha: 1, y: 0, duration: 0.52, ease: EASE,
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
          autoAlpha: 1, scale: 1, duration: 0.52, ease: 'power2.out',
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
          autoAlpha: 1, y: 0, duration: 0.52, ease: EASE,
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
