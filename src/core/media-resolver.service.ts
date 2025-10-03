import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';

/** Si tu as des environments, importe-les ici si besoin
 * import { environment } from '../environments/environment';
 */
const SITE_ORIGIN = 'https://groupe-abc.fr'; // tu peux remplacer par environment.siteUrl si dispo

/** Corrige les URL d’uploads pour forcer /wordpress/wp-content/uploads */
function fixWpMediaUrl(url?: string): string {
  if (!url) return '';
  let u = url.trim();
  if (!u) return '';

  if (/^\/\//.test(u)) u = 'https:' + u;

  // Déjà bon ?
  if (/\/wordpress\/wp-content\/uploads\//i.test(u)) return u;

  // Absolue sans /wordpress
  u = u.replace(/^(https?:\/\/[^/]+)\/wp-content\/uploads\//i,
                '$1/wordpress/wp-content/uploads/');

  // Relative sans /wordpress
  u = u.replace(/^\/wp-content\/uploads\//i, '/wordpress/wp-content/uploads/');

  // Si l’URL devient relative, la préfixer par l’origine
  if (/^\/wordpress\/wp-content\/uploads\//i.test(u)) {
    u = SITE_ORIGIN.replace(/\/+$/,'') + u;
  }
  return u;
}

@Injectable({ providedIn: 'root' })
export class MediaResolverService {
  private http = inject(HttpClient);

  /** Résout un ID WordPress ou une URL en URL exploitable */
  resolve(input: number | string | null | undefined): Observable<string> {
    if (input == null || input === '') return of('');

    // Si c’est un nombre → appel /wp-json/wp/v2/media/:id
    if (typeof input === 'number' || /^\d+$/.test(String(input))) {
      const id = Number(input);
      const base = 'https://groupe-abc.fr/wordpress/wp-json/wp/v2'; // ou environment.apiWpV2
      return this.http.get<{ source_url?: string }>(`${base}/media/${id}`).pipe(
        map(res => fixWpMediaUrl(res?.source_url || '')),
        catchError(() => of(''))
      );
    }

    // Sinon on considère que c’est déjà une URL
    const asUrl = String(input);
    return of(fixWpMediaUrl(asUrl));
  }
}
