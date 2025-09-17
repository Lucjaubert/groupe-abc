import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ApiService {
  // Base REST canonique côté WP
  private base = 'https://groupe-abc.fr/wp-json/wp/v2';

  constructor(private http: HttpClient) {}

  /** Exemple : récupérer le CPT "homepage" (ACF/fields inclus selon ton setup) */
  getHomepage(params?: Record<string, any>) {
    // Tip : HttpParams pour conserver un typage propre
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) httpParams = httpParams.set(k, String(v));
      });
    }

    return this.http.get(`${this.base}/homepage`, {
      params: httpParams,
      // Laisse true seulement si tu dépends des cookies WP (auth, previews…)
      withCredentials: true
    });
  }

  /** Exemple générique si tu as d'autres CPT : */
  getCollection(cpt: string, params?: Record<string, any>) {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) httpParams = httpParams.set(k, String(v));
      });
    }
    return this.http.get(`${this.base}/${cpt}`, { params: httpParams, withCredentials: true });
  }
}
