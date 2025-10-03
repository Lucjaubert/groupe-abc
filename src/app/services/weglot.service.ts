import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
export class WeglotService {
  private readonly readySubj = new BehaviorSubject<boolean>(false);
  readonly ready$ = this.readySubj.asObservable();

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    if (isPlatformBrowser(platformId)) {
      const check = () => {
        if (window.Weglot?.initialized === true) {
          this.readySubj.next(true);
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    }
  }

  switchTo(code: 'fr' | 'en'): void {
    try { window.Weglot?.switchTo?.(code); } catch {}
  }

  /** Lecture robuste de la langue courante (nouvelle + ancienne API) */
  getCurrentLang(): 'fr' | 'en' | null {
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
    try {
      const el = root || document.body || document.documentElement;
      window.Weglot?.addNodes?.(el);
    } catch {}
  }
}
