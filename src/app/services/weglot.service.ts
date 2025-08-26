import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

declare global {
  interface Window { Weglot?: any; }
}

@Injectable({ providedIn: 'root' })
export class WeglotService {
  private loaded = false;

  // → émet true quand Weglot est prêt (init OK côté navigateur)
  private readySubj = new BehaviorSubject<boolean>(false);
  readonly ready$ = this.readySubj.asObservable();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  /** Chargé par APP_INITIALIZER */
  async init(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return; // SSR guard
    if (this.loaded) return;

    // 🚫 Désactive Weglot si aucune clé n’est configurée (staging/local)
    if (!environment.weglotApiKey) {
      console.warn('[Weglot] Aucune clé API détectée — Weglot désactivé.');
      return;
    }

    if (!window.Weglot) {
      await this.loadScript('https://cdn.weglot.com/weglot.min.js');
    }

    // 🔎 Debug: affiche la clé réellement utilisée
    console.log('[Weglot] Using API key:', environment.weglotApiKey);

    try {
      window.Weglot!.initialize({
        api_key: environment.weglotApiKey,
        originalLanguage: 'fr',
        destinationLanguages: ['en'],
      });

      this.loaded = true;
      this.readySubj.next(true);
      console.log('[Weglot] Initialized OK');
    } catch (e: any) {
      // ⚠️ En cas de 403, Weglot loguera aussi "project deleted" côté CDN
      console.error('[Weglot] init failed:', e);
      this.readySubj.next(false);
    }
  }

  /** FR ↔ EN */
  switchTo(code: 'fr' | 'en') {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      if (!this.loaded) {
        console.warn('[Weglot] switchTo appelé avant init; tentative forcée:', code);
      }
      window.Weglot?.switchTo?.(code);
    } catch (e) {
      console.error('[Weglot] switchTo failed:', e);
    }
  }

  /** Charge le script Weglot dynamiquement */
  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Weglot CDN failed to load'));
      document.head.appendChild(s);
    });
  }
}
