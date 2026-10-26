import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class RgpdService {
  private readonly isBrowser: boolean;
  private started = false;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    @Inject(DOCUMENT) private doc: Document,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /** Charge tarteaucitron UNIQUEMENT dans le navigateur, puis pilote GTM en mode consentement. */
  init(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;

    const w = this.doc.defaultView as any;
    if (!w) return;

    // Langue FR forcée AVANT le chargement de la lib (lue par tarteaucitron à l'exécution)
    w.tarteaucitronForceLanguage = 'fr';

    const s = this.doc.createElement('script');
    s.src = '/assets/tarteaucitron/tarteaucitron.js';
    s.async = true;
    s.onload = () => this.configure(w);
    s.onerror = () => console.error('[RGPD] tarteaucitron load error');
    this.doc.body.appendChild(s);
  }

  private configure(w: any): void {
    const tarteaucitron = w.tarteaucitron;
    if (!tarteaucitron) return;

    tarteaucitron.init({
      privacyUrl: '/mentions-legales',   // lien politique/confidentialité de la bannière
      orientation: 'bottom',             // bannière en bas
      iconPosition: 'BottomLeft',        // icône de réouverture en bas-gauche (évite le FAB mail en bas-droite)
      showAlertSmall: false,
      cookieslist: false,
      AcceptAllCta: true,                // « Tout accepter »
      DenyAllCta: true,                  // « Tout refuser » — visible, même poids (défaut tarteaucitron)
      highPrivacy: true,                 // rien n'est déposé avant action explicite, pas de consentement implicite
      googleConsentMode: false,          // hard-gate : GTM ne se charge PAS avant acceptation (pas de Consent Mode « denied »)
      handleBrowserDNTRequest: false,
      removeCredit: false,
      moreInfoLink: true,
      useExternalCss: false,
      useExternalJs: false,
      mandatory: true,
      mandatoryCta: true,
      groupServices: false,
    });

    // Service natif GTM : se charge UNIQUEMENT après acceptation, ne dépose rien avant
    tarteaucitron.user.googletagmanagerId = 'GTM-TK8NSMS8';
    (tarteaucitron.job = tarteaucitron.job || []).push('googletagmanager');
  }
}
