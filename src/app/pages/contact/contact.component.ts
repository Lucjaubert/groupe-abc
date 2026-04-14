import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Component,
  Input,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  ViewChildren,
  QueryList,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  PLATFORM_ID,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ContactService } from '../../services/contact.service';
import { WordpressService } from '../../services/wordpress.service';
import { SeoService } from '../../services/seo.service';
import { getSeoForRoute } from '../../config/seo.routes';

type SendState = 'idle' | 'loading' | 'success' | 'error';

type PresentationDl = {
  text1: string;
  text2: string;
  file: string | null;
};

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactComponent implements OnInit, AfterViewInit, OnDestroy {
  /* ====== Coordonnées (affichage) ====== */
  @Input() streetAddress = '18 rue Pasquier';
  @Input() postalCode = '75008';
  @Input() addressLocality = 'Paris';
  @Input() phoneIntl = '+33178414441';
  @Input() phoneDisplay = '01 78 41 44 41';
  @Input() email = 'contact@groupe-abc.fr';
  @Input() linkedinUrl = 'https://www.linkedin.com/company/groupe-abc-experts/';
  @Input() acf?: any;

  /* ====== H1 ====== */
  public contactH1 = '';

  /* ====== Bloc téléchargement plaquette ====== */
  presentation: PresentationDl = {
    text1: 'Télécharger la présentation du',
    text2: 'Groupe ABC',
    file: null,
  };

  dlL1 = 'Télécharger la';
  dlL2 = 'présentation du';

  get hasFile(): boolean {
    const f = this.presentation?.file;
    return !!f && typeof f === 'string' && f.trim().length > 0;
  }

  /* =========================
   * ✅ Pièce jointe
   * ========================= */
  attachmentFile: File | null = null;
  attachmentName = '';
  readonly acceptedAttachmentTypes = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp';
  private readonly MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

  /* ====== Injections ====== */
  private wp = inject(WordpressService);
  private cdr = inject(ChangeDetectorRef);
  private contact = inject(ContactService);
  private seo = inject(SeoService);

  private platformId = inject(PLATFORM_ID);
  private doc = inject(DOCUMENT);

  /* ====== GSAP lazy ====== */
  private gsap: any | null = null;
  private ScrollTrigger: any | null = null;

  /** Fallback SSR */
  private readonly FALLBACK_ORIGIN = 'https://groupe-abc.fr';

  /* =========================
   * ✅ Profil (particulier / pro)
   * =========================
   * IMPORTANT : par défaut "part"
   */
  profil: 'pro' | 'part' | '' = 'part';

  get isPro(): boolean {
    return this.profil === 'pro';
  }

  setProfil(val: 'pro' | 'part'): void {
    if (this.profil === val) return;
    this.profil = val;
    this.onFormChange();
    this.cdr.markForCheck();
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

  /* ====== Refs ====== */
  @ViewChild('contactTitle') contactTitle!: ElementRef<HTMLElement>;
  @ViewChild('contactLinkedin') contactLinkedin?: ElementRef<HTMLElement>;

  @ViewChild('radiosEl') radiosEl!: ElementRef<HTMLElement>;
  @ViewChildren('radioItem') radioItems!: QueryList<ElementRef<HTMLElement>>;

  @ViewChild('formGridEl') formGridEl!: ElementRef<HTMLElement>;
  @ViewChildren('fgLabel') fgLabels!: QueryList<ElementRef<HTMLElement>>;

  @ViewChild('attachRowEl') attachRowEl?: ElementRef<HTMLElement>;
  @ViewChild('sendBtn') sendBtn!: ElementRef<HTMLElement>;

  @ViewChild('bigInfosEl') bigInfosEl!: ElementRef<HTMLElement>;
  @ViewChildren('bigLine') bigLines!: QueryList<ElementRef<HTMLElement>>;

  private bindScheduled = false;
  private heroPlayed = false;

  sendState: SendState = 'idle';
  messageError = '';

  /* ========================= Lifecycle ========================= */
  ngOnInit(): void {
    const isEN = this.currentPath().startsWith('/en/');
    this.contactH1 = isEN ? 'Contact us' : 'Contactez-nous';

    this.applySeoFromConfig();

    if (this.acf?.presentation_download_section) {
      void this.hydratePresentationFrom(this.acf.presentation_download_section);
    } else {
      this.wp.getHomepageData().subscribe({
        next: (acf) => {
          if (acf?.presentation_download_section) {
            void this.hydratePresentationFrom(acf.presentation_download_section);
            this.cdr.markForCheck();
          }
        },
        error: (e) => console.error('[INIT] getHomepageData() error', e),
      });
    }

    this.applySplitForText1(this.presentation.text1);
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser()) return;

    try {
      await this.setupGsap();
    } catch (e) {
      console.error('[GSAP] setup error', e);
    }

    if (!this.gsap || !this.ScrollTrigger) {
      this.revealAllIfNoGsap();
      return;
    }

    this.radioItems?.changes?.subscribe(() => this.scheduleBind());
    this.fgLabels?.changes?.subscribe(() => this.scheduleBind());
    this.bigLines?.changes?.subscribe(() => this.scheduleBind());

    this.scheduleBind();
  }

  ngOnDestroy(): void {
    if (this.isBrowser() && this.ScrollTrigger) {
      try {
        this.ScrollTrigger.getAll().forEach((t: any) => t.kill());
      } catch {}
    }
    try {
      this.gsap?.globalTimeline?.clear?.();
    } catch {}
  }

  /* =========================
   * ✅ Fallback : si GSAP absent => on enlève prehide / prehide-row
   * ========================= */
  private revealAllIfNoGsap(): void {
    try {
      const host = (this.doc.querySelector('.contact-page') as HTMLElement) || this.doc.body;
      const els = Array.from(host.querySelectorAll<HTMLElement>('.prehide, .prehide-row'));
      els.forEach((el) => {
        el.classList.remove('prehide', 'prehide-row');
        el.style.opacity = '1';
        el.style.visibility = 'visible';
        el.style.transform = 'none';
      });
    } catch {}
  }

  /* ========================= Pièce jointe ========================= */
  onFileSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement | null;
    const file = input?.files?.[0] || null;

    if (!file) {
      this.clearAttachment();
      return;
    }

    if (file.size > this.MAX_ATTACHMENT_BYTES) {
      this.clearAttachmentInput(input);
      this.attachmentFile = null;
      this.attachmentName = '';
      this.sendState = 'error';
      this.messageError = 'Fichier trop volumineux (max 10 MB).';
      this.cdr.markForCheck();
      return;
    }

    const allowedExt = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'webp'];
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext && !allowedExt.includes(ext)) {
      this.clearAttachmentInput(input);
      this.attachmentFile = null;
      this.attachmentName = '';
      this.sendState = 'error';
      this.messageError = 'Type de fichier non autorisé.';
      this.cdr.markForCheck();
      return;
    }

    this.attachmentFile = file;
    this.attachmentName = file.name;

    if (this.sendState === 'success' || this.sendState === 'error') {
      this.sendState = 'idle';
      this.messageError = '';
    }

    this.cdr.markForCheck();
  }

  clearAttachment(): void {
    this.attachmentFile = null;
    this.attachmentName = '';

    if (this.isBrowser()) {
      const el = this.doc.getElementById('attachment') as HTMLInputElement | null;
      if (el) el.value = '';
    }

    this.cdr.markForCheck();
  }

  private clearAttachmentInput(input?: HTMLInputElement | null): void {
    if (input) input.value = '';
  }

  /* ========================= Hydratation plaquette ========================= */
  private async hydratePresentationFrom(dl: any) {
    const t1 = dl?.presentation_button_text_1 || 'Télécharger la présentation du';
    const t2 = dl?.presentation_button_text_2 || 'Groupe ABC';
    const raw = dl?.presentation_file;

    const resolved = await this.resolveMedia(raw);
    const abs = this.absUrl(resolved || '');

    this.presentation = { text1: t1, text2: t2, file: abs || null };
    this.applySplitForText1(this.presentation.text1);

    if (
      this.isBrowser() &&
      this.presentation.file &&
      /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(this.presentation.file)
    ) {
      void this.preloadImage(this.presentation.file);
    }

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
      try {
        return (await firstValueFrom(this.wp.getMediaUrl(idOrUrl))) || '';
      } catch {
        return '';
      }
    }

    if (typeof idOrUrl === 'string') {
      const s = idOrUrl.trim();
      if (/^\d+$/.test(s)) {
        try {
          return (await firstValueFrom(this.wp.getMediaUrl(+s))) || '';
        } catch {
          return '';
        }
      }
      if (/^(https?:)?\/\//.test(s) || s.startsWith('/') || s.startsWith('data:')) return s;
      return s;
    }

    return '';
  }

  private preloadImage(src: string): Promise<void> {
    if (!this.isBrowser() || !src) return Promise.resolve();
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

  /* ========================= Utils URL / origin ========================= */
  private getBrowserOrigin(): string {
    if (this.isBrowser()) {
      try {
        return window.location.origin;
      } catch {
        return this.FALLBACK_ORIGIN;
      }
    }
    return this.FALLBACK_ORIGIN;
  }

  private absUrl(url: string): string {
    if (!url) return '';
    if (/^https?:\/\//i.test(url) || /^\/\//.test(url) || url.startsWith('data:')) return url;
    const origin = this.getBrowserOrigin();
    if (url.startsWith('/')) return origin + url;
    return `${origin}/${url}`;
  }

  private currentPath(): string {
    if (this.isBrowser()) {
      try {
        return window.location.pathname || '/';
      } catch {
        return '/';
      }
    }
    return '/';
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  isSameOrigin(url: string): boolean {
    try {
      const origin = this.getBrowserOrigin();
      const u = new URL(url, origin);
      return u.origin === origin;
    } catch {
      return false;
    }
  }

  safeDownloadName(url: string): string {
    try {
      const origin = this.getBrowserOrigin();
      const u = new URL(url, origin);
      const base = u.pathname.split('/').pop() || 'plaquette.pdf';
      return decodeURIComponent(base);
    } catch {
      return 'plaquette.pdf';
    }
  }

  /* =========================
   * ✅ DOWNLOAD (même logique que Homepage)
   * - ouvre l’URL WP en nouvel onglet
   * - déclenche le download via same-origin (proxy Angular)
   * ========================= */
  onDlClick(ev: MouseEvent, url: string | null): void {
    ev.preventDefault();
    ev.stopPropagation();

    if (!this.isBrowser()) return;

    const rawUrl = (url || '').trim();
    if (!rawUrl) return;

    // 1) URL réelle (WP) pour ouvrir dans un nouvel onglet
    const openUrl = this.toAbsoluteUrl(rawUrl);

    // 2) URL same-origin pour télécharger (pathname -> proxy Angular en local)
    const dlUrl = this.toSameOriginDownloadUrl(openUrl);

    // (A) Ouvre le PDF dans un nouvel onglet (doit rester synchrone)
    try {
      this.doc.defaultView?.open(openUrl, '_blank', 'noopener,noreferrer');
    } catch {}

    // (B) Téléchargement immédiat (sync => beaucoup plus fiable)
    try {
      const a = this.doc.createElement('a');
      a.href = dlUrl;
      a.download = this.guessFilename(openUrl);
      a.rel = 'noopener';
      a.style.display = 'none';
      this.doc.body.appendChild(a);
      a.click();
      a.remove();
    } catch {}

    // (optionnel) fallback async si un navigateur refuse encore (rare)
    // void this.downloadViaBlobIfPossible(dlUrl);
  }

  private async downloadViaBlobIfPossible(url: string): Promise<void> {
    if (!this.isBrowser() || !url) return;

    const abs = this.toAbsoluteUrl(url);
    const filename = this.guessFilename(abs);

    try {
      const resp = await fetch(abs, { mode: 'cors' });
      if (!resp.ok) return;

      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);

      this.triggerDownload(objectUrl, filename);

      setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    } catch {}
  }

  private triggerDownload(href: string, filename: string): void {
    const a = this.doc.createElement('a');
    a.href = href;
    a.download = filename || 'Plaquette-Groupe-ABC.pdf';
    a.rel = 'noopener';
    a.style.display = 'none';
    this.doc.body.appendChild(a);
    a.click();
    a.remove();
  }

  /**
   * Transforme une URL absolute en URL relative (/...),
   * pour passer par le proxy Angular et être same-origin.
   */
  private toSameOriginDownloadUrl(url: string): string {
    if (!url) return '';
    try {
      const origin = this.doc.defaultView?.location?.origin || this.getBrowserOrigin();
      const u = new URL(url, origin);
      return u.pathname + u.search + u.hash;
    } catch {
      return url.startsWith('/') ? url : '/' + url;
    }
  }

  private toAbsoluteUrl(url: string): string {
    // On réutilise ta logique absUrl (robuste SSR)
    return this.absUrl(url);
  }

  private guessFilename(url: string): string {
    try {
      const origin = this.doc.defaultView?.location?.origin || this.getBrowserOrigin();
      const u = new URL(url, origin);
      return decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || 'Plaquette-Groupe-ABC.pdf');
    } catch {
      return 'Plaquette-Groupe-ABC.pdf';
    }
  }

  /* ========================= SEO ========================= */
  private applySeoFromConfig(): void {
    const lang = this.currentPath().startsWith('/en/') ? 'en' : 'fr';
    const baseSeo = getSeoForRoute('contact', lang as any);
    const canonical = (baseSeo.canonical || '').replace(/\/+$/, '');

    let origin = this.FALLBACK_ORIGIN;
    try {
      if (canonical) {
        const u = new URL(canonical);
        origin = `${u.protocol}//${u.host}`;
      }
    } catch {}

    const homeUrl = lang === 'en' ? `${origin}/en` : `${origin}/`;

    const contactPage = {
      '@type': 'ContactPage',
      '@id': `${canonical}#contact`,
      url: canonical,
      name: baseSeo.title,
      description: baseSeo.description,
      inLanguage: lang === 'en' ? 'en-US' : 'fr-FR',
      isPartOf: { '@id': `${origin}#website` },
      mainEntity: {
        '@type': 'Organization',
        '@id': `${origin}#organization`,
        name: 'Groupe ABC',
        url: origin,
        telephone: this.phoneIntl,
        email: this.email ? `mailto:${this.email}` : undefined,
        address: {
          '@type': 'PostalAddress',
          streetAddress: this.streetAddress,
          postalCode: this.postalCode,
          addressLocality: this.addressLocality,
          addressCountry: 'FR',
        },
        sameAs: this.linkedinUrl ? [this.linkedinUrl] : undefined,
      },
    };

    const breadcrumb = {
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: lang === 'en' ? 'Home' : 'Accueil', item: homeUrl },
        { '@type': 'ListItem', position: 2, name: baseSeo.title, item: canonical },
      ],
    };

    this.seo.update({
      ...baseSeo,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [contactPage, breadcrumb],
      },
    });
  }

  /* ========================= Animations (TON code) ========================= */
  private forceInitialHidden(host: HTMLElement) {
    if (!this.gsap) return;
    const gsap = this.gsap;

    const pre = Array.from(host.querySelectorAll<HTMLElement>('.prehide')) || [];
    const rows = Array.from(host.querySelectorAll<HTMLElement>('.prehide-row')) || [];

    if (pre.length) gsap.set(pre, { autoAlpha: 0, y: 20 });
    if (rows.length) gsap.set(rows, { autoAlpha: 0 });
  }

  private scheduleBind() {
    if (!this.isBrowser() || !this.gsap) return;
    if (this.bindScheduled) return;
    this.bindScheduled = true;
    queueMicrotask(() =>
      requestAnimationFrame(() => {
        this.bindScheduled = false;
        this.bindAnimations();
      }),
    );
  }

  private bindAnimations(): void {
    if (!this.isBrowser() || !this.gsap || !this.ScrollTrigger) return;

    const gsap = this.gsap;
    const ScrollTrigger = this.ScrollTrigger;

    const host =
      (this.doc.querySelector('.contact-page') as HTMLElement) ||
      (this.doc.body as HTMLElement);

    this.forceInitialHidden(host);

    try {
      ScrollTrigger.getAll().forEach((t: any) => t.kill());
    } catch {}

    const EASE = 'power3.out';
    const rm = (els: Element | Element[]) =>
      (Array.isArray(els) ? els : [els]).forEach((el) =>
        el.classList.remove('prehide', 'prehide-row'),
      );

    const title = this.contactTitle?.nativeElement;
    const li = this.contactLinkedin?.nativeElement;

    if (title && !this.heroPlayed) {
      gsap.fromTo(
        title,
        { autoAlpha: 0, y: 20 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.58,
          ease: EASE,
          onStart: () => rm(title),
          onComplete: () => {
            this.heroPlayed = true;
            gsap.set(title, { clearProps: 'all' });
          },
        },
      );
    }

    if (li) {
      gsap.fromTo(
        li,
        { autoAlpha: 0, y: 16, scale: 0.96 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.5,
          ease: 'power2.out',
          delay: 0.06,
          onStart: () => rm(li),
          onComplete: () => gsap.set(li, { clearProps: 'all' }),
        },
      );
    }

    // Radios
    {
      const radios = this.radiosEl?.nativeElement;
      const items = (this.radioItems?.toArray() || []).map((r) => r.nativeElement);
      if (radios && items.length) {
        gsap.set(items, { autoAlpha: 0, y: 10 });
        gsap
          .timeline({
            defaults: { ease: EASE },
            scrollTrigger: { trigger: radios, start: 'top 85%', once: true },
            onStart: () => rm([radios, ...items]),
          })
          .to(items, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.06 }, 0)
          .add(() => gsap.set(items, { clearProps: 'transform,opacity' }));
      }
    }

    // Grid + attach row
    {
      const grid = this.formGridEl?.nativeElement;
      const labels = (this.fgLabels?.toArray() || []).map((r) => r.nativeElement);
      if (grid && labels.length) {
        gsap.set(labels, { autoAlpha: 0, y: 14 });

        const attachRow = this.attachRowEl?.nativeElement;
        if (attachRow) gsap.set(attachRow, { autoAlpha: 0, y: 10 });

        gsap
          .timeline({
            defaults: { ease: EASE },
            scrollTrigger: { trigger: grid, start: 'top 85%', once: true },
            onStart: () => {
              const arr: Element[] = [grid, ...labels];
              if (attachRow) arr.push(attachRow);
              rm(arr);
            },
          })
          .to(labels, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.07 }, 0)
          .to(attachRow, { autoAlpha: 1, y: 0, duration: 0.35 }, '-=0.15')
          .add(() => {
            gsap.set(labels, { clearProps: 'transform,opacity' });
            if (attachRow) gsap.set(attachRow, { clearProps: 'transform,opacity' });
          });
      }
    }

    // Bouton envoyer
    {
      const btn = this.sendBtn?.nativeElement;
      if (btn) {
        gsap.fromTo(
          btn,
          { autoAlpha: 0, y: 12, scale: 0.98 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.44,
            ease: 'power2.out',
            scrollTrigger: { trigger: btn, start: 'top 92%', once: true },
            onStart: () => rm(btn),
            onComplete: () => gsap.set(btn, { clearProps: 'all' }),
          },
        );
      }
    }

    // Big infos
    {
      const wrap = this.bigInfosEl?.nativeElement;
      const lines = (this.bigLines?.toArray() || []).map((r) => r.nativeElement);
      if (wrap && lines.length) {
        gsap.set(lines, { autoAlpha: 0, y: 22 });
        gsap
          .timeline({
            defaults: { ease: EASE },
            scrollTrigger: { trigger: wrap, start: 'top 85%', once: true },
            onStart: () => rm([wrap, ...lines]),
          })
          .to(lines, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08 }, 0)
          .add(() => gsap.set(lines, { clearProps: 'transform,opacity' }));
      }
    }

    try {
      ScrollTrigger.refresh();
    } catch {}
  }

  /* ========================= Form ========================= */
  get isLoading(): boolean {
    return this.sendState === 'loading';
  }
  get isSuccess(): boolean {
    return this.sendState === 'success';
  }
  get isError(): boolean {
    return this.sendState === 'error';
  }

  onFormChange() {
    if (this.sendState === 'success' || this.sendState === 'error') {
      this.sendState = 'idle';
      this.cdr.markForCheck();
    }
  }

  private buildName(firstname: string, lastname: string, company: string, profil: 'pro' | 'part'): string {
    if (profil === 'pro') return (company || '').trim();
    return `${(firstname || '').trim()} ${(lastname || '').trim()}`.trim();
  }

  async onSubmit(ev: Event) {
    ev.preventDefault();
    if (this.sendState === 'loading') return;

    const form = ev.target as HTMLFormElement;
    const fd = new FormData(form);

    const profilFromForm = String(fd.get('profil') ?? '').trim() as 'pro' | 'part' | '';
    const profil = (this.profil || profilFromForm || 'part') as 'pro' | 'part';

    const firstname = String(fd.get('firstname') ?? '').trim();
    const lastname = String(fd.get('lastname') ?? '').trim();
    const company = String(fd.get('company') ?? '').trim();

    const email = String(fd.get('email') ?? '').trim();
    const phone = String(fd.get('phone') ?? '').trim();
    const message = String(fd.get('message') ?? '').trim();
    const website = String(fd.get('website') ?? '');
    const civ = String(fd.get('civ') ?? '').trim();

    const lang = this.currentPath().startsWith('/en/') ? 'en' : 'fr';

    // Honeypot
    if (website) {
      this.sendState = 'success';
      form.reset();
      this.clearAttachment();
      this.profil = 'part';
      this.cdr.markForCheck();
      return;
    }

    // Validation conditionnelle
    if (profil === 'pro') {
      if (!company || !email || !message) {
        this.sendState = 'error';
        this.messageError = 'Merci de renseigner Société, eMail et Message.';
        this.cdr.markForCheck();
        return;
      }
    } else {
      if (!firstname || !lastname || !email || !message) {
        this.sendState = 'error';
        this.messageError = 'Merci de renseigner Prénom, Nom, eMail et Message.';
        this.cdr.markForCheck();
        return;
      }
    }

    const fullName = this.buildName(firstname, lastname, company, profil);

    const payload = {
      name: fullName,
      company: profil === 'pro' ? company : '',
      email,
      phone,
      message,
      website,
      source: 'contact',
      lang,
      civ,
      profil,
    };

    this.sendState = 'loading';
    this.messageError = '';
    this.cdr.markForCheck();

    try {
      if (this.attachmentFile) {
        const out = new FormData();
        Object.entries(payload).forEach(([k, v]) => out.append(k, String(v ?? '')));
        out.append('attachment', this.attachmentFile, this.attachmentFile.name);
        await this.contact.send(out as any);
      } else {
        await this.contact.send(payload as any);
      }

      this.sendState = 'success';
      form.reset();
      this.clearAttachment();
      this.profil = 'part';
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
