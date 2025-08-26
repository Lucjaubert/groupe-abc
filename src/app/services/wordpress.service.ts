import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

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
}
