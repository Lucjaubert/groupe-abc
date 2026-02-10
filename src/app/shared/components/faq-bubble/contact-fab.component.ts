import { Component, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-contact-fab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './contact-fab.component.html',
  styleUrls: ['./contact-fab.component.scss'],
})
export class ContactFabComponent {
  private router = inject(Router);
  private doc = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);

  get label(): string {
    return this.isEnglish() ? 'Contact' : 'Contacter Groupe ABC';
  }

  goToContact(): void {
    const target = this.isEnglish()
      ? '/en/contact-chartered-valuers'
      : '/contact-expert-immobilier';

    this.router.navigateByUrl(target);
  }

  private isEnglish(): boolean {
    // 1) Priorité: <html lang="en">
    try {
      const lang = (this.doc?.documentElement?.lang || '').toLowerCase();
      if (lang.startsWith('en')) return true;
      if (lang.startsWith('fr')) return false;
    } catch {}

    // 2) Fallback : URL (SSR-safe via Router)
    try {
      const path = (this.router.url || '/').split(/[?#]/)[0];
      return path === '/en' || path.startsWith('/en/');
    } catch {}

    // 3) Fallback browser-only : window.location.pathname (optionnel)
    if (isPlatformBrowser(this.platformId)) {
      try {
        const p = this.doc.defaultView?.location?.pathname || '/';
        return p === '/en' || p.startsWith('/en/');
      } catch {}
    }

    return false;
  }
}
