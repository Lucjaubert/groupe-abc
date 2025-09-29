import { CommonModule } from '@angular/common';
import {
  Component, Input, OnInit, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, ViewChildren, QueryList, inject
} from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SeoService } from '../../services/seo.service';
import { ImgFromPipe } from '../../pipes/img-from.pipe';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [ CommonModule, ImgFromPipe ],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent implements OnInit, AfterViewInit, OnDestroy {

  /* ====== SEO – Inputs configurables ====== */
  /** Domaine du site (utilisé pour canonical & JSON-LD) */
  @Input() siteUrl         = 'https://groupe-abc.fr';
  /** Chemin canonique FR de la page */
  @Input() canonicalPath   = '/contact';
  /** Chemin canonique EN de la page */
  @Input() canonicalPathEn = '/en/contact';

  /** Nom de l’organisation (pour Title/JSON-LD) */
  @Input() orgName         = 'Groupe ABC';

  /** Coordonnées (déjà affichées dans le template) */
  @Input() streetAddress   = '18 rue Pasquier';
  @Input() postalCode      = '75008';
  @Input() addressLocality = 'Paris';
  @Input() phoneIntl       = '+33178414441';
  @Input() phoneDisplay    = '01 78 41 44 41';
  @Input() email           = 'contact@groupe-abc.fr';

  /** Réseaux */
  @Input() linkedinUrl     = 'https://www.linkedin.com/company/groupe-abc-experts/';

  /** Image sociale de fallback pour OG/Twitter */
  @Input() socialImage     = '/assets/og/og-default.jpg';

  private seo = inject(SeoService);

  /* ===== Refs ===== */
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

  /* ==================================================== */
  /*                       LIFECYCLE                      */
  /* ==================================================== */
  ngOnInit(): void {
    // SEO côté serveur (SSR) dès l'init
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

  /* ==================================================== */
  /*                         SEO                           */
  /* ==================================================== */
  /* ==================================================== */
/*                         SEO                           */
/* ==================================================== */
private applySeo(): void {
  const nowPath = this.currentPath();
  const isEN    = nowPath.startsWith('/en/');

  // Canonicals par langue
  const canonPath = isEN ? this.canonicalPathEn : this.canonicalPath;
  const canonical = this.normalizeUrl(this.siteUrl, canonPath);

  // Langues / locales
  const lang      = isEN ? 'en'    : 'fr';
  const locale    = isEN ? 'en_US' : 'fr_FR';
  const localeAlt = isEN ? ['fr_FR'] : ['en_US'];

  // Alternates hreflang
  const altFR = this.normalizeUrl(this.siteUrl, this.canonicalPath);
  const altEN = this.normalizeUrl(this.siteUrl, this.canonicalPathEn);
  const alternates = [
    { lang: 'fr',        href: altFR },
    { lang: 'en',        href: altEN },
    { lang: 'x-default', href: altFR }
  ];

  // Title / description localisés (intègrent les infos métier)
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

  const description = (isEN ? descEN : descFR).slice(0, 300); // on reste concis

  // Keywords orientées métier
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

  // Image OG (absolutiser si besoin)
  const og = this.socialImage || '/assets/og/og-default.jpg';
  const ogAbs = this.absUrl(og, this.siteUrl);
  const isDefaultOg = /\/og-default\.jpg$/.test(og);

  // IDs JSON-LD
  const siteId = this.siteUrl.replace(/\/+$/, '') + '#website';
  const orgId  = this.siteUrl.replace(/\/+$/, '') + '#organization';

  // Organization enrichie (associations, zones, savoir-faire)
  const organization = {
    '@type': 'Organization',
    '@id': orgId,
    name: this.orgName,
    url: this.siteUrl,
    sameAs: [ this.linkedinUrl ].filter(Boolean),
    memberOf: [
      { '@type': 'Organization', name: 'RICS',  url: 'https://www.rics.org' },
      { '@type': 'Organization', name: 'IFEI',  url: 'https://www.ifei.org' },
      { '@type': 'Organization', name: 'CNEJI', url: 'https://www.cneji.org' }
    ],
    knowsAbout: [
      'évaluation immobilière','property appraisal','DCF','méthode par comparaison','méthode par rendement',
      'résidentiel','commercial','tertiaire','industriel','hôtellerie','loisirs','santé','foncier','terrains'
    ],
    areaServed: ['FR','GP','RE','MQ','GF','YT','PF','NC','PM','WF','BL','MF'], // France + DOM-TOM
    contactPoint: [{
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: this.phoneIntl,
      email: this.email,
      areaServed: ['FR','EU'],
      availableLanguage: ['fr-FR','en-US']
    }],
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
      // langue & locales
      lang, locale, localeAlt,

      // metas principales
      title,
      description,
      keywords: isEN ? kwEN : kwFR,
      canonical,
      robots: 'index,follow',

      // Open Graph / Twitter
      image: ogAbs,
      imageAlt: `${this.orgName} – Contact`,
      ...(isDefaultOg ? { imageWidth: 1200, imageHeight: 630 } : {}),
      type: 'website',

      // hreflang
      alternates,

      // JSON-LD
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            '@id': siteId,
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


  /* ==================================================== */
  /*                        UTILS SEO                      */
  /* ==================================================== */
  private normalizeUrl(base: string, path: string): string {
    const b = base.endsWith('/') ? base.slice(0, -1) : base;
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${b}${p}`;
  }

  private absUrl(url: string, origin: string): string {
    if (!url) return '';
    try {
      if (/^https?:\/\//i.test(url)) return url;                    // absolue
      if (/^\/\//.test(url)) return 'https:' + url;                 // protocole-relative
      const o = origin.endsWith('/') ? origin.slice(0, -1) : origin;
      return url.startsWith('/') ? o + url : `${o}/${url}`;         // relative
    } catch { return url; }
  }

  private currentPath(): string {
    try { return window?.location?.pathname || '/'; } catch { return '/'; }
  }

  /* ==================================================== */
  /*                        UTILS UI                       */
  /* ==================================================== */
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

  /* ==================================================== */
  /*                      ANIMATIONS                       */
  /* ==================================================== */
  private bindAnimations(): void {
    const host = (document.querySelector('.contact-page') as HTMLElement) || document.body;
    this.forceInitialHidden(host);
    try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch {}

    const EASE = 'power3.out';
    const rm = (els: Element | Element[]) =>
      (Array.isArray(els) ? els : [els]).forEach(el => el.classList.remove('prehide','prehide-row'));

    /* --- HERO --- */
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

    /* --- RADIOS --- */
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

    /* --- FORM GRID --- */
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

    /* --- BOUTON ENVOYER --- */
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

    /* --- BIG INFOS --- */
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
}
