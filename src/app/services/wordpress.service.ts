import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { forkJoin, Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WordpressService {
  private http = inject(HttpClient);
  private api = environment.apiWpV2;

  getHomepageData() {
    const params = new HttpParams().set('per_page', '1');
    return this.http
      .get<any[]>(`${this.api}/homepage`, { params })
      .pipe(map(list => list?.[0]?.acf ?? {}));
  }

  getAboutData() {
    const params = new HttpParams().set('per_page', '1');
    return this.http
      .get<any[]>(`${this.api}/about`, { params })
      .pipe(map(list => list?.[0]?.acf ?? {}));
  }

  getHomepageIdentityWhereItems() {
    const params = new HttpParams().set('per_page', '1');
    return this.http
      .get<any[]>(`${this.api}/homepage`, { params })
      .pipe(
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

  /** Résout un ID média WP -> URL publique (source_url). */
  getMediaUrl(id: number): Observable<string> {
    return this.http.get<any>(`${this.api}/media/${id}`).pipe(
      map(res => res?.source_url || ''),
      catchError(() => of(''))
    );
  }
}
