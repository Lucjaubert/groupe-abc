// src/app/pages/contact/contact.component.ts
import { CommonModule } from '@angular/common';
import {
  Component, Input, OnInit, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, ViewChildren, QueryList, inject,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SeoService } from '../../services/seo.service';
import { ContactService } from '../../services/contact.service';
import { WordpressService } from '../../services/wordpress.service';
import { firstValueFrom } from 'rxjs';

type SendState = 'idle' | 'loading' | 'success' | 'error';

type PresentationDl = {
  text1: string;
  text2: string;
  file: string | null;
};

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() siteUrl         = 'https://groupe-abc.fr';
  @Input() canonicalPath   = '/contact';
  @Input() canonicalPathEn = '/en/contact';
  @Input() orgName         = 'Groupe ABC';

  @Input() streetAddress   = '18 rue Pasquier';
  @Input() postalCode      = '75008';
  @Input() addressLocality = 'Paris';
  @Input() phoneIntl       = '+33178414441';
  @Input() phoneDisplay    = '01 78 41 44 41';
  @Input() email           = 'contact@groupe-abc.fr';
  @Input() linkedinUrl     = 'https://www.linkedin.com/company/groupe-abc-experts/';
  @Input() socialImage     = '/assets/og/og-default.jpg';

  @Input() acf?: any;

  presentation: PresentationDl = {
    text1: 'Télécharger la présentation du',
    text2: 'Groupe ABC',
    file: null
  };

  dlL1 = 'Télécharger la';
  dlL2 = 'présentation du';

  get hasFile(): boolean {
    const f = this.presentation?.file;
    return !!(f && typeof f === 'string' && f.trim().length > 0);
  }

  private seo = inject(SeoService);
  private wp  = inject(WordpressService);

  @ViewChild('contactTitle')    contactTitle!: ElementRef<HTMLElement>;
  @ViewChild('contactLinkedin') contactLinkedin?: ElementRef<HTMLElement>;

  @ViewChild('radiosEl')  radiosEl!: ElementRef<HTMLElement>;
  @ViewChildren('radioItem') radioItems!: QueryList<ElementRef<HTMLElement>>;

  @ViewChild('formGridEl') formGridEl!: ElementRef<HTMLElement>;
  @ViewChildren('fgLabel')  fgLabels!: QueryList<ElementRef<HTMLElement>>;

  @ViewChild('sendBtn') sendBtn!: ElementRef<HTMLElement>;

  @ViewChild('bigInfosEl') bigInfosEl!: ElementRef<HTMLElement>;
  @ViewChildren('bigLine')  bigLines!: QueryList<ElementRef<HTMLElement>>;

  private bindScheduled = false;
  private heroPlayed = false;

  sendState: SendState = 'idle';
  messageError = '';

  constructor(
    private cdr: ChangeDetectorRef,
    private contact: ContactService,
  ) {}

  ngOnInit(): void {
    if (this.acf?.presentation_download_section) {
      console.log('[INIT] ACF fourni à ContactComponent (depuis Homepage).');
      this.hydratePresentationFrom(this.acf.presentation_download_section);
    } else {
      console.log('[INIT] ACF non fourni → fetch via WordpressService.getHomepageData()');
      this.wp.getHomepageData().subscribe({
        next: (acf) => {
          if (acf?.presentation_download_section) {
            this.hydratePresentationFrom(acf.presentation_download_section);
            this.cdr.markForCheck();
          } else {
            console.warn('[INIT] Pas de presentation_download_section dans les données homepage.');
          }
        },
        error: (e) => { console.error('[INIT] getHomepageData() error', e); }
      });
    }

    this.applySplitForText1(this.presentation.text1);
    this.applySeo();
  }

  ngAfterViewInit(): void {
    gsap.registerPlugin(ScrollTrigger);
    this.radioItems?.changes?.subscribe(() => this.scheduleBind());
    this.fgLabels?.changes?.subscribe(() => this.scheduleBind());
    this.bigLines?.changes?.subscribe(() => this.scheduleBind());
    this.scheduleBind();
  }

  ngOnDestroy(): void {
    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}
    try { gsap.globalTimeline.clear(); } catch {}
  }

  /* ===== Hydratation plaquette ===== */
  private async hydratePresentationFrom(dl: any) {
    const t1 = dl?.presentation_button_text_1 || 'Télécharger la présentation du';
    const t2 = dl?.presentation_button_text_2 || 'Groupe ABC';
    const raw = dl?.presentation_file;
    console.log('[DL] ACF raw file =', raw);

    const resolved = await this.resolveMedia(raw);
    const abs = this.absUrl(resolved || '', this.siteUrl);
    console.log('[DL] resolved =', resolved, '| abs =', abs);

    this.presentation = { text1: t1, text2: t2, file: abs || null };
    this.applySplitForText1(this.presentation.text1);
    if (this.presentation.file) this.preload(this.presentation.file);
    this.cdr.markForCheck();
  }

  private async resolveMedia(idOrUrl: any): Promise<string> {
    if (!idOrUrl) return '';

    if (typeof idOrUrl === 'object') {
      const src = idOrUrl?.source_url || idOrUrl?.url || '';
      if (src) return src;
      if (idOrUrl?.id != null) idOrUrl = idOrUrl.id;
    }

    if (typeof idOrUrl === 'number') {
      try { return (await firstValueFrom(this.wp.getMediaUrl(idOrUrl))) || ''; }
      catch { return ''; }
    }

    if (typeof idOrUrl === 'string') {
      const s = idOrUrl.trim();
      if (/^\d+$/.test(s)) {
        try { return (await firstValueFrom(this.wp.getMediaUrl(+s))) || ''; }
        catch { return ''; }
      }
      if (/^(https?:)?\/\//.test(s) || s.startsWith('/') || s.startsWith('data:')) return s;
      return s;
    }

    return '';
  }

  private preload(src: string): Promise<void> {
    if (!src) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = src;
    });
  }

  private applySplitForText1(t: string) {
    const words = (t || '').trim().replace(/\s+/g, ' ').split(' ');
    if (words.length >= 3) {
      this.dlL1 = words.slice(0, 2).join(' ');
      this.dlL2 = words.slice(2).join(' ');
    } else {
      this.dlL1 = 'Télécharger la';
      this.dlL2 = 'présentation du';
    }
  }

  /* ===== SEO ===== */
  private applySeo(): void {
    const nowPath = this.currentPath();
    const isEN    = nowPath.startsWith('/en/');
    const canonPath = isEN ? this.canonicalPathEn : this.canonicalPath;
    const canonical = this.normalizeUrl(this.siteUrl, canonPath);

    const lang      = isEN ? 'en'    : 'fr';
    const locale    = isEN ? 'en_US' : 'fr_FR';
    const localeAlt = isEN ? ['fr_FR'] : ['en_US'];

    const altFR = this.normalizeUrl(this.siteUrl, this.canonicalPath);
    const altEN = this.normalizeUrl(this.siteUrl, this.canonicalPathEn);
    const alternates = [
      { lang: 'fr',        href: altFR },
      { lang: 'en',        href: altEN },
      { lang: 'x-default', href: altFR }
    ];

    const title = isEN
      ? `Contact – ${this.orgName} | Real estate valuation`
      : `Contact – ${this.orgName} | Expertise immobilière`;

    const descFR =
      `Groupe d’Experts immobiliers (6 cabinets, 20+ collab.) – tous types d’actifs ` +
      `(résidentiel, commercial, tertiaire, industriel, hôtellerie, loisirs, santé, foncier/terrains) – ` +
      `amiable & judiciaire. ${this.streetAddress}, ${this.postalCode} ${this.addressLocality}.`;
    const descEN =
      `Independent valuation group (6 firms, 20+ staff) – all asset classes ` +
      `(residential, commercial, office, industrial, hospitality, leisure, healthcare, land) – ` +
      `amicable & judicial. ${this.streetAddress}, ${this.postalCode} ${this.addressLocality}.`;

    const description = (isEN ? descEN : descFR).slice(0, 300);

    const kwFR = [
      'contact', 'expertise immobilière', 'évaluation immobilière', 'Paris', 'DOM-TOM',
      'résidentiel','commercial','tertiaire','industriel','hôtellerie','loisirs','santé',
      'foncier','terrains','DCF','comparaison','rendement','expert judiciaire','RICS','IFEI','CNEJI'
    ].join(', ');
    const kwEN = [
      'contact', 'real estate valuation','property appraisal','Paris','French overseas',
      'residential','commercial','office','industrial','hospitality','leisure','healthcare',
      'land','DCF','market comparison','yield','expert witness','RICS','IFEI','CNEJI'
    ].join(', ');

    const og = this.socialImage || '/assets/og/og-default.jpg';
    const ogAbs = this.absUrl(og, this.siteUrl);
    const isDefaultOg = /\/og-default\.jpg$/.test(og);

    const siteId = this.siteUrl.replace(/\/+$/, '') + '#website';
    const orgId  = this.siteUrl.replace(/\/+$/, '') + '#organization';

    const organization = {
      '@type': 'Organization',
      '@id': orgId,
      name: this.orgName,
      url: this.siteUrl,
      sameAs: [ this.linkedinUrl ].filter(Boolean),
      address: {
        '@type': 'PostalAddress',
        streetAddress: this.streetAddress,
        postalCode: this.postalCode,
        addressLocality: this.addressLocality,
        addressCountry: 'FR'
      }
    };

    const contactPage = {
      '@type': 'ContactPage',
      '@id': canonical + '#webpage',
      name: `Contact – ${this.orgName}`,
      url: canonical,
      inLanguage: isEN ? 'en-US' : 'fr-FR',
      about: { '@id': orgId },
      isPartOf: { '@id': siteId },
      primaryImageOfPage: ogAbs
    };

    const breadcrumb = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: isEN ? 'Home' : 'Accueil', item: this.siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Contact', item: canonical }
      ]
    };

    this.seo.update({
      lang, locale, localeAlt,
      title,
      description,
      keywords: isEN ? kwEN : kwFR,
      canonical,
      robots: 'index,follow',
      image: ogAbs,
      imageAlt: `${this.orgName} – Contact`,
      ...(isDefaultOg ? { imageWidth: 1200, imageHeight: 630 } : {}),
      type: 'website',
      alternates,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            '@id': this.siteUrl.replace(/\/+$/, '') + '#website',
            url: this.siteUrl,
            name: this.orgName,
            inLanguage: isEN ? 'en-US' : 'fr-FR',
            potentialAction: {
              '@type': 'SearchAction',
              target: `${this.siteUrl}/?s={search_term_string}`,
              'query-input': 'required name=search_term_string'
            }
          },
          organization,
          contactPage,
          breadcrumb
        ]
      }
    });
  }

  /* ===== Utils ===== */
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

  private getBrowserOrigin(): string {
    try { return window.location.origin; } catch { return this.siteUrl; }
  }

  isSameOrigin(url: string): boolean {
    try {
      const u = new URL(url, this.siteUrl);
      const currentOrigin = this.getBrowserOrigin();
      return u.origin === currentOrigin;
    } catch { return false; }
  }

  safeDownloadName(url: string): string {
    try {
      const u = new URL(url, this.siteUrl);
      const base = u.pathname.split('/').pop() || 'plaquette.pdf';
      return decodeURIComponent(base);
    } catch { return 'plaquette.pdf'; }
  }

  /* ===== Clic Download (avec logs) ===== */
  onDlClick(ev: MouseEvent, url: string | null) {
    const a = ev.currentTarget as HTMLAnchorElement | null;

    console.log('[CLICK] start', {
      url,
      hasFile: this.hasFile,
      defaultPrevented: ev.defaultPrevented,
      anchorPresent: !!a
    });

    if (!url) {
      console.warn('[CLICK] Pas d’URL → rien à faire');
      return;
    }

    if (a) {
      console.log('[CLICK] anchor attrs', {
        href: a.getAttribute('href'),
        target: a.getAttribute('target'),
        rel: a.getAttribute('rel'),
        download: a.getAttribute('download'),
        // ⬇️ fix: pas de spread sur DOMTokenList
        classList: Array.from(a.classList)
      });
    }

    const same = this.isSameOrigin(url);
    console.log('[CLICK] isSameOrigin(url)?', same, '| browserOrigin =', window.location.origin);

    setTimeout(() => {
      try {
        console.log('[CLICK] fallback window.open()');
        const w = window.open(url, same ? '_self' : '_blank', same ? '' : 'noopener');
        console.log('[CLICK] window.open returned =', w);
      } catch (e) {
        console.error('[CLICK] window.open error', e);
      }
    }, 0);
  }

  downloadNameOrNull(url: string | null): string | null {
    if (!url) return null;
    try {
      const u = new URL(url, this.siteUrl);
      const currentOrigin = window.location.origin;
      if (u.origin !== currentOrigin) return null;
      const base = decodeURIComponent(u.pathname.split('/').pop() || 'plaquette.pdf');
      return base || 'plaquette.pdf';
    } catch {
      return null;
    }
  }

  /* ===== Animations ===== */
  private forceInitialHidden(host: HTMLElement){
    const pre  = Array.from(host.querySelectorAll<HTMLElement>('.prehide'));
    const rows = Array.from(host.querySelectorAll<HTMLElement>('.prehide-row'));
    if (pre.length)  gsap.set(pre,  { autoAlpha: 0, y: 20 });
    if (rows.length) gsap.set(rows, { autoAlpha: 0 });
  }

  private scheduleBind(){
    if (this.bindScheduled) return;
    this.bindScheduled = true;
    queueMicrotask(() => requestAnimationFrame(() => {
      this.bindScheduled = false;
      this.bindAnimations();
    }));
  }

  private bindAnimations(): void {
    const host = (document.querySelector('.contact-page') as HTMLElement) || document.body;
    this.forceInitialHidden(host);
    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}

    const EASE = 'power3.out';
    const rm = (els: Element | Element[]) =>
      (Array.isArray(els) ? els : [els]).forEach(el => el.classList.remove('prehide','prehide-row'));

    const title = this.contactTitle?.nativeElement;
    const li    = this.contactLinkedin?.nativeElement;

    if (title && !this.heroPlayed){
      gsap.fromTo(title, { autoAlpha: 0, y: 20 }, {
        autoAlpha: 1, y: 0, duration: .58, ease: EASE,
        onStart: () => { rm(title); },
        onComplete: () => { this.heroPlayed = true; gsap.set(title, { clearProps: 'all' }); }
      });
    }
    if (li){
      gsap.fromTo(li, { autoAlpha: 0, y: 16, scale: .96 }, {
        autoAlpha: 1, y: 0, scale: 1, duration: .5, ease: 'power2.out', delay: .06,
        onStart: () => { rm(li); },
        onComplete: () => { gsap.set(li, { clearProps: 'all' }); }
      });
    }

    {
      const radios = this.radiosEl?.nativeElement;
      const items  = (this.radioItems?.toArray() || []).map(r => r.nativeElement);
      if (radios && items.length){
        gsap.set(items, { autoAlpha: 0, y: 10 });
        gsap.timeline({
          defaults: { ease: EASE },
          scrollTrigger: { trigger: radios, start: 'top 85%', once: true },
          onStart: () => { rm([radios, ...items]); }
        })
        .to(items, { autoAlpha: 1, y: 0, duration: .4, stagger: .06 }, 0)
        .add(() => { gsap.set(items, { clearProps: 'transform,opacity' }); });
      }
    }

    {
      const grid   = this.formGridEl?.nativeElement;
      const labels = (this.fgLabels?.toArray() || []).map(r => r.nativeElement);
      if (grid && labels.length){
        gsap.set(labels, { autoAlpha: 0, y: 14 });
        gsap.timeline({
          defaults: { ease: EASE },
          scrollTrigger: { trigger: grid, start: 'top 85%', once: true },
          onStart: () => { rm([grid, ...labels]); }
        })
        .to(labels, { autoAlpha: 1, y: 0, duration: .45, stagger: .07 }, 0)
        .add(() => { gsap.set(labels, { clearProps: 'transform,opacity' }); });
      }
    }

    {
      const btn = this.sendBtn?.nativeElement;
      if (btn){
        gsap.fromTo(btn, { autoAlpha: 0, y: 12, scale: .98 }, {
          autoAlpha: 1, y: 0, scale: 1, duration: .44, ease: 'power2.out',
          scrollTrigger: { trigger: btn, start: 'top 92%', once: true },
          onStart: () => { rm(btn); },
          onComplete: () => { gsap.set(btn, { clearProps: 'all' }); }
        });
      }
    }

    {
      const wrap  = this.bigInfosEl?.nativeElement;
      const lines = (this.bigLines?.toArray() || []).map(r => r.nativeElement);
      if (wrap && lines.length){
        gsap.set(lines, { autoAlpha: 0, y: 22 });
        gsap.timeline({
          defaults: { ease: EASE },
          scrollTrigger: { trigger: wrap, start: 'top 85%', once: true },
          onStart: () => { rm([wrap, ...lines]); }
        })
        .to(lines, { autoAlpha: 1, y: 0, duration: .5, stagger: .08 }, 0)
        .add(() => { gsap.set(lines, { clearProps: 'transform,opacity' }); });
      }
    }

    try { ScrollTrigger.refresh(); } catch {}
  }

  /* ===== Form ===== */
  get isLoading(): boolean { return this.sendState === 'loading'; }
  get isSuccess(): boolean { return this.sendState === 'success'; }
  get isError(): boolean   { return this.sendState === 'error'; }

  onFormChange() {
    if (this.sendState === 'success' || this.sendState === 'error') {
      this.sendState = 'idle';
      this.cdr.markForCheck();
    }
  }

  async onSubmit(ev: Event) {
    ev.preventDefault();
    if (this.sendState === 'loading') return;

    const form = ev.target as HTMLFormElement;
    const fd   = new FormData(form);

    const firstname = String(fd.get('firstname') ?? '').trim();
    const lastname  = String(fd.get('lastname')  ?? '').trim();
    const email     = String(fd.get('email')     ?? '').trim();
    const phone     = String(fd.get('phone')     ?? '').trim();
    const message   = String(fd.get('message')   ?? '').trim();
    const website   = String(fd.get('website')   ?? '');
    const civ       = String(fd.get('civ')       ?? '').trim();
    const profil    = String(fd.get('profil')    ?? '').trim();

    const fullName = [firstname, lastname].filter(Boolean).join(' ').trim();
    const lang = this.currentPath().startsWith('/en/') ? 'en' : 'fr';

    if (website) {
      this.sendState = 'success';
      (ev.target as HTMLFormElement).reset();
      this.cdr.markForCheck();
      return;
    }

    if (!firstname || !lastname || !email || !message) {
      this.sendState = 'error';
      this.messageError = 'Merci de renseigner Prénom, Nom, eMail et Message.';
      this.cdr.markForCheck();
      return;
    }

    const payload = {
      name: fullName,
      email,
      phone,
      message,
      website,
      source: 'contact',
      lang,
      civ,
      profil
    };

    this.sendState = 'loading';
    this.messageError = '';
    this.cdr.markForCheck();

    try {
      await this.contact.send(payload);
      this.sendState = 'success';
      (ev.target as HTMLFormElement).reset();
      this.cdr.markForCheck();
    } catch (e: any) {
      console.error('[Contact] API error', e);
      this.sendState = 'error';
      this.messageError = e?.message || 'Échec de l’envoi.';
      this.cdr.markForCheck();

      setTimeout(() => {
        this.sendState = 'idle';
        this.cdr.markForCheck();
      }, 3000);
    }
  }
}
