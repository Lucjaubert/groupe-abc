import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WordpressService {
  private http = inject(HttpClient);
  private api = environment.apiWpV2;

  /* ========== HOMEPAGE (déjà OK) ========== */
  getHomepageData() {
    const params = new HttpParams().set('per_page', '1');
    return this.http.get<any[]>(`${this.api}/homepage`, { params })
      .pipe(map(list => list?.[0]?.acf ?? {}));
  }

  /* ========== ABOUT (déjà OK) ========== */
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
        return [
          id.where_item_1, id.where_item_2, id.where_item_3, id.where_item_4,
          id.where_item_5, id.where_item_6, id.where_item_7, id.where_item_8
        ].filter(Boolean) as string[];
      })
    );
  }

  /* ========== NEWS (déjà OK) ========== */
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
    const loop = (page: number, acc: any[]): Observable<any[]> =>
      fetchPage(page).pipe(
        switchMap(batch => {
          const next = acc.concat(batch || []);
          if (!batch || batch.length < perPage) return of(next);
          return loop(page + 1, next);
        }),
        catchError(() => of(acc))
      );
    return loop(1, []);
  }

  /** Résout un ID média WP -> URL publique. */
  getMediaUrl(id: number): Observable<string> {
    return this.http.get<any>(`${this.api}/media/${id}`).pipe(
      map(res => res?.source_url || ''),
      catchError(() => of(''))
    );
  }

  /* =====================================================
   *                     SERVICES (OK)
   * ===================================================== */
  getServicesRaw(): Observable<any[]> {
    const params = new HttpParams().set('per_page', '1');
    return this.http.get<any[]>(`${this.api}/services`, { params });
  }

  getServicesData(): Observable<any> {
    const params = new HttpParams().set('per_page', '1');
    return this.http.get<any[]>(`${this.api}/services`, { params }).pipe(
      map(list => list?.[0] ?? {}),
      catchError(err => { console.error('[WP] getServicesData error:', err); return of({}); })
    );
  }

  /* =====================================================
   *               📌 BIENS & MÉTHODES (NOUVEAU)
   * ===================================================== */

  /** Brut (debug) */
  getMethodsRaw(): Observable<any[]> {
    const params = new HttpParams().set('per_page', '1');
    return this.http.get<any[]>(`${this.api}/methods`, { params });
  }

  /** Données pour <app-methods> (on renvoie l’objet complet comme pour Services) */
  getMethodsData(): Observable<any> {
    const params = new HttpParams().set('per_page', '1');
    return this.http.get<any[]>(`${this.api}/methods`, { params }).pipe(
      map(list => list?.[0] ?? {}),
      catchError(err => { console.error('[WP] getMethodsData error:', err); return of({}); })
    );
  }
}
