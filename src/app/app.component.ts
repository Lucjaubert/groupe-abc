import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID, Renderer2 } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header.component';
import { FooterComponent, FooterSection } from './shared/components/footer/footer.component';
import { SeoService } from './services/seo.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, HeaderComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'groupe-abc';
  currentRoute = '';
  showFooter = true;

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
    cta_url: '/contact',
    links: [
      { label: 'Mentions légales', url: '/mentions-legales' },
      { label: 'Politique de confidentialité', url: '/politique-de-confidentialite' },
      { label: 'Cookies', url: '/cookies' }
    ],
    socials: [
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/groupe-abc-experts/' }
    ]
  };

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: any,
    private renderer: Renderer2,
    private seo: SeoService // ← injecte le service SEO
  ) {}

  ngOnInit(): void {
    // 1) JSON-LD “sitewide” injecté une seule fois au démarrage
    const origin = 'https://groupe-abc.fr'; // ← mets ton domaine prod
    const logoUrl = `${origin}/assets/brand/abc-logo-512.png`; // carré ≥112px (idéal 512x512)

    this.seo.setSitewideJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${origin}#website`,
          url: origin,
          name: 'Groupe ABC',
          publisher: { '@id': `${origin}#org` },
          potentialAction: {
            '@type': 'SearchAction',
            target: `${origin}/?s={search_term_string}`,
            'query-input': 'required name=search_term_string'
          }
        },
        {
          '@type': 'Organization',
          '@id': `${origin}#org`,
          name: 'Groupe ABC',
          url: origin,
          sameAs: ['https://www.linkedin.com/company/groupe-abc-experts/'],
          logo: {
            '@type': 'ImageObject',
            '@id': `${origin}#logo`,
            url: logoUrl,
            contentUrl: logoUrl,
            width: 512,
            height: 512
          }
        }
      ]
    });

    // 2) Ta logique de routing (inchangée)
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.showFooter = false;
      }

      if (event instanceof NavigationEnd) {
        this.currentRoute = event.url;
        this.showFooter = true;

        if (isPlatformBrowser(this.platformId)) {
          window.scrollTo({ top: 0, behavior: 'smooth' });

          if (this.currentRoute.includes('/contact')) {
            this.renderer.addClass(document.body, 'contact-page');
          } else {
            this.renderer.removeClass(document.body, 'contact-page');
          }
        }
      }
    });
  }
}
