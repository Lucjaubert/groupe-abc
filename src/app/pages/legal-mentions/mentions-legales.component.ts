import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

import { SeoService } from '../../services/seo.service';
import { getSeoForRoute } from '../../config/seo.routes';

@Component({
  selector: 'app-mentions-legales',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './mentions-legales.component.html',
  styleUrls: ['./mentions-legales.component.scss'],
})
export class MentionsLegalesComponent implements OnInit {
  private router     = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private seo        = inject(SeoService);

  // Titres SSR-ready (FR/EN)
  pageTitle    = 'Mentions légales';
  pageSubtitle = 'Informations légales du Groupe ABC';

  private get isEN(): boolean {
    return this.currentPath().startsWith('/en/');
  }

  ngOnInit(): void {
    // H1/H2 selon langue (SSR-safe)
    if (this.isEN) {
      this.pageTitle    = 'Legal notice';
      this.pageSubtitle = 'Legal information for Groupe ABC';
    } else {
      this.pageTitle    = 'Mentions légales';
      this.pageSubtitle = 'Informations légales du Groupe ABC';
    }

    // SEO centralisé
    this.applySeoFromConfig();
  }

  private currentPath(): string {
    if (isPlatformBrowser(this.platformId)) {
      try {
        return (
          window?.location?.pathname ||
          this.router?.url ||
          '/'
        );
      } catch {
        return this.router?.url || '/';
      }
    }
    return this.router?.url || '/';
  }

  /* ========================= SEO centralisé ========================= */

  private applySeoFromConfig(): void {
    const lang: 'fr' | 'en' = this.isEN ? 'en' : 'fr';

    // ⚠️ Adapte 'legal' au key réel dans ton seo.routes si besoin
    const baseSeo = getSeoForRoute('legal', lang);

    const canonical = (baseSeo.canonical || '').replace(/\/+$/, '');
    let origin = 'https://groupe-abc.fr';

    try {
      if (canonical) {
        const u = new URL(canonical);
        origin = `${u.protocol}//${u.host}`;
      }
    } catch {
      // fallback sur domaine par défaut
    }

    const website = {
      '@type': 'WebSite',
      '@id': `${origin}#website`,
      url: origin,
      name: 'Groupe ABC',
      inLanguage: lang === 'en' ? 'en-US' : 'fr-FR',
    };

    const organization = {
      '@type': 'Organization',
      '@id': `${origin}#organization`,
      name: 'Groupe ABC',
      url: origin,
      sameAs: [
        'https://www.linkedin.com/company/groupe-abc-experts/',
      ],
    };

    const webpage = {
      '@type': 'WebPage',
      '@id': `${canonical || origin}#webpage`,
      url: canonical || origin,
      name: baseSeo.title,
      description: baseSeo.description,
      inLanguage: lang === 'en' ? 'en-US' : 'fr-FR',
      isPartOf: { '@id': `${origin}#website` },
    };

    const breadcrumb = {
      '@type': 'BreadcrumbList',
      '@id': `${canonical || origin}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: lang === 'en' ? 'Home' : 'Accueil',
          item: origin,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: lang === 'en' ? 'Legal notice' : 'Mentions légales',
          item:
            canonical ||
            `${origin}${
              lang === 'en' ? '/en/legal-notice' : '/mentions-legales'
            }`,
        },
      ],
    };

    this.seo.update({
      ...baseSeo,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [website, organization, webpage, breadcrumb],
      },
    });
  }
}
