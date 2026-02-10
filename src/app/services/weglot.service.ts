import { Injectable, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

/** Typage souple de l’API publique Weglot côté browser */
declare global {
  interface Window {
    Weglot?: {
      initialized?: boolean;
      /** bascule de langue */
      switchTo?: (code: string) => void;

      /** lecture de la langue courante – nouvelle API */
      getCurrentLang?: () => string;
      /** lecture de la langue courante – ancienne API (fallback) */
      getCurrentLanguage?: () => string;

      /** écouteurs */
      on?: (event: string, cb: (...args: any[]) => void) => void;
      off?: (event: string, cb: (...args: any[]) => void) => void;

      /** re-scan du DOM pour traduire du contenu injecté dynamiquement */
      addNodes?: (nodes: Element | Element[] | NodeList) => void;
    };
  }
}

@Injectable({ providedIn: 'root' })
export class WeglotService implements OnDestroy {
  private readonly readySubj = new BehaviorSubject<boolean>(false);
  readonly ready$ = this.readySubj.asObservable();

  private readonly isBrowser: boolean;
  private checkTimer: any = null;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    @Inject(DOCUMENT) private doc: Document
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      const check = () => {
        try {
          if (window.Weglot?.initialized === true) {
            this.readySubj.next(true);
            this.checkTimer = null;
            return;
          }
        } catch {
          // ignore
        }
        this.checkTimer = setTimeout(check, 100);
      };

      check();
    }
  }

  ngOnDestroy(): void {
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }
  }

  switchTo(code: 'fr' | 'en'): void {
    if (!this.isBrowser) return;
    try {
      window.Weglot?.switchTo?.(code);
    } catch {}
  }

  /** Lecture robuste de la langue courante (nouvelle + ancienne API) */
  getCurrentLang(): 'fr' | 'en' | null {
    if (!this.isBrowser) return null;

    try {
      const w = window.Weglot;
      const v = w?.getCurrentLang?.() ?? w?.getCurrentLanguage?.();
      return v === 'en' ? 'en' : v === 'fr' ? 'fr' : null;
    } catch {
      return null;
    }
  }

  /**
   * Demande un re-scan de Weglot (équivalent au “refresh” historique).
   * Par défaut on re-scanne tout le document (body).
   */
  rescan(root?: Element): void {
    if (!this.isBrowser) return;

    try {
      const el =
        root ||
        this.doc?.body ||
        this.doc?.documentElement ||
        undefined;

      if (el) {
        window.Weglot?.addNodes?.(el);
      }
    } catch {}
  }
}
