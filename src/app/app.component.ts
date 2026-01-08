import { CommonModule, isPlatformBrowser } from '@angular/common';
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
import { FaqBubbleComponent } from './shared/components/faq-bubble/faq-bubble.component';

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
    FaqBubbleComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'groupe-abc';
  currentRoute = '';
  showFooter = true;

  private routerSub?: Subscription;

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
      {
        label: 'Politique de confidentialité',
        url: '/politique-de-confidentialite',
      },
      { label: 'Cookies', url: '/cookies' },
    ],
    socials: [
      {
        label: 'LinkedIn',
        url: 'https://www.linkedin.com/company/groupe-abc-experts/',
      },
    ],
  };

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private renderer: Renderer2,
    private seo: SeoService,
    private _wgRefresh: WeglotRefreshService
  ) {}

  ngOnInit(): void {
    // =========================
    // JSON-LD sitewide (Organization + WebSite)
    // =========================
    const origin = (environment.siteUrl || 'https://groupe-abc.fr').replace(
      /\/+$/,
      ''
    );
    // On utilise le même logo que dans le header
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

    // =========================
    // Routing / UX
    // =========================
    this.routerSub = this.router.events.subscribe((evt) => {
      if (evt instanceof NavigationStart) {
        this.showFooter = false;
      }

      if (evt instanceof NavigationEnd) {
        this.currentRoute = evt.urlAfterRedirects || evt.url;
        this.showFooter = true;

        if (isPlatformBrowser(this.platformId)) {
          try {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } catch {}

          if (this.currentRoute.includes('/contact-expert-immobilier')) {
            this.renderer.addClass(document.body, 'contact-page');
          } else {
            this.renderer.removeClass(document.body, 'contact-page');
          }

          // Weglot : rescans sur changement de route
          this._wgRefresh.refresh();
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }
}
