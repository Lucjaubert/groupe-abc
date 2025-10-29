import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable } from 'rxjs';
import { LanguageService } from './language.service';

export type FaqItem = { q: string; a: string };

@Injectable({ providedIn: 'root' })
export class FaqService {
  private lang = inject(LanguageService);

  private faqFR$ = new BehaviorSubject<FaqItem[]>([]);
  private faqEN$ = new BehaviorSubject<FaqItem[]>([]);
  private open$  = new BehaviorSubject<boolean>(false);

  /** Flux combiné pour le composant */
  vm$: Observable<{ open: boolean; items: FaqItem[]; lang: string }> =
    combineLatest([this.lang.lang$, this.faqFR$, this.faqEN$, this.open$]).pipe(
      map(([L, fr, en, open]) => ({
        open,
        items: L === 'en' ? (en?.length ? en : fr) : fr, // fallback FR si EN vide
        lang: L
      }))
    );

  /** Appelé par chaque page avec ses Q/R (versions FR & EN) */
  set(fr: FaqItem[], en?: FaqItem[]): void {
    this.faqFR$.next(fr || []);
    this.faqEN$.next(en || []);
  }

  clear(): void {
    this.faqFR$.next([]);
    this.faqEN$.next([]);
  }

  toggle(): void { this.open$.next(!this.open$.value); }
  open(): void   { this.open$.next(true); }
  close(): void  { this.open$.next(false); }
}
