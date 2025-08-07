import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WordpressService {

  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getHomepageData(): Observable<any> {
    return this.http.get<any>(`${this.api}/homepage`).pipe(
      map(res => res?.acf || {})
    );
  }
}
