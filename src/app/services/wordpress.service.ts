// src/app/services/wordpress.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface PartnerCard {
  photo: string;
  area: string;
  nameFirst: string;
  nameLast: string;
  jobHtml: string;
  linkedin?: string;
  email?: string;
}

@Injectable({ providedIn: 'root' })
export class WordpressService {
  private http = inject(HttpClient);
  private api = environment.apiWpV2;

  private shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* HOMEPAGE */
  getHomepageData() {
    const params = new HttpParams().set('per_page', '1');
    return this.http.get<any[]>(`${this.api}/homepage`, { params })
      .pipe(map(list => list?.[0]?.acf ?? {}));
  }

  getHomepageFeaturedNews(limit = 2): Observable<any[]> {
    const params = new HttpParams().set('per_page', '1');

    return this.http.get<any[]>(`${this.api}/homepage`, { params }).pipe(
      map(list => list?.[0]?.acf ?? {}),
      switchMap(acf => {
        const rel = acf?.news_featured || [];
        const ids: number[] = (rel as any[])
          .map(r => (typeof r === 'number' ? r : (r?.ID ?? r?.id)))
          .filter((v: any) => Number.isFinite(v));

        if (!ids.length) return of([]);

        const picked = this.shuffle(ids).slice(0, limit);
        const p = new HttpParams()
          .set('per_page', String(picked.length))
          .set('include', picked.join(','))
          .set('orderby', 'include');

        return this.http.get<any[]>(`${this.api}/news`, { params: p });
      }),
      map(posts => posts.map(p => {
        const post = p?.acf?.post ?? {};
        return {
          link: p?.link || '',
          title: post.post_title || p?.title?.rendered || '',
          html: post.post_content || p?.excerpt?.rendered || '',
          logo: post.logo_firm || '',
          firm: post.nam_firm || '',
          theme: post.theme || '',
          authorDate: [post.author, post.date].filter(Boolean).join(' – ')
        };
      })),
      catchError(() => of([]))
    );
  }

  /* ABOUT */
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

  /* NEWS */
  getAllNews(): Observable<any[]> {
    const perPage = 100;
    const fetchPage = (page: number): Observable<any[]> => {
      const params = new HttpParams()
        .set('per_page', String(perPage))
        .set('page', String(page))
        .set('orderby', 'date')
        .set('order', 'desc')
        .set('_embed', '1');
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

  getRandomNews(count = 2): Observable<any[]> {
    return this.getAllNews().pipe(
      map(list => this.shuffle(list).slice(0, count)),
      catchError(() => of([]))
    );
  }

  getMediaUrl(id: number): Observable<string> {
    return this.http.get<any>(`${this.api}/media/${id}`).pipe(
      map(res => res?.source_url || ''),
      catchError(() => of(''))
    );
  }

  /* SERVICES */
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

  /* METHODS */
  getMethodsRaw(): Observable<any[]> {
    const params = new HttpParams().set('per_page', '1');
    return this.http.get<any[]>(`${this.api}/methods`, { params });
  }

  getMethodsData(): Observable<any> {
    const params = new HttpParams().set('per_page', '1');
    return this.http.get<any[]>(`${this.api}/methods`, { params }).pipe(
      map(list => list?.[0] ?? {}),
      catchError(err => { console.error('[WP] getMethodsData error:', err); return of({}); })
    );
  }

  /* TEAM */
  getTeamData() {
    const params = new HttpParams().set('per_page', '1');
    return this.http.get<any[]>(`${this.api}/team`, { params }).pipe(
      map(list => list?.[0] ?? {}),
      catchError(err => { console.error('[WP] getTeamData error:', err); return of({}); })
    );
  }

  private normalizeTeamPartnersFrom(acfRoot: any): PartnerCard[] {
    const firms = (acfRoot?.firms ?? acfRoot) || {};
    const out: PartnerCard[] = [];

    Object.keys(firms).forEach(key => {
      if (!/^firm_\d+$/i.test(key)) return;
      const f = firms[key] || {};

      const area     = (f.region_name ?? '').toString().trim();
      const first    = (f.partner_lastname ?? '').toString().trim();
      const last     = (f.partner_familyname ?? '').toString().trim();
      const jobHtml  = (f.titles_partner_ ?? f.titles_partner ?? '').toString();
      const photo    = (f.partner_image ?? '').toString().trim();
      const linkedin = (f.partner_lk ?? '').toString().trim();
      const email    = (f.contact_email ?? '').toString().trim();

      if ((first || last) && photo) {
        out.push({ photo, area, nameFirst: first, nameLast: last, jobHtml, linkedin, email });
      }
    });

    return out;
  }

  getTeamPartners(): Observable<PartnerCard[]> {
    const params = new HttpParams().set('per_page', '1');
    return this.http.get<any[]>(`${this.api}/team`, { params }).pipe(
      map(list => this.normalizeTeamPartnersFrom(list?.[0]?.acf ?? {})),
      catchError(err => {
        console.error('[WP] getTeamPartners error:', err);
        return of([]);
      })
    );
  }

  getTeamPartnerByName(namePart: string): Observable<PartnerCard | null> {
    const q = (namePart || '').trim().toLowerCase();
    if (!q) return of(null);

    return this.getTeamPartners().pipe(
      map((cards: PartnerCard[]) =>
        cards.find(c => (`${c.nameFirst} ${c.nameLast}`.toLowerCase()).includes(q)) || null
      ),
      catchError(() => of(null))
    );
  }
}
