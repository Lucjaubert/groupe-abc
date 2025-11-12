import { CommonModule } from '@angular/common';
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

/* =========================
 * SEO CONTACT (Matthieu)
 * ========================= */
const CONTACT_SEO = {
  fr: {
    title:
      'Contact – Expertise immobilière certifiée en France et Outre-mer',
    description:
      'Contactez un expert immobilier agréé pour toute demande d’évaluation ou de rapport d’expertise. Réponse rapide, couverture nationale et totale confidentialité.',
    schema: {
      serviceType: 'Contact – Expertise immobilière',
      provider: 'Groupe ABC – Experts immobiliers agréés',
      areaServed: 'France métropolitaine et Outre-mer',
    },
  },
  en: {
    title:
      'Contact – Certified real-estate valuation in France and Overseas',
    description:
      'Contact a certified real-estate valuation expert for any appraisal request. Fast response, nationwide and overseas coverage, full confidentiality.',
    schema: {
      serviceType:
        'Contact – Real-estate valuation services',
      provider:
        'Groupe ABC – Accredited real-estate valuation experts',
      areaServed:
        'Metropolitan France and Overseas territories',
    },
  },
} as const;

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  /* ====== SEO / URLs ======
   * Canonique FR: /contact-expert-immobilier
   * Canonique EN: /en/contact
   */
  @Input() siteUrl = 'https://groupe-abc.fr';
  @Input() canonicalPath = '/contact-expert-immobilier';
  @Input() canonicalPathEn = '/en/contact';
  @Input() orgName = 'Groupe ABC';

  /* ====== Coordonnées (affichage + JSON-LD ContactPoint) ====== */
  @Input() streetAddress = '18 rue Pasquier';
  @Input() postalCode = '75008';
  @Input() addressLocality = 'Paris';
  @Input() phoneIntl = '+33178414441';
  @Input() phoneDisplay = '01 78 41 44 41';
  @Input() email = 'contact@groupe-abc.fr';
  @Input() linkedinUrl =
    'https://www.linkedin.com/company/groupe-abc-experts/';
  @Input() socialImage = '/assets/og/og-default.jpg';

  @Input() acf?: any;

  /* ====== H1 SSR garanti ====== */
  public contactH1 = '';

  presentation: PresentationDl = {
    text1: 'Télécharger la présentation du',
    text2: 'Groupe ABC',
    file: null,
  };

  dlL1 = 'Télécharger la';
  dlL2 = 'présentation du';

  get hasFile(): boolean {
    const f = this.presentation?.file;
    return (
      !!f &&
      typeof f === 'string' &&
      f.trim().length > 0
    );
  }

  private seo = inject(SeoService);
  private wp = inject(WordpressService);

  @ViewChild('contactTitle')
  contactTitle!: ElementRef<HTMLElement>;
  @ViewChild('contactLinkedin')
  contactLinkedin?: ElementRef<HTMLElement>;

  @ViewChild('radiosEl')
  radiosEl!: ElementRef<HTMLElement>;
  @ViewChildren('radioItem')
  radioItems!: QueryList<ElementRef<HTMLElement>>;

  @ViewChild('formGridEl')
  formGridEl!: ElementRef<HTMLElement>;
  @ViewChildren('fgLabel')
  fgLabels!: QueryList<ElementRef<HTMLElement>>;

  @ViewChild('sendBtn')
  sendBtn!: ElementRef<HTMLElement>;

  @ViewChild('bigInfosEl')
  bigInfosEl!: ElementRef<HTMLElement>;
  @ViewChildren('bigLine')
  bigLines!: QueryList<ElementRef<HTMLElement>>;

  private bindScheduled = false;
  private heroPlayed = false;

  sendState: SendState = 'idle';
  messageError = '';

  constructor(
    private cdr: ChangeDetectorRef,
    private contact: ContactService
  ) {}

  /* ========================= Lifecycle ========================= */

  ngOnInit(): void {
    // H1 SSR avec fallback selon la langue
    const isEN = this.currentPath().startsWith('/en/');
    this.contactH1 = isEN
      ? 'Contact us'
      : 'Contactez-nous';

    // Hydratation du bloc téléchargement (plaquette)
    if (
      this.acf?.presentation_download_section
    ) {
      this.hydratePresentationFrom(
        this.acf.presentation_download_section
      );
    } else {
      this.wp
        .getHomepageData()
        .subscribe({
          next: (acf) => {
            if (
              acf?.presentation_download_section
            ) {
              this.hydratePresentationFrom(
                acf.presentation_download_section
              );
              this.cdr.markForCheck();
            }
          },
          error: (e) =>
            console.error(
              '[INIT] getHomepageData() error',
              e
            ),
        });
    }

    this.applySplitForText1(
      this.presentation.text1
    );
    this.applySeo();
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser()) return;

    gsap.registerPlugin(ScrollTrigger);

    this.radioItems?.changes?.subscribe(
      () => this.scheduleBind()
    );
    this.fgLabels?.changes?.subscribe(
      () => this.scheduleBind()
    );
    this.bigLines?.changes?.subscribe(
      () => this.scheduleBind()
    );

    this.scheduleBind();
  }

  ngOnDestroy(): void {
    try {
      ScrollTrigger.getAll().forEach((t) =>
        t.kill()
      );
    } catch {}
    try {
      gsap.globalTimeline.clear();
    } catch {}
  }

  /* ========================= Hydratation plaquette ========================= */

  private async hydratePresentationFrom(
    dl: any
  ) {
    const t1 =
      dl?.presentation_button_text_1 ||
      'Télécharger la présentation du';
    const t2 =
      dl?.presentation_button_text_2 ||
      'Groupe ABC';
    const raw = dl?.presentation_file;

    const resolved = await this.resolveMedia(
      raw
    );
    const abs = this.absUrl(
      resolved || '',
      this.siteUrl
    );

    this.presentation = {
      text1: t1,
      text2: t2,
      file: abs || null,
    };
    this.applySplitForText1(
      this.presentation.text1
    );

    // Préchargement image uniquement côté navigateur
    if (
      this.isBrowser() &&
      this.presentation.file &&
      /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(
        this.presentation.file
      )
    ) {
      void this.preloadImage(
        this.presentation.file
      );
    }

    this.cdr.markForCheck();
  }

  private async resolveMedia(
    idOrUrl: any
  ): Promise<string> {
    if (!idOrUrl) return '';

    if (typeof idOrUrl === 'object') {
      const src =
        idOrUrl?.source_url ||
        idOrUrl?.url ||
        '';
      if (src) return src;
      if (idOrUrl?.id != null)
        idOrUrl = idOrUrl.id;
    }

    if (typeof idOrUrl === 'number') {
      try {
        return (
          (await firstValueFrom(
            this.wp.getMediaUrl(idOrUrl)
          )) || ''
        );
      } catch {
        return '';
      }
    }

    if (typeof idOrUrl === 'string') {
      const s = idOrUrl.trim();
      if (/^\d+$/.test(s)) {
        try {
          return (
            (await firstValueFrom(
              this.wp.getMediaUrl(+s)
            )) || ''
          );
        } catch {
          return '';
        }
      }
      if (
        /^(https?:)?\/\//.test(s) ||
        s.startsWith('/') ||
        s.startsWith('data:')
      )
        return s;
      return s;
    }

    return '';
  }

  private preloadImage(
    src: string
  ): Promise<void> {
    if (!this.isBrowser() || !src)
      return Promise.resolve();
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
    const words = (t || '')
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ');
    if (words.length >= 3) {
      this.dlL1 = words
        .slice(0, 2)
        .join(' ');
      this.dlL2 = words
        .slice(2)
        .join(' ');
    } else {
      this.dlL1 = 'Télécharger la';
      this.dlL2 = 'présentation du';
    }
  }

  /* ========================= SEO ========================= */

  private applySeo(): void {
    const nowPath = this.currentPath();
    const isEN = nowPath.startsWith('/en/');

    const canonPath = isEN
      ? this.canonicalPathEn
      : this.canonicalPath;
    const canonicalAbs = this.normalizeUrl(
      this.siteUrl,
      canonPath
    );

    const locale = isEN ? 'en_US' : 'fr_FR';

    const altFR = this.normalizeUrl(
      this.siteUrl,
      this.canonicalPath
    );
    const altEN = this.normalizeUrl(
      this.siteUrl,
      this.canonicalPathEn
    );
    const alternates = [
      { lang: 'fr', href: altFR },
      { lang: 'en', href: altEN },
      { lang: 'x-default', href: altFR },
    ];

    const M = isEN
      ? CONTACT_SEO.en
      : CONTACT_SEO.fr;

    const title = M.title;
    const description = M.description;

    const og =
      this.socialImage ||
      '/assets/og/og-default.jpg';
    const ogAbs = this.absUrl(
      og,
      this.siteUrl
    );
    const isDefaultOg =
      /\/og-default\.jpg$/i.test(ogAbs);

    const base = this.siteUrl.replace(
      /\/+$/,
      ''
    );
    const siteId = `${base}#website`;
    const orgId = `${base}#organization`;

    // Service node (brief Matthieu)
    const serviceNode = {
      '@type': 'Service',
      '@id': `${canonicalAbs}#contact-service`,
      serviceType: M.schema.serviceType,
      provider: {
        '@id': orgId,
        name: M.schema.provider,
      },
      areaServed: M.schema.areaServed,
    };

    // ContactPage spécifique
    const contactPage = {
      '@type': 'ContactPage',
      '@id': `${canonicalAbs}#contact`,
      url: canonicalAbs,
      name: title,
      description,
      inLanguage: isEN ? 'en-US' : 'fr-FR',
      isPartOf: { '@id': siteId },
      about: { '@id': orgId },
      primaryImageOfPage: ogAbs,
    };

    // Fil d'Ariane
    const breadcrumb = {
      '@type': 'BreadcrumbList',
      '@id': `${canonicalAbs}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: isEN ? 'Home' : 'Accueil',
          item: this.siteUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Contact',
          item: canonicalAbs,
        },
      ],
    };

    this.seo.update({
      title,
      description,
      canonical: canonicalAbs,
      robots: 'index,follow',
      locale,
      image: ogAbs,
      imageAlt: `${this.orgName} – Contact`,
      ...(isDefaultOg && {
        imageWidth: 1200,
        imageHeight: 630,
      }),
      type: 'website',
      alternates,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          contactPage,
          breadcrumb,
          serviceNode,
        ],
      },
    });
  }

  /* ========================= Utils ========================= */

  private normalizeUrl(
    base: string,
    path: string
  ): string {
    const b = base.endsWith('/')
      ? base.slice(0, -1)
      : base;
    const p = path.startsWith('/')
      ? path
      : `/${path}`;
    return `${b}${p}`;
  }

  private absUrl(
    url: string,
    origin: string
  ): string {
    if (!url) return '';
    try {
      if (/^https?:\/\//i.test(url))
        return url;
      if (/^\/\//.test(url))
        return 'https:' + url;
      const o = origin.endsWith('/')
        ? origin.slice(0, -1)
        : origin;
      return url.startsWith('/')
        ? o + url
        : `${o}/${url}`;
    } catch {
      return url;
    }
  }

  private currentPath(): string {
    if (this.isBrowser()) {
      try {
        return (
          window.location.pathname ||
          '/'
        );
      } catch {
        return '/';
      }
    }
    return '/';
  }

  private getBrowserOrigin(): string {
    try {
      return window.location.origin;
    } catch {
      return this.siteUrl;
    }
  }

  private isBrowser(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof document !== 'undefined'
    );
  }

  isSameOrigin(url: string): boolean {
    try {
      const u = new URL(url, this.siteUrl);
      const currentOrigin =
        this.getBrowserOrigin();
      return u.origin === currentOrigin;
    } catch {
      return false;
    }
  }

  safeDownloadName(url: string): string {
    try {
      const u = new URL(url, this.siteUrl);
      const base =
        u.pathname.split('/').pop() ||
        'plaquette.pdf';
      return decodeURIComponent(base);
    } catch {
      return 'plaquette.pdf';
    }
  }

  /* ========================= Download handlers ========================= */

  onDlClick(
    ev: MouseEvent,
    url: string | null
  ) {
    const a =
      ev.currentTarget as HTMLAnchorElement | null;
    if (!url) return;

    if (a) {
      // eslint-disable-next-line no-console
      console.log('[CLICK] DL anchor', {
        href: a.getAttribute('href'),
        target: a.getAttribute('target'),
        rel: a.getAttribute('rel'),
        download: a.getAttribute('download'),
        classList: Array.from(a.classList),
      });
    }

    const same = this.isSameOrigin(url);
    setTimeout(() => {
      try {
        window.open(
          url,
          same ? '_self' : '_blank',
          same ? '' : 'noopener'
        );
      } catch (e) {
        console.error(
          '[CLICK] window.open error',
          e
        );
      }
    }, 0);
  }

  downloadNameOrNull(
    url: string | null
  ): string | null {
    if (!url) return null;
    try {
      const u = new URL(url, this.siteUrl);
      const currentOrigin =
        window.location.origin;
      if (u.origin !== currentOrigin)
        return null;
      const base = decodeURIComponent(
        u.pathname
          .split('/')
          .pop() || 'plaquette.pdf'
      );
      return base || 'plaquette.pdf';
    } catch {
      return null;
    }
  }

  /* ========================= Animations ========================= */

  private forceInitialHidden(
    host: HTMLElement
  ) {
    const pre =
      Array.from(
        host.querySelectorAll<HTMLElement>(
          '.prehide'
        )
      ) || [];
    const rows =
      Array.from(
        host.querySelectorAll<HTMLElement>(
          '.prehide-row'
        )
      ) || [];
    if (pre.length) {
      gsap.set(pre, {
        autoAlpha: 0,
        y: 20,
      });
    }
    if (rows.length) {
      gsap.set(rows, {
        autoAlpha: 0,
      });
    }
  }

  private scheduleBind() {
    if (this.bindScheduled) return;
    this.bindScheduled = true;
    queueMicrotask(() =>
      requestAnimationFrame(() => {
        this.bindScheduled = false;
        this.bindAnimations();
      })
    );
  }

  private bindAnimations(): void {
    if (!this.isBrowser()) return;

    const host =
      (document.querySelector(
        '.contact-page'
      ) as HTMLElement) || document.body;

    this.forceInitialHidden(host);

    try {
      ScrollTrigger.getAll().forEach(
        (t) => t.kill()
      );
    } catch {}

    const EASE = 'power3.out';
    const rm = (els: Element | Element[]) =>
      (Array.isArray(els)
        ? els
        : [els]
      ).forEach((el) =>
        el.classList.remove(
          'prehide',
          'prehide-row'
        )
      );

    const title =
      this.contactTitle?.nativeElement;
    const li =
      this.contactLinkedin
        ?.nativeElement;

    if (title && !this.heroPlayed) {
      gsap.fromTo(
        title,
        { autoAlpha: 0, y: 20 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.58,
          ease: EASE,
          onStart: () => {
            rm(title);
          },
          onComplete: () => {
            this.heroPlayed = true;
            gsap.set(title, {
              clearProps: 'all',
            });
          },
        }
      );
    }

    if (li) {
      gsap.fromTo(
        li,
        {
          autoAlpha: 0,
          y: 16,
          scale: 0.96,
        },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.5,
          ease: 'power2.out',
          delay: 0.06,
          onStart: () => {
            rm(li);
          },
          onComplete: () => {
            gsap.set(li, {
              clearProps: 'all',
            });
          },
        }
      );
    }

    {
      const radios =
        this.radiosEl?.nativeElement;
      const items =
        (this.radioItems?.toArray() ||
          []).map(
          (r) => r.nativeElement
        );
      if (radios && items.length) {
        gsap.set(items, {
          autoAlpha: 0,
          y: 10,
        });
        gsap
          .timeline({
            defaults: { ease: EASE },
            scrollTrigger: {
              trigger: radios,
              start: 'top 85%',
              once: true,
            },
            onStart: () => {
              rm([radios, ...items]);
            },
          })
          .to(
            items,
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.4,
              stagger: 0.06,
            },
            0
          )
          .add(() => {
            gsap.set(items, {
              clearProps:
                'transform,opacity',
            });
          });
      }
    }

    {
      const grid =
        this.formGridEl
          ?.nativeElement;
      const labels =
        (this.fgLabels?.toArray() ||
          []).map(
          (r) => r.nativeElement
        );
      if (grid && labels.length) {
        gsap.set(labels, {
          autoAlpha: 0,
          y: 14,
        });
        gsap
          .timeline({
            defaults: { ease: EASE },
            scrollTrigger: {
              trigger: grid,
              start: 'top 85%',
              once: true,
            },
            onStart: () => {
              rm([grid, ...labels]);
            },
          })
          .to(
            labels,
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.45,
              stagger: 0.07,
            },
            0
          )
          .add(() => {
            gsap.set(labels, {
              clearProps:
                'transform,opacity',
            });
          });
      }
    }

    {
      const btn =
        this.sendBtn?.nativeElement;
      if (btn) {
        gsap.fromTo(
          btn,
          {
            autoAlpha: 0,
            y: 12,
            scale: 0.98,
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.44,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: btn,
              start: 'top 92%',
              once: true,
            },
            onStart: () => {
              rm(btn);
            },
            onComplete: () => {
              gsap.set(btn, {
                clearProps: 'all',
              });
            },
          }
        );
      }
    }

    {
      const wrap =
        this.bigInfosEl
          ?.nativeElement;
      const lines =
        (this.bigLines?.toArray() ||
          []).map(
          (r) => r.nativeElement
        );
      if (wrap && lines.length) {
        gsap.set(lines, {
          autoAlpha: 0,
          y: 22,
        });
        gsap
          .timeline({
            defaults: { ease: EASE },
            scrollTrigger: {
              trigger: wrap,
              start: 'top 85%',
              once: true,
            },
            onStart: () => {
              rm([wrap, ...lines]);
            },
          })
          .to(
            lines,
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.5,
              stagger: 0.08,
            },
            0
          )
          .add(() => {
            gsap.set(lines, {
              clearProps:
                'transform,opacity',
            });
          });
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
    if (
      this.sendState === 'success' ||
      this.sendState === 'error'
    ) {
      this.sendState = 'idle';
      this.cdr.markForCheck();
    }
  }

  async onSubmit(ev: Event) {
    ev.preventDefault();
    if (this.sendState === 'loading') return;

    const form =
      ev.target as HTMLFormElement;
    const fd = new FormData(form);

    const firstname = String(
      fd.get('firstname') ?? ''
    ).trim();
    const lastname = String(
      fd.get('lastname') ?? ''
    ).trim();
    const email = String(
      fd.get('email') ?? ''
    ).trim();
    const phone = String(
      fd.get('phone') ?? ''
    ).trim();
    const message = String(
      fd.get('message') ?? ''
    ).trim();
    const website = String(
      fd.get('website') ?? ''
    );
    const civ = String(
      fd.get('civ') ?? ''
    ).trim();
    const profil = String(
      fd.get('profil') ?? ''
    ).trim();

    const fullName = [firstname, lastname]
      .filter(Boolean)
      .join(' ')
      .trim();
    const lang = this.currentPath().startsWith(
      '/en/'
    )
      ? 'en'
      : 'fr';

    // Honeypot
    if (website) {
      this.sendState = 'success';
      form.reset();
      this.cdr.markForCheck();
      return;
    }

    if (
      !firstname ||
      !lastname ||
      !email ||
      !message
    ) {
      this.sendState = 'error';
      this.messageError =
        'Merci de renseigner Prénom, Nom, eMail et Message.';
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
      profil,
    };

    this.sendState = 'loading';
    this.messageError = '';
    this.cdr.markForCheck();

    try {
      await this.contact.send(payload);
      this.sendState = 'success';
      form.reset();
      this.cdr.markForCheck();
    } catch (e: any) {
      console.error('[Contact] API error', e);
      this.sendState = 'error';
      this.messageError =
        e?.message ||
        'Échec de l’envoi.';
      this.cdr.markForCheck();

      setTimeout(() => {
        this.sendState = 'idle';
        this.cdr.markForCheck();
      }, 3000);
    }
  }
}
