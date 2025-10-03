import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, filter } from 'rxjs';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { WeglotService } from './weglot.service';

export type Lang = 'fr' | 'en';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  /** Langue courante observée (par défaut 'fr' au boot) */
  readonly lang$ = new BehaviorSubject<Lang>('fr');
  get lang(): Lang { return this.lang$.value; }

  private weglotReady = false;
  private bindingDone = false;
  private isNavigating = false;

  constructor(
    private router: Router,
    private wg: WeglotService,
    @Inject(DOCUMENT) private doc: Document,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Déterminer la langue initiale (URL > localStorage > 'fr')
    const detected = this.detectFromUrl() ?? 'fr';
    const remembered = this.getRememberedLang();
    const initial = (remembered ?? detected) as Lang;

    this.lang$.next(initial);
    this.applyHtmlLang(initial);

    // Sync sur navigation Angular (SPA)
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        const l = this.detectFromUrl() ?? 'fr';
        if (l !== this.lang) {
          this.lang$.next(l as Lang);
          this.applyHtmlLang(l as Lang);
          this.safeSwitch(l as Lang);
        }
      });

    // Quand Weglot est prêt (initialisé via index.html), on synchronise
    this.wg.ready$.subscribe(ok => {
      if (!ok || this.bindingDone || !isPlatformBrowser(this.platformId)) return;

      this.weglotReady = true;
      this.bindingDone = true;

      // 1) Aligner Weglot sur l’état app
      this.safeSwitch(this.lang);

      // 2) Écouter Weglot → propager dans l’URL si l’utilisateur change la langue
      try {
        window.Weglot?.on?.('languageChanged', () => {
          const w = window.Weglot;
          const wlang = w?.getCurrentLang?.() ?? w?.getCurrentLanguage?.();
          const l: Lang = (wlang === 'en' ? 'en' : 'fr');
          if (l !== this.lang) {
            this.lang$.next(l);
            this.applyHtmlLang(l);
            this.rememberLang(l);
            this.navigateToLang(l);
          }
        });
      } catch {}
    });
  }

  /** Basculement manuel (bouton/sélecteur) */
  toggle(): void { this.set(this.lang === 'fr' ? 'en' : 'fr'); }

  /** Fixer explicitement la langue */
  set(l: Lang): void {
    if (l === this.lang) { this.applyHtmlLang(l); return; }
    this.lang$.next(l);
    this.applyHtmlLang(l);
    this.rememberLang(l);
    this.navigateToLang(l);
    this.safeSwitch(l);
  }

  /** Préfixe URL pour générer des liens internes */
  prefixFor(l: Lang = this.lang): '' | '/en' {
    return l === 'en' ? '/en' : '';
  }

  /** Construit un lien tenant compte de la langue courante */
  link(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${this.prefixFor()}${p}`.replace(/\/{2,}/g, '/');
  }

  // ---------- privé ----------

  /** Demande à Weglot de basculer, sans erreur si non prêt */
  private safeSwitch(l: Lang): void {
    if (!isPlatformBrowser(this.platformId) || !this.weglotReady) return;
    try {
      const w = window.Weglot;
      const curr = w?.getCurrentLang?.() ?? w?.getCurrentLanguage?.();
      if (curr !== l) w?.switchTo?.(l);
    } catch {}
  }

  /** Détecte la langue depuis le pathname */
  private detectFromUrl(): Lang | null {
    const path = this.safePathname();
    return this.langFromPath(path);
  }

  private safePathname(): string {
    if (isPlatformBrowser(this.platformId)) {
      try { return this.doc?.defaultView?.location?.pathname || '/'; }
      catch { /* ignore */ }
    }
    try { return this.router.url || '/'; } catch { return '/'; }
  }

  private langFromPath(pathname: string): Lang {
    const p = (pathname || '/').replace(/\/{2,}/g, '/');
    return (p === '/en' || p.startsWith('/en/')) ? 'en' : 'fr';
  }

  /** Met à jour <html lang="..."> */
  private applyHtmlLang(l: Lang): void {
    try { this.doc.documentElement.setAttribute('lang', l); } catch {}
  }

  /**
   * Navigue vers l’URL correspondant à la langue (gère / ↔ /en, garde query & hash)
   * Evite les boucles via le flag isNavigating.
   */
  private navigateToLang(target: Lang): void {
    if (this.isNavigating) return;
    const isBrowser = isPlatformBrowser(this.platformId);
    const win = isBrowser ? this.doc.defaultView : null;

    const currPath = (isBrowser ? win?.location?.pathname : this.router.url) || '/';
    const qs   = isBrowser ? (win?.location?.search || '')   : '';
    const hash = isBrowser ? (win?.location?.hash   || '')   : '';

    let newPath: string;
    if (target === 'en') {
      newPath = (currPath === '/en' || currPath.startsWith('/en/'))
        ? currPath
        : (currPath === '/' ? '/en' : `/en${currPath}`);
    } else {
      newPath = (currPath === '/en') ? '/' : currPath.replace(/^\/en(\/?)/, '/');
    }
    newPath = newPath.replace(/\/{2,}/g, '/');

    const finalUrl = `${newPath}${qs}${hash}`;
    if (finalUrl === `${currPath}${qs}${hash}`) return;

    this.isNavigating = true;
    this.router.navigateByUrl(finalUrl, { replaceUrl: true })
      .catch(() => { if (isBrowser) win?.location?.assign(finalUrl); })
      .finally(() => { this.isNavigating = false; });
  }

  /** Persistance locale */
  private rememberLang(l: Lang): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try { localStorage.setItem('lang', l); } catch {}
  }
  private getRememberedLang(): Lang | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const v = localStorage.getItem('lang');
      return (v === 'fr' || v === 'en') ? v : null;
    } catch { return null; }
  }
}
