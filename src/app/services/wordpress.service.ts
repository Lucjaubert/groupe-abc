import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { forkJoin, Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WordpressService {
  private http = inject(HttpClient);
  private api = environment.apiWpV2;

  /* ===== Pages ===== */
  getHomepageData() {
    const params = new HttpParams().set('per_page', '1');
    return this.http.get<any[]>(`${this.api}/homepage`, { params })
      .pipe(map(list => list?.[0]?.acf ?? {}));
  }

  getAboutData() {
    const params = new HttpParams().set('per_page', '1');
    return this.http.get<any[]>(`${this.api}/about`, { params })
      .pipe(map(list => list?.[0]?.acf ?? {}));
  }

  getHomepageIdentityWhereItems() {
    const params = new HttpParams().set('per_page', '1');
    return this.http.get<any[]>(`${this.api}/homepage`, { params }).pipe(
      map(list => {
        const acf = list?.[0]?.acf ?? {};
        const id = acf?.identity_section ?? {};
        const items = [
          id.where_item_1, id.where_item_2, id.where_item_3, id.where_item_4,
          id.where_item_5, id.where_item_6, id.where_item_7, id.where_item_8
        ].filter(Boolean) as string[];
        return items;
      })
    );
  }

  /** ===== NEWS : pagination illimitée (100 par page jusqu’à épuisement) ===== */
  getAllNews(): Observable<any[]> {
    const perPage = 100;

    const fetchPage = (page: number): Observable<any[]> => {
      const params = new HttpParams()
        .set('per_page', String(perPage))
        .set('page', String(page))
        .set('orderby', 'date')
        .set('order', 'desc');

      return this.http.get<any[]>(`${this.api}/news`, { params });
    };

    // boucle récursive : on télécharge page 1, puis 2, etc., jusqu’à renvoyer < perPage éléments
    const loop = (page: number, acc: any[]): Observable<any[]> =>
      fetchPage(page).pipe(
        switchMap(batch => {
          const next = acc.concat(batch || []);
          if (!batch || batch.length < perPage) {
            return of(next);
          }
          return loop(page + 1, next);
        }),
        catchError(() => of(acc)) // en cas d’erreur, on renvoie ce qu’on a
      );

    return loop(1, []);
  }

  /** Résout un ID média WP -> URL publique (source_url). */
  getMediaUrl(id: number): Observable<string> {
    return this.http.get<any>(`${this.api}/media/${id}`).pipe(
      map(res => res?.source_url || ''),
      catchError(() => of(''))
    );
  }
}
