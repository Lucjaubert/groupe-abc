import { CommonModule, DOCUMENT, isPlatformBrowser, isPlatformServer } from '@angular/common';
import { Component, Inject, OnInit, Optional, AfterViewInit, PLATFORM_ID } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { SeoService } from '../../services/seo.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './not-found.component.html',
  styleUrls: ['./not-found.component.scss'],
})
export class NotFoundComponent implements OnInit, AfterViewInit {
  /** Textes i18n dynamiques dans le template */
  titleText   = '404 – Page introuvable';
  subtitleText = 'Oups, la page que vous cherchez n’existe pas (ou plus).';
  leadText    = 'Vérifiez l’URL saisie ou retournez à l’accueil pour poursuivre votre visite.';
  backLabel   = 'Retour à l’accueil';

  private isEN = false;

  constructor(
    private router: Router,
    private seo: SeoService,
    @Inject(PLATFORM_ID) private platformId: Object,
    // Token fourni par le bootstrap SSR (ex: dans server.ts via providers)
    @Optional() @Inject('SSR_RESPONSE') private res: any,
    @Optional() @Inject(DOCUMENT) private doc: Document
  ) {}

  ngOnInit(): void {
    const siteUrl = (environment.siteUrl || '').replace(/\/+$/,'') || 'https://groupe-abc.fr';
    const path    = this.safePath();
    this.isEN     = path.startsWith('/en/');

    // ——— i18n des libellés
    if (this.isEN) {
      this.titleText    = '404 – Page not found';
      this.subtitleText = `Oops, the page you're looking for doesn't exist (or doesn't exist anymore).`;
      this.leadText     = 'Check the entered URL or return to the home page to continue your visit.';
      this.backLabel    = 'Back to home page';
    }

    const titleFR = '404 – Page introuvable | Groupe ABC';
    const titleEN = '404 – Page not found | Groupe ABC';
    const descFR  = 'La page demandée est introuvable. Vérifiez l’URL ou retournez à l’accueil du Groupe ABC.';
    const descEN  = 'The requested page could not be found. Check the URL or return to the Groupe ABC homepage.';

    // 🔒 Pas de canonical/hreflang sur une 404 ; on force noindex/nofollow
    this.seo.update({
      title: this.isEN ? titleEN : titleFR,
      description: this.isEN ? descEN : descFR,
      lang: this.isEN ? 'en' : 'fr',
      locale: this.isEN ? 'en_US' : 'fr_FR',
      localeAlt: this.isEN ? ['fr_FR'] : ['en_US'],
      robots: 'noindex,nofollow',
      // NOTE: on n’envoie PAS de canonical/alternates pour 404
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            '@id': `${siteUrl}/#website`,
            url: siteUrl,
            name: 'Groupe ABC',
            inLanguage: this.isEN ? 'en-US' : 'fr-FR'
          },
          {
            '@type': 'WebPage',
            '@id': `${siteUrl}${path}#webpage`,
            url: `${siteUrl}${path}`,
            name: this.isEN ? titleEN : titleFR,
            description: this.isEN ? descEN : descFR,
            inLanguage: this.isEN ? 'en-US' : 'fr-FR',
            isPartOf: { '@id': `${siteUrl}/#website` }
          }
        ]
      }
    });

    // ✅ Poser le status 404 & entêtes robots côté SSR uniquement
    if (isPlatformServer(this.platformId) && this.res?.status) {
      try {
        this.res.status(404);
        this.res.setHeader?.('X-Robots-Tag', 'noindex, nofollow');
        this.res.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      } catch { /* ignore */ }
    }
  }

  ngAfterViewInit(): void {
    // ✅ Nettoyage DOM côté navigateur : retirer canonical/hreflang si un résidu existe
    if (isPlatformBrowser(this.platformId) && this.doc) {
      try {
        const head = this.doc.head;
        // Supprime <link rel="canonical">
        Array.from(head.querySelectorAll('link[rel="canonical"]')).forEach(el => el.remove());
        // Supprime <link rel="alternate" hreflang="...">
        Array.from(head.querySelectorAll('link[rel="alternate"][hreflang]')).forEach(el => el.remove());
        // Force meta robots noindex
        let robots = head.querySelector('meta[name="robots"]');
        if (!robots) {
          robots = this.doc.createElement('meta');
          robots.setAttribute('name', 'robots');
          head.appendChild(robots);
        }
        robots.setAttribute('content', 'noindex,nofollow');
      } catch { /* ignore */ }
    }
  }

  goToHomePage(): void {
    // Redirection cohérente avec la langue actuelle
    const target = this.isEN ? '/en' : '/';
    this.router.navigateByUrl(target);
  }

  /* ===== Helpers ===== */
  private safePath(): string {
    try {
      // en CSR
      const p = (this.doc?.defaultView?.location?.pathname || this.router?.url || '/') as string;
      return p || '/';
    } catch {
      // en SSR
      return this.router?.url || '/';
    }
  }
}
