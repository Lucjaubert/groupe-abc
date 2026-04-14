import { CommonModule, ViewportScroller, isPlatformBrowser } from '@angular/common';
import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  Renderer2,
} from '@angular/core';
import {
  NavigationEnd,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { Subscription } from 'rxjs';

import { HeaderComponent } from './shared/components/header/header.component';
import {
  FooterComponent,
  FooterSection,
} from './shared/components/footer/footer.component';
import { ContactFabComponent } from './shared/components/faq-bubble/contact-fab.component';

import { SeoService } from './services/seo.service';
import { WeglotRefreshService } from './services/weglot-refresh.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    HeaderComponent,
    FooterComponent,
    ContactFabComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'groupe-abc';
  currentRoute = '';
  showFooter = true;

  private routerSub?: Subscription;
  private didInitSitewide = false;

  footerData: FooterSection = {
    title: 'Prise de contact rapide',
    subtitle: 'Parlez à un expert du Groupe ABC',
    phone_label: 'Téléphone',
    phone: '+33 1 23 45 67 89',
    email_label: 'Email',
    email: 'contact@groupe-abc.fr',
    address_label: 'Adresse',
    address: '12 rue Exemple, 75000 Paris',
    cta_text: 'Nous écrire',
    cta_url: '/contact-expert-immobilier',
    links: [
      { label: 'Mentions légales', url: '/mentions-legales' },
      { label: 'Politique de confidentialité', url: '/politique-de-confidentialite' },
      { label: 'Cookies', url: '/cookies' },
    ],
    socials: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/groupe-abc-experts/' },
    ],
  };

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private renderer: Renderer2,
    private viewport: ViewportScroller,
    private seo: SeoService,
    private _wgRefresh: WeglotRefreshService
  ) {}

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    // ============================================
    // 1) JSON-LD sitewide (SSR OK) — une seule fois
    // ============================================
    this.initSitewideJsonLdOnce();

    // =========================
    // 2) Routing / SEO / UX
    // =========================
    this.routerSub = this.router.events.subscribe((evt) => {
      if (evt instanceof NavigationStart) {
        this.showFooter = false;
      }

      if (evt instanceof NavigationEnd) {
        this.currentRoute = evt.urlAfterRedirects || evt.url;
        this.showFooter = true;

        // ✅ IMPORTANT : SEO update doit tourner AUSSI en SSR
        // -> canonical + hreflang injectés dans le HTML SSR
        this.applySeoForRoute(this.currentRoute);

        // ✅ Tout ce qui touche au DOM / scroll / Weglot => browser only
        if (!this.isBrowser) return;

        // Scroll top (SSR-friendly)
        try {
          this.viewport.scrollToPosition([0, 0]);
        } catch {}

        // Classe body (browser only)
        try {
          if (this.currentRoute.includes('/contact-expert-immobilier')) {
            this.renderer.addClass(document.body, 'contact-page');
          } else {
            this.renderer.removeClass(document.body, 'contact-page');
          }
        } catch {}

        // Weglot refresh (browser only)
        try {
          this._wgRefresh.refresh();
        } catch {}
      }
    });

    // ✅ Bonus : au premier rendu SSR, il n’y a pas toujours de NavigationEnd “immédiat”
    // On applique quand même un SEO minimal sur l’URL courante connue par le Router.
    try {
      const initial = this.router.url || '/';
      this.currentRoute = initial;
      this.applySeoForRoute(initial);
    } catch {}
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  /* =========================================================
   * Sitewide JSON-LD
   * ======================================================= */

  private initSitewideJsonLdOnce(): void {
    if (this.didInitSitewide) return;
    this.didInitSitewide = true;

    const origin = (environment.siteUrl || 'https://groupe-abc.fr').replace(/\/+$/, '');
    const logoUrl = `${origin}/assets/img/header/logo-groupe-abc.webp`;

    this.seo.setSitewideJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${origin}#organization`,
          name: 'Groupe ABC',
          url: origin,
          logo: {
            '@type': 'ImageObject',
            '@id': `${origin}#logo`,
            url: logoUrl,
            contentUrl: logoUrl,
            width: 512,
            height: 512,
          },
          sameAs: ['https://www.linkedin.com/company/groupe-abc-experts/'],
        },
        {
          '@type': 'WebSite',
          '@id': `${origin}#website`,
          url: origin,
          name: 'Groupe ABC',
          inLanguage: ['fr-FR', 'en-US'],
          publisher: { '@id': `${origin}#organization` },
          potentialAction: {
            '@type': 'SearchAction',
            target: `${origin}/?s={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        },
      ],
    });
  }

  /* =========================================================
   * SEO minimal “root-level” (SSR + browser)
   * - L’objectif : canonical + hreflang présents dès SSR
   * - Tes pages peuvent ensuite surcharger avec getSeoForRoute(...)
   * ======================================================= */

  private applySeoForRoute(url: string): void {
    const origin = (environment.siteUrl || 'https://groupe-abc.fr').replace(/\/+$/, '');
    const path = this.stripQueryHash(url || '/');

    // Déduire lang depuis la route (scope /en)
    const isEn = path === '/en' || path.startsWith('/en/');
    const lang: 'fr' | 'en' = isEn ? 'en' : 'fr';

    // Canonical absolu : l’objectif est d’être strict et stable
    const canonicalAbs = new URL(path, origin).toString();

    // Image par défaut
    const img = `${origin}/assets/img/seo/og-default.webp`;

    // Title / description fallback (tes pages peuvent écraser ensuite)
    const title = isEn
      ? 'Groupe ABC — Chartered real estate valuation'
      : 'Groupe ABC — Expertise immobilière certifiée';
    const description = isEn
      ? 'National network of chartered real estate valuation experts.'
      : 'Réseau national d’experts immobiliers agréés.';

    this.seo.update({
      title,
      description,
      lang,
      canonical: canonicalAbs,
      image: img,
      type: 'website',
      robots: 'index,follow',
      // alternates/hreflang seront auto-construits par SeoService via ALT_MAP + rules
    });
  }

  private stripQueryHash(u: string): string {
    const s = (u || '/').split(/[?#]/)[0] || '/';
    return s.startsWith('/') ? s : `/${s}`;
  }
}
