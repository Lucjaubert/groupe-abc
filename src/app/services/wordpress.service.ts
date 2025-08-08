
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WordpressService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  getHomepageData() {
    return this.http.get<any[]>(`${this.api}/homepage`).pipe(
      map(res => res?.[0]?.acf ?? {})
    );
  }
}
