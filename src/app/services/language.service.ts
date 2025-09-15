import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';

export type Lang = 'fr' | 'en';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  /** Langue courante observable */
  readonly lang$ = new BehaviorSubject<Lang>('fr');

  /** Getter pratique */
  get lang(): Lang {
    return this.lang$.value;
  }

  constructor(
    private router: Router,
    @Inject(DOCUMENT) private doc: Document,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    const detected = this.detectFromPath();
    this.lang$.next(detected);
    this.applyHtmlLang(detected);
  }

  /** FR <-> EN */
  toggle(): void {
    const next: Lang = this.lang === 'fr' ? 'en' : 'fr';
    this.set(next);
  }

  /** Fixer explicitement la langue */
  set(l: Lang): void {
    if (l === this.lang) {
      this.applyHtmlLang(l);
      return;
    }
    this.lang$.next(l);
    this.applyHtmlLang(l);
    this.navigateToLang(l);
  }

  /* =============== PRIVÉ =============== */

  /** Détecte la langue depuis le path (/en/... => en, sinon fr) */
  private detectFromPath(): Lang {
    try {
      const path = this.doc?.defaultView?.location?.pathname || '/';
      return path.startsWith('/en/') || path === '/en' ? 'en' : 'fr';
    } catch {
      return 'fr';
    }
  }

  /** Met à jour <html lang="..."> pour SEO & a11y */
  private applyHtmlLang(l: Lang): void {
    try {
      this.doc.documentElement.setAttribute('lang', l === 'en' ? 'en' : 'fr');
    } catch {}
  }

  /** Construit l’URL équivalente dans la cible et y navigue */
  private navigateToLang(target: Lang): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const w = this.doc.defaultView!;
    const currPath = w.location.pathname || '/';
    const qs = w.location.search || '';
    const hash = w.location.hash || '';

    let newPath: string;
    if (target === 'en') {
      newPath = currPath.startsWith('/en/')
        ? currPath
        : currPath === '/' || currPath === '/en'
          ? '/en'
          : `/en${currPath}`;
    } else {
      newPath = currPath.startsWith('/en/')
        ? currPath.replace(/^\/en(\/?)/, '/')
        : currPath === '/en'
          ? '/'
          : currPath;
    }

    newPath = newPath.replace(/\/{2,}/g, '/');
    const finalUrl = newPath + qs + hash;

    this.router.navigateByUrl(finalUrl, { replaceUrl: true }).catch(() => {
      w.location.assign(finalUrl);
    });
  }
}
