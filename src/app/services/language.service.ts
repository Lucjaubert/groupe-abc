// src/app/services/language.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, filter } from 'rxjs';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { WeglotService } from './weglot.service';

export type Lang = 'fr' | 'en';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly lang$ = new BehaviorSubject<Lang>('fr');
  get lang(): Lang { return this.lang$.value; }

  private weglotReady = false;
  private bindingDone = false;

  constructor(
    private router: Router,
    private wg: WeglotService,
    @Inject(DOCUMENT) private doc: Document,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Langue initiale : déduite de l'URL (mais sans réécrire l'URL)
    const initial = this.detectFromUrl() ?? this.getRememberedLang() ?? 'fr';
    this.lang$.next(initial);
    this.applyHtmlLang(initial);

    // Sur navigation : on met à jour lang$ en fonction de l'URL
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        const fromUrl = this.detectFromUrl() ?? 'fr';
        if (fromUrl !== this.lang) {
          this.lang$.next(fromUrl);
          this.applyHtmlLang(fromUrl);
          this.rememberLang(fromUrl);
          this.safeSwitch(fromUrl);
        }
      });

    // Weglot prêt → on aligne + on écoute ses changements
    this.wg.ready$.subscribe(ok => {
      if (!ok || this.bindingDone || !isPlatformBrowser(this.platformId)) return;
      this.bindingDone = true;
      this.weglotReady = true;

      this.safeSwitch(this.lang);

      try {
        window.Weglot?.on?.('languageChanged', () => {
          const w = window.Weglot;
          const wlang = w?.getCurrentLang?.() ?? w?.getCurrentLanguage?.();
          const l: Lang = (wlang === 'en' ? 'en' : 'fr');
          if (l !== this.lang) {
            // on met à jour l'état, mais on NE TOUCHE PAS à l'URL ici
            this.lang$.next(l);
            this.applyHtmlLang(l);
            this.rememberLang(l);
          }
        });
      } catch {}
    });
  }

  /** Appelé par le header quand on clique sur FR/EN */
  set(l: Lang): void {
    if (l === this.lang) {
      this.applyHtmlLang(l);
      this.safeSwitch(l);
      this.rememberLang(l);
      return;
    }
    this.lang$.next(l);
    this.applyHtmlLang(l);
    this.safeSwitch(l);
    this.rememberLang(l);
  }

  toggle(): void {
    this.set(this.lang === 'fr' ? 'en' : 'fr');
  }

  // ========== privé ==========

  private detectFromUrl(): Lang | null {
    const path = this.safePathname().replace(/\/{2,}/g, '/');
    return (path === '/en' || path.startsWith('/en/')) ? 'en' : 'fr';
  }

  private safePathname(): string {
    if (isPlatformBrowser(this.platformId)) {
      try {
        return this.doc.defaultView?.location?.pathname || '/';
      } catch {
        return '/';
      }
    }
    try {
      return (this.router.url || '/').split('?')[0].split('#')[0];
    } catch {
      return '/';
    }
  }

  private applyHtmlLang(l: Lang): void {
    try {
      this.doc.documentElement.setAttribute('lang', l);
    } catch {}
  }

  private safeSwitch(l: Lang): void {
    if (!isPlatformBrowser(this.platformId) || !this.weglotReady) return;
    try {
      const w = window.Weglot;
      const curr = w?.getCurrentLang?.() ?? w?.getCurrentLanguage?.();
      if (curr !== l) {
        w?.switchTo?.(l);
      }
    } catch {}
  }

  private rememberLang(l: Lang): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem('lang', l);
    } catch {}
  }

  private getRememberedLang(): Lang | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const v = localStorage.getItem('lang');
      return v === 'fr' || v === 'en' ? v : null;
    } catch {
      return null;
    }
  }
}
