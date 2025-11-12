import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { SeoService } from '../../services/seo.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-mentions-legales',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './mentions-legales.component.html',
  styleUrls: ['./mentions-legales.component.scss'],
})
export class MentionsLegalesComponent implements OnInit {
  private seo        = inject(SeoService);
  private router     = inject(Router);
  private platformId = inject(PLATFORM_ID);

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

    const siteUrl = (environment.siteUrl || '').replace(/\/+$/, '') || 'https://groupe-abc.fr';
    const pathFR  = '/mentions-legales';
    const pathEN  = '/en/legal-notice';

    const canonicalAbs = this.isEN ? `${siteUrl}${pathEN}` : `${siteUrl}${pathFR}`;
    const lang         = this.isEN ? 'en'    : 'fr';
    const locale       = this.isEN ? 'en_US' : 'fr_FR';
    const localeAlt    = this.isEN ? ['fr_FR'] : ['en_US'];

    const alternates = [
      { lang: 'fr',        href: `${siteUrl}${pathFR}` },
      { lang: 'en',        href: `${siteUrl}${pathEN}` },
      { lang: 'x-default', href: `${siteUrl}${pathFR}` },
    ];

    const titleFR = 'Mentions légales – Groupe ABC';
    const titleEN = 'Legal notice – Groupe ABC';
    const descFR  =
      'Informations et mentions légales du site groupe-abc.fr (éditeur, hébergement, médiation, propriété intellectuelle, cookies, données personnelles).';
    const descEN  =
      'Legal information for groupe-abc.fr (publisher, hosting, mediation, intellectual property, cookies, personal data).';

    const title = this.isEN ? titleEN : titleFR;
    const description = this.isEN ? descEN : descFR;

    const ogAbs = `${siteUrl}/assets/og/og-default.jpg`;

    // IDs alignés sur le setSitewideJsonLd global (app.component)
    const siteId = `${siteUrl}#website`;
    const orgId  = `${siteUrl}#org`;

    const webPage = {
      '@type': 'WebPage',
      '@id': `${canonicalAbs}#webpage`,
      url: canonicalAbs,
      name: title,
      description,
      inLanguage: this.isEN ? 'en-US' : 'fr-FR',
      isPartOf: { '@id': siteId },
      about: { '@id': orgId },
      primaryImageOfPage: ogAbs,
    };

    const breadcrumb = {
      '@type': 'BreadcrumbList',
      '@id': `${canonicalAbs}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: this.isEN ? 'Home' : 'Accueil',
          item: siteUrl + '/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: this.isEN ? 'Legal notice' : 'Mentions légales',
          item: canonicalAbs,
        },
      ],
    };

    this.seo.update({
      title,
      description,
      lang,
      locale,
      localeAlt,
      canonical: canonicalAbs,
      robots: 'index,follow',
      image: ogAbs,
      imageAlt: this.isEN
        ? 'Groupe ABC – Legal notice'
        : 'Groupe ABC – Mentions légales',
      imageWidth: 1200,
      imageHeight: 630,
      type: 'website',
      alternates,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [webPage, breadcrumb],
      },
    });
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
}
