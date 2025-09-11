import { CommonModule } from '@angular/common';
import {
  Component, Input, OnInit, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, ViewChildren, QueryList, inject
} from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SeoService } from '../../services/seo.service'; // ← ajuste le chemin si besoin

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent implements OnInit, AfterViewInit, OnDestroy {

  /* ====== SEO (configurable) ====== */
  /** Domaine du site, utilisé pour canonical & JSON-LD */
  @Input() siteUrl       = 'https://groupe-abc.fr';
  /** Chemin canonique de la page contact */
  @Input() canonicalPath = '/contact';
  /** Nom de l’organisation (pour le title/JSON-LD) */
  @Input() orgName       = 'Groupe ABC';
  /** Coordonnées (apparaissent déjà dans le template) */
  @Input() streetAddress = '18 rue Pasquier';
  @Input() postalCode    = '75008';
  @Input() addressLocality = 'Paris';
  @Input() phoneIntl     = '+33178414441';
  @Input() phoneDisplay  = '01 78 41 44 41';
  @Input() email         = 'contact@groupe-abc.fr';

  /** Réseau social (déjà présent) */
  @Input() linkedinUrl   = 'https://www.linkedin.com/company/groupe-abc-experts/';

  /** Image sociale de fallback pour OG/Twitter (mets ton logo/cover) */
  @Input() socialImage   = this.siteUrl + '/assets/seo/og-default.jpg';

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
    // SEO: on définit title/desc/canonical/JSON-LD côté serveur (SSR)
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
  private applySeo(): void {
    const canonical = this.normalizeUrl(this.siteUrl, this.canonicalPath);

    // Title/Description concis & clairs (≤ 60/160 caractères)
    const title = `Contact – ${this.orgName} | Expertise immobilière`;
    const description =
      `Adresse : ${this.streetAddress}, ${this.postalCode} ${this.addressLocality}. ` +
      `Tél. ${this.phoneDisplay} · ${this.email} · LinkedIn.`;

    // JSON-LD: Organization + ContactPage + BreadcrumbList (graph)
    const orgId = this.siteUrl.replace(/\/+$/, '') + '#org';
    const organization = {
      '@type': 'Organization',
      '@id': orgId,
      name: this.orgName,
      url: this.siteUrl,
      sameAs: [ this.linkedinUrl ].filter(Boolean),
      contactPoint: [{
        '@type': 'ContactPoint',
        contactType: 'customer service',
        telephone: this.phoneIntl,
        email: this.email,
        areaServed: 'FR',
        availableLanguage: ['fr-FR']
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
      name: `Contact – ${this.orgName}`,
      url: canonical,
      about: { '@id': orgId },
      isPartOf: { '@id': this.siteUrl.replace(/\/+$/, '') + '#website' }
    };

    const breadcrumb = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: this.siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Contact', item: canonical }
      ]
    };

    this.seo.update({
      title,
      description,
      keywords: 'contact, expertise immobilière, Paris, téléphone, email, LinkedIn, Groupe ABC',
      canonical,
      robots: 'index,follow',
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          // Website (optionnel mais utile si non posé ailleurs)
          {
            '@type': 'WebSite',
            '@id': this.siteUrl.replace(/\/+$/, '') + '#website',
            url: this.siteUrl,
            name: this.orgName,
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

  private normalizeUrl(base: string, path: string): string {
    const b = base.endsWith('/') ? base.slice(0, -1) : base;
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${b}${p}`;
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
    const rm = (els: Element | Element[]) => (Array.isArray(els) ? els : [els]).forEach(el => el.classList.remove('prehide','prehide-row'));

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
