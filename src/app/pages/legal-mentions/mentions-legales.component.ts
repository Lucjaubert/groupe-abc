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
  private seo    = inject(SeoService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    const isEN    = this.currentPath().startsWith('/en/');
    const siteUrl = (environment.siteUrl || '').replace(/\/+$/,'') || 'https://groupe-abc.fr';
    const pathFR  = '/mentions-legales';
    const pathEN  = '/en/legal-notice';

    const canonical = isEN ? `${siteUrl}${pathEN}` : `${siteUrl}${pathFR}`;
    const lang      = isEN ? 'en'    : 'fr';
    const locale    = isEN ? 'en_US' : 'fr_FR';
    const localeAlt = isEN ? ['fr_FR'] : ['en_US'];

    const alternates = [
      { lang: 'fr',        href: `${siteUrl}${pathFR}` },
      { lang: 'en',        href: `${siteUrl}${pathEN}` },
      { lang: 'x-default', href: `${siteUrl}${pathFR}` }
    ];

    const titleFR = 'Mentions légales – Groupe ABC';
    const titleEN = 'Legal notice – Groupe ABC';
    const descFR  = 'Informations et mentions légales du site groupe-abc.fr (éditeur, hébergement, médiation, propriété intellectuelle, cookies, données personnelles).';
    const descEN  = 'Legal information for groupe-abc.fr (publisher, hosting, mediation, intellectual property, cookies, personal data).';

    const title = isEN ? titleEN : titleFR;
    const description = isEN ? descEN : descFR;

    const logo = `${siteUrl}/assets/favicons/android-chrome-512x512.png`;
    const og   = `${siteUrl}/assets/og/og-default.jpg`;

    this.seo.update({
      title,
      description,
      lang,
      locale,
      localeAlt,
      canonical,
      robots: 'index,follow',
      image: og,
      imageAlt: isEN ? 'Groupe ABC – Legal Notice' : 'Groupe ABC – Mentions légales',
      imageWidth: 1200,
      imageHeight: 630,
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
            logo: { '@type': 'ImageObject', url: logo, width: 512, height: 512 },
            sameAs: ['https://www.linkedin.com/company/groupe-abc']
          },
          {
            '@type': 'WebPage',
            '@id': `${canonical}#webpage`,
            url: canonical,
            name: title,
            description,
            inLanguage: isEN ? 'en-US' : 'fr-FR',
            isPartOf: { '@id': `${siteUrl}/#website` },
            primaryImageOfPage: { '@type': 'ImageObject', url: og }
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: isEN ? 'Home' : 'Accueil', item: siteUrl + '/' },
              { '@type': 'ListItem', position: 2, name: isEN ? 'Legal notice' : 'Mentions légales', item: canonical }
            ]
          }
        ]
      }
    });
  }


  private currentPath(): string {
    if (isPlatformBrowser(this.platformId)) {
      try { return window?.location?.pathname || this.router?.url || '/'; } catch { return this.router?.url || '/'; }
    }
    return this.router?.url || '/';
  }
}
