// src/app/services/api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  /** Bases candidates : primaire (env), puis fallback /wordpress/wp-json/wp/v2 */
  private readonly bases: string[] = (() => {
    const primary = (environment.apiWpV2 || '').replace(/\/+$/, '');
    const alt = primary.includes('/wp-json/wp/v2')
      ? primary.replace('/wp-json/wp/v2', '/wordpress/wp-json/wp/v2')
      : `${primary}/wordpress/wp-json/wp/v2`;
    return Array.from(new Set([primary, alt]));
  })();

  /** Concatène proprement base + endpoint */
  private urlJoin(base: string, endpoint: string): string {
    const b = base.replace(/\/+$/, '');
    const e = endpoint.replace(/^\/+/, '');
    return `${b}/${e}`;
  }

  /** Construit des HttpParams à partir d’un objet */
  private toParams(params?: Record<string, any>): HttpParams {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          httpParams = httpParams.set(k, String(v));
        }
      });
    }
    return httpParams;
  }

  /**
   * GET JSON avec fallback automatique :
   * essaie bases[0], puis bases[1] si 0/404/5xx.
   */
  private getJson<T>(
    endpoint: string,
    params?: HttpParams,
    withCredentials = false
  ): Observable<T> {
    const tryAt = (i: number): Observable<T> => {
      if (i >= this.bases.length) {
        return throwError(() => new Error(`All API bases failed for ${endpoint}`));
      }
      const url = this.urlJoin(this.bases[i], endpoint);
      return this.http.get<T>(url, { params, withCredentials }).pipe(
        catchError(err => {
          const status = err?.status ?? 0;
          if ([0, 404, 500, 502, 503, 504].includes(status)) {
            return tryAt(i + 1);
          }
          throw err;
        })
      );
    };
    return tryAt(0);
  }

  /** Exemple : récupérer le CPT "homepage" */
  getHomepage(params?: Record<string, any>, withCreds = false) {
    const httpParams = this.toParams(params);
    return this.getJson<any[]>('homepage', httpParams, withCreds);
  }

  /** Exemple générique pour n’importe quel CPT */
  getCollection(cpt: string, params?: Record<string, any>, withCreds = false) {
    const httpParams = this.toParams(params);
    return this.getJson<any[]>(cpt.replace(/^\/+/, ''), httpParams, withCreds);
  }
}
