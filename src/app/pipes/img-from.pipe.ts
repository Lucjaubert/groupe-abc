// src/app/pipes/img-from.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { Observable, of, ReplaySubject } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { WordpressService } from '../services/wordpress.service';

type AnyMedia =
  | number
  | string
  | { id?: number; url?: string; source_url?: string;
      media_details?: { sizes?: Record<string, { source_url: string }> } };

@Pipe({
  name: 'imgFrom',
  standalone: true,
  pure: true, // OK (on se base sur cache/shareReplay)
})
export class ImgFromPipe implements PipeTransform {

  // cache: clé = JSON.stringify(input)+size
  private cache = new Map<string, ReplaySubject<string>>();

  constructor(private wp: WordpressService) {}

  transform(input: AnyMedia | null | undefined, size: string = 'full'): Observable<string> {
    const key = JSON.stringify([this.normalizeInput(input), size]);

    // cache hit
    const hit = this.cache.get(key);
    if (hit) return hit.asObservable();

    const subject = new ReplaySubject<string>(1);
    this.cache.set(key, subject);

    this.resolve$(input, size).subscribe({
      next: (url) => subject.next(url || ''),
      error: () => subject.next(''),
    });

    return subject.asObservable();
  }

  /** Résout en Observable<string> (jamais d’erreur, renvoie '') */
  private resolve$(input: AnyMedia | null | undefined, size: string): Observable<string> {
    if (!input) return of('');

    // chaîne déjà URL/chemin
    if (typeof input === 'string') {
      const s = input.trim();
      if (!s) return of('');
      return of(s);
    }

    // objet ACF/media
    if (typeof input === 'object') {
      // 1) taille demandée si dispo
      const sized = input?.media_details?.sizes?.[size]?.source_url;
      if (sized) return of(sized);
      // 2) source_url/url si dispo
      const direct = (input as any).source_url || (input as any).url;
      if (direct) return of(direct);
      // 3) id → REST
      if (input?.id != null) {
        return this.wp.getMediaUrl(input.id).pipe(map(u => u || ''));
      }
      return of('');
    }

    // nombre → REST
    if (typeof input === 'number') {
      return this.wp.getMediaUrl(input).pipe(
        map(u => u || '')
      );
    }

    return of('');
  }

  private normalizeInput(input: AnyMedia | null | undefined) {
    if (!input) return null;
    if (typeof input === 'object') {
      const shallow: any = { ...input };
      if (shallow.media_details?.sizes) {
        // réduire pour la clé de cache
        shallow.media_details = { sizes: Object.keys(shallow.media_details.sizes) };
      }
      return shallow;
    }
    return input;
  }
}
