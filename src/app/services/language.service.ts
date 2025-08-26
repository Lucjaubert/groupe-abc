import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, filter, take } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { WeglotService } from './weglot.service';

export type Lang = 'fr' | 'en';

const STORAGE_KEY = 'lang';
const DEFAULT_LANG: Lang = 'fr';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private langSubj = new BehaviorSubject<Lang>(DEFAULT_LANG);
  readonly lang$ = this.langSubj.asObservable();

  get lang(): Lang { return this.langSubj.value; }

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private weglot: WeglotService
  ) {
    // FR d'abord, sauf si l'utilisateur a déjà choisi une langue
    const initial = this.readPersisted() ?? DEFAULT_LANG;

    this.langSubj.next(initial);
    this.updateHtmlLang(initial);

    // Applique la langue UNE FOIS Weglot initialisé
    this.weglot.ready$.pipe(filter(Boolean), take(1))
      .subscribe(() => this.weglot.switchTo(initial));
  }

  /** FR ↔ EN */
  toggle(): void {
    this.setLang(this.lang === 'fr' ? 'en' : 'fr');
  }

  /** Définit la langue et synchronise Weglot */
  setLang(next: Lang): void {
    if (next === this.lang) return;
    this.langSubj.next(next);
    this.persist(next);
    this.updateHtmlLang(next);
    this.weglot.switchTo(next); // ok même si déjà prêt; sinon no-op jusqu’au ready$
  }

  // --------- internes ---------

  /** Ne lit QUE le storage (pas la langue navigateur) */
  private readPersisted(): Lang | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const v = localStorage.getItem(STORAGE_KEY) as Lang | null;
      return v === 'fr' || v === 'en' ? v : null;
    } catch {
      return null;
    }
  }

  private persist(l: Lang): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }

  private updateHtmlLang(l: Lang): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try { document.documentElement.setAttribute('lang', l); } catch {}
  }
}
