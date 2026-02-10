// src/app/services/language.service.ts
import { Injectable, Inject, PLATFORM_ID, Optional, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription, filter } from 'rxjs';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { WeglotService } from './weglot.service';

export type Lang = 'fr' | 'en';

@Injectable({ providedIn: 'root' })
export class LanguageService implements OnDestroy {
  readonly lang$ = new BehaviorSubject<Lang>('fr');
  get lang(): Lang {
    return this.lang$.value;
  }

  private readonly isBrowser: boolean;

  private weglotReady = false;
  private bindingDone = false;

  private subs: Subscription[] = [];

  // Weglot listener cleanup
  private onWeglotChanged?: (...args: any[]) => void;

  constructor(
    private router: Router,
    private wg: WeglotService,
    @Inject(DOCUMENT) private doc: Document,
    @Inject(PLATFORM_ID) private platformId: Object,
    // Injecté par le SSR via { provide: 'SERVER_LANG', useValue: 'fr'|'en' }
    @Optional() @Inject('SERVER_LANG') private serverLang: Lang | null
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    // Langue initiale :
    // 1) URL (/en...)
    // 2) préférence mémorisée (localStorage)
    // 3) SSR (détection serveur)
    // 4) fallback fr
    const initial =
      this.detectFromUrl() ??
      this.getRememberedLang() ??
      (this.serverLang === 'en' || this.serverLang === 'fr' ? this.serverLang : null) ??
      'fr';

    this.lang$.next(initial);
    this.applyHtmlLang(initial);

    // Sur navigation : on met à jour lang$ en fonction de l'URL
    this.subs.push(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe(() => {
          const fromUrl = this.detectFromUrl() ?? 'fr';
          if (fromUrl !== this.lang) {
            this.lang$.next(fromUrl);
            this.applyHtmlLang(fromUrl);
            this.rememberLang(fromUrl);
            this.safeSwitch(fromUrl);
          }
        })
    );

    // Weglot prêt → on aligne + on écoute ses changements
    this.subs.push(
      this.wg.ready$.subscribe((ok) => {
        if (!ok || this.bindingDone || !this.isBrowser) return;
        this.bindingDone = true;
        this.weglotReady = true;

        this.safeSwitch(this.lang);

        // Bind event "languageChanged" + cleanup
        try {
          const w = this.winWeglot();
          if (!w?.on) return;

          this.onWeglotChanged = () => {
            const ww = this.winWeglot();
            const wlang = ww?.getCurrentLang?.() ?? ww?.getCurrentLanguage?.();
            const l: Lang = wlang === 'en' ? 'en' : 'fr';

            if (l !== this.lang) {
              // on met à jour l'état, mais on NE TOUCHE PAS à l'URL ici
              this.lang$.next(l);
              this.applyHtmlLang(l);
              this.rememberLang(l);
            }
          };

          w.on('languageChanged', this.onWeglotChanged);
        } catch {}
      })
    );
  }

  ngOnDestroy(): void {
    // Rx subscriptions
    this.subs.forEach((s) => {
      try {
        s.unsubscribe();
      } catch {}
    });
    this.subs = [];

    // Weglot off
    if (this.isBrowser && this.onWeglotChanged) {
      try {
        this.winWeglot()?.off?.('languageChanged', this.onWeglotChanged);
      } catch {}
    }
    this.onWeglotChanged = undefined;
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
    return path === '/en' || path.startsWith('/en/') ? 'en' : 'fr';
  }

  private safePathname(): string {
    if (this.isBrowser) {
      try {
        return this.doc.defaultView?.location?.pathname || '/';
      } catch {
        return '/';
      }
    }

    // SSR : router.url est le meilleur fallback disponible (si correctement initialisé)
    try {
      return (this.router.url || '/').split('?')[0].split('#')[0];
    } catch {
      return '/';
    }
  }

  private applyHtmlLang(l: Lang): void {
    // Si tu veux absolument le mettre aussi en SSR, fais-le côté serveur (index.html / template SSR).
    if (!this.isBrowser) return;

    try {
      this.doc.documentElement.setAttribute('lang', l);
    } catch {}
  }

  private winWeglot(): any | null {
    if (!this.isBrowser) return null;
    try {
      return (window as any).Weglot || null;
    } catch {
      return null;
    }
  }

  private safeSwitch(l: Lang): void {
    if (!this.isBrowser || !this.weglotReady) return;

    try {
      const w = this.winWeglot();
      const curr = w?.getCurrentLang?.() ?? w?.getCurrentLanguage?.();
      if (curr !== l) {
        w?.switchTo?.(l);
      }
    } catch {}
  }

  private rememberLang(l: Lang): void {
    if (!this.isBrowser) return;

    // localStorage (client)
    try {
      localStorage.setItem('lang', l);
    } catch {}

    // cookie (pour SSR)
    try {
      this.doc.cookie = `lang=${l};path=/;max-age=31536000;SameSite=Lax`;
    } catch {}
  }

  private getRememberedLang(): Lang | null {
    if (!this.isBrowser) return null;

    try {
      const v = localStorage.getItem('lang');
      return v === 'fr' || v === 'en' ? v : null;
    } catch {
      return null;
    }
  }
}
