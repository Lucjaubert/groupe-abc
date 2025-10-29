import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID, Renderer2 } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header.component';
import { FooterComponent, FooterSection } from './shared/components/footer/footer.component';
import { SeoService } from './services/seo.service';
import { WeglotRefreshService } from './services/weglot-refresh.service';
import { FaqBubbleComponent } from './shared/components/faq-bubble/faq-bubble.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, HeaderComponent, FooterComponent, FaqBubbleComponent],
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
    // ⬇️ Nouveau slug SEO (avant : /contact)
    cta_url: '/contact-expert-immobilier',
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
    private seo: SeoService,
    private _wgRefresh: WeglotRefreshService
  ) {}

  ngOnInit(): void {
    // JSON-LD sitewide conforme aux reco (Organization + WebSite)
    const origin = 'https://groupe-abc.fr';
    const logoUrl = `${origin}/assets/favicons/android-chrome-512x512.png`;
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

    // Routing / UX
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.showFooter = false;
      }

      if (event instanceof NavigationEnd) {
        this.currentRoute = event.url;
        this.showFooter = true;

        if (isPlatformBrowser(this.platformId)) {
          window.scrollTo({ top: 0, behavior: 'smooth' });

          // Classe body spécifique à la page Contact (penser au nouveau slug)
          if (this.currentRoute.includes('/contact-expert-immobilier')) {
            this.renderer.addClass(document.body, 'contact-page');
          } else {
            this.renderer.removeClass(document.body, 'contact-page');
          }
        }
      }
    });
  }
}
