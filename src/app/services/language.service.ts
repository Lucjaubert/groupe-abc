// src/app/services/language.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Router, NavigationEnd, UrlTree } from '@angular/router';

export type Lang = 'fr' | 'en';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  /** Langue courante observable */
  readonly lang$ = new BehaviorSubject<Lang>('fr');

  /** Getter pratique */
  get lang(): Lang { return this.lang$.value; }

  constructor(
    private router: Router,
    @Inject(DOCUMENT) private doc: Document,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // 1) Détection initiale (SSR-friendly) + préférence utilisateur
    const detected = this.detectFromUrl() ?? 'fr';
    const remembered = this.getRememberedLang();
    const initial = (remembered ?? detected) as Lang;

    this.lang$.next(initial);
    this.applyHtmlLang(initial);

    // 2) Se resynchroniser à chaque navigation (utile SSR/hydratation)
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        const l = this.detectFromUrl() ?? 'fr';
        if (l !== this.lang) {
          this.lang$.next(l as Lang);
          this.applyHtmlLang(l as Lang);
        }
      });
  }

  /** FR <-> EN */
  toggle(): void {
    this.set(this.lang === 'fr' ? 'en' : 'fr');
  }

  /** Fixer explicitement la langue */
  set(l: Lang): void {
    if (l === this.lang) {
      this.applyHtmlLang(l);
      return;
    }
    this.lang$.next(l);
    this.applyHtmlLang(l);
    this.rememberLang(l);
    this.navigateToLang(l);
  }

  /* =============== PRIVÉ =============== */

  /** Détecte la langue depuis l’URL courante (browser ou SSR) */
  private detectFromUrl(): Lang | null {
    // Navigateur : window.location.pathname
    if (isPlatformBrowser(this.platformId)) {
      try {
        const path = this.doc?.defaultView?.location?.pathname || '/';
        return this.langFromPath(path);
      } catch {
        // Fall back sur Router si besoin
        return this.langFromPath(this.router.url || '/');
      }
    }
    // SSR : utiliser l’URL routeur (toujours dispo)
    try {
      return this.langFromPath(this.router.url || '/');
    } catch {
      return null;
    }
  }

  /** Calcule 'fr' | 'en' à partir d’un chemin */
  private langFromPath(pathname: string): Lang {
    const p = (pathname || '/').replace(/\/{2,}/g, '/');
    return (p === '/en' || p.startsWith('/en/')) ? 'en' : 'fr';
  }

  /** Met à jour <html lang="..."> pour SEO & a11y (SSR + browser) */
  private applyHtmlLang(l: Lang): void {
    try {
      this.doc.documentElement.setAttribute('lang', l === 'en' ? 'en' : 'fr');
    } catch { /* no-op */ }
  }

  /** Navigue vers l’URL équivalente dans la langue cible en préservant QS + hash */
  private navigateToLang(target: Lang): void {
    const isBrowser = isPlatformBrowser(this.platformId);
    const win = isBrowser ? this.doc.defaultView : null;

    // Base actuelle
    const currPath = (isBrowser ? win?.location?.pathname : this.router.url) || '/';
    const qs   = isBrowser ? (win?.location?.search || '')   : '';
    const hash = isBrowser ? (win?.location?.hash   || '')   : '';

    let newPath: string;
    if (target === 'en') {
      newPath =
        currPath === '/en' || currPath.startsWith('/en/')
          ? currPath
          : currPath === '/'
            ? '/en'
            : `/en${currPath}`;
    } else {
      // vers FR : retirer le préfixe /en
      newPath =
        currPath === '/en'
          ? '/'
          : currPath.replace(/^\/en(\/?)/, '/');
    }
    newPath = newPath.replace(/\/{2,}/g, '/');

    // Construire un UrlTree pour préserver proprement paramètres & fragment
    const tree: UrlTree = this.router.createUrlTree([newPath], {
      queryParams: this.router.parseUrl(qs || '').queryParams,
      fragment: (hash || '').replace(/^#/, '') || undefined
    });

    const finalUrl = this.router.serializeUrl(tree);

    // Navigue via Router, fallback hard si échec (rare)
    this.router.navigateByUrl(finalUrl, { replaceUrl: true }).catch(() => {
      if (isBrowser) win?.location?.assign(finalUrl);
    });
  }

  /** Mémoriser la langue (navigateur uniquement) */
  private rememberLang(l: Lang): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try { localStorage.setItem('lang', l); } catch { /* no-op */ }
  }
  private getRememberedLang(): Lang | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const v = localStorage.getItem('lang');
      return (v === 'fr' || v === 'en') ? v : null;
    } catch { return null; }
  }
}
