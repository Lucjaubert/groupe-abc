// src/app/services/wordpress.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
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

/* ===========================
 * Helpers URL images/HTML WP
 * =========================== */
const SITE_ORIGIN = (environment.siteUrl || 'https://groupe-abc.fr').replace(/\/+$/, '');
const HOST = (() => {
  try {
    return new URL(SITE_ORIGIN).host;
  } catch {
    return 'groupe-abc.fr';
  }
})();

/** Normalise une URL d’upload WP vers /wordpress/wp-content/uploads/... */
function fixWpMediaUrl(url?: string): string {
  if (!url) return '';
  let u = url.trim();
  if (!u) return '';

  // protocole-relative → https:
  if (/^\/\//.test(u)) u = 'https:' + u;

  // déjà correct
  if (
    new RegExp(`^https?:\/\/${HOST}\/wordpress\/wp-content\/uploads\/`, 'i').test(u) ||
    /^\/wordpress\/wp-content\/uploads\//i.test(u)
  ) {
    return u;
  }

  // Absolue sur n'importe quel domaine → réécrit vers SITE_ORIGIN + /wordpress/...
  u = u.replace(
    /^https?:\/\/[^/]+\/wp-content\/uploads\//i,
    `${SITE_ORIGIN}/wordpress/wp-content/uploads/`
  );

  // Relative sans /wordpress → insère /wordpress
  u = u.replace(/^\/wp-content\/uploads\//i, '/wordpress/wp-content/uploads/');

  return u;
}

/** Réécrit les src= et url(...) dans un HTML pour forcer /wordpress/wp-content/uploads */
function rewriteUploadsInHtml(html?: string): string {
  if (!html) return '';
  return html
    // src="/wp-content/uploads/..."
    .replace(/(\ssrc=['"])\s*\/wp-content\/uploads\//gi, '$1/wordpress/wp-content/uploads/')
    // src="https://<any-host>/wp-content/uploads/..."
    .replace(
      /(\ssrc=['"])https?:\/\/[^/]+\/wp-content\/uploads\//gi,
      `$1${SITE_ORIGIN}/wordpress/wp-content/uploads/`
    )
    // url('/wp-content/uploads/...')
    .replace(/(url\(\s*['"]?)\/wp-content\/uploads\//gi, '$1/wordpress/wp-content/uploads/')
    // url('https://<any-host>/wp-content/uploads/...')
    .replace(
      /(url\(\s*['"]?)https?:\/\/[^/]+\/wp-content\/uploads\//gi,
      `$1${SITE_ORIGIN}/wordpress/wp-content/uploads/`
    );
}

@Injectable({ providedIn: 'root' })
export class WordpressService {
  private http = inject(HttpClient);

  /**
   * Bases d’API :
   * - primaire : environment.apiWpV2 (dans ton prod = .../wordpress/wp-json/wp/v2)
   * - fallback : version sans /wordpress (ou l’inverse si primaire sans /wordpress)
   * - si env vide → fallback par défaut sur groupe-abc.fr/wordpress/wp-json/wp/v2
   */
  private bases: string[] = (() => {
    const fromEnv = (environment.apiWpV2 || '').trim();

    // Si env vide ou mal renseigné → fallback par défaut
    const primaryRaw = fromEnv || 'https://groupe-abc.fr/wordpress/wp-json/wp/v2';
    const primary = primaryRaw.replace(/\/+$/, '');
    let alt = primary;

    if (/\/wordpress\/wp-json\/wp\/v2$/i.test(primary)) {
      // primaire = .../wordpress/wp-json/wp/v2  → fallback = .../wp-json/wp/v2
      alt = primary.replace(/\/wordpress\/wp-json\/wp\/v2$/i, '/wp-json/wp/v2');
    } else if (/\/wp-json\/wp\/v2$/i.test(primary)) {
      // primaire = .../wp-json/wp/v2 → fallback = .../wordpress/wp-json/wp/v2
      alt = primary.replace(/\/wp-json\/wp\/v2$/i, '/wordpress/wp-json/wp/v2');
    }

    // Déduplique proprement
    return Array.from(new Set([primary, alt])).filter(Boolean);
  })();

  /* --------------- Utils HTTP --------------- */
  private urlJoin(base: string, path: string): string {
    const b = base.replace(/\/+$/, '');
    const p = path.replace(/^\/+/, '');
    return `${b}/${p}`;
  }

  private getJson<T>(endpoint: string, params?: HttpParams): Observable<T> {
    const tryBase = (idx: number): Observable<T> => {
      if (idx >= this.bases.length) {
        return throwError(() => new Error(`All API bases failed for ${endpoint}`));
      }

      const base = this.bases[idx];
      const url = this.urlJoin(base, endpoint);

      // Logs côté SSR uniquement
      if (typeof window === 'undefined') {
        console.log('[WP][SSR] GET', url);
      }

      return this.http.get<T>(url, { params }).pipe(
        catchError(err => {
          const status = err?.status ?? 0;
          const message = err?.message;

          if (typeof window === 'undefined') {
            console.error('[WP][SSR] ERROR', { url, status, message });
          }

          // Fallback si réseau/404/5xx
          if ([0, 404, 500, 502, 503, 504].includes(status)) {
            return tryBase(idx + 1);
          }

          return throwError(() => err);
        })
      );
    };

    return tryBase(0);
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* --------------- HOMEPAGE --------------- */
  getHomepageData(): Observable<any> {
    const params = new HttpParams().set('per_page', '1');
    return this.getJson<any[]>('homepage', params).pipe(
      map(list => {
        const acf = list?.[0]?.acf ?? {};
        if (acf?.identity_section?.who_text) {
          acf.identity_section.who_text = rewriteUploadsInHtml(acf.identity_section.who_text);
        }
        return acf;
      }),
      catchError(err => {
        console.error('[WP] getHomepageData error:', err);
        // En SSR, on renvoie un ACF vide plutôt que de faire planter tout le rendu
        return of({});
      })
    );
  }

  getHomepageFeaturedNews(limit = 2): Observable<any[]> {
    const params = new HttpParams().set('per_page', '1');

    return this.getJson<any[]>('homepage', params).pipe(
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

        return this.getJson<any[]>('news', p);
      }),
      map(posts =>
        posts.map(p => {
          const post = p?.acf?.post ?? {};
          return {
            link: p?.link || '',
            title: post.post_title || p?.title?.rendered || '',
            html: rewriteUploadsInHtml(post.post_content || p?.excerpt?.rendered || ''),
            logo: fixWpMediaUrl(post.logo_firm || ''),
            firm: post.nam_firm || '',
            theme: post.theme || '',
            authorDate: [post.author, post.date].filter(Boolean).join(' – ')
          };
        })
      ),
      catchError(() => of([]))
    );
  }

  getHomepageIdentityWhereItems(): Observable<string[]> {
    const params = new HttpParams().set('per_page', '1');
    return this.getJson<any[]>('homepage', params).pipe(
      map(list => {
        const acf = list?.[0]?.acf ?? {};
        const id = acf?.identity_section ?? {};
        return [
          id.where_item_1,
          id.where_item_2,
          id.where_item_3,
          id.where_item_4,
          id.where_item_5,
          id.where_item_6,
          id.where_item_7,
          id.where_item_8
        ].filter(Boolean) as string[];
      }),
      catchError(err => {
        console.error('[WP] getHomepageIdentityWhereItems error:', err);
        return of([]);
      })
    );
  }

  /* --------------- ABOUT --------------- */
  getAboutData(): Observable<any> {
    const params = new HttpParams().set('per_page', '1');
    return this.getJson<any[]>('about', params).pipe(
      map(list => {
        const acf = list?.[0]?.acf ?? {};
        if (acf?.who_text) acf.who_text = rewriteUploadsInHtml(acf.who_text);
        return acf;
      })
    );
  }

  /* --------------- NEWS --------------- */
  private fetchNewsPage(page: number, perPage = 100): Observable<any[]> {
    const params = new HttpParams()
      .set('per_page', String(perPage))
      .set('page', String(page))
      .set('orderby', 'date')
      .set('order', 'desc')
      .set('_embed', '1');
    return this.getJson<any[]>('news', params);
  }

  getAllNews(): Observable<any[]> {
    const perPage = 100;
    const loop = (page: number, acc: any[]): Observable<any[]> =>
      this.fetchNewsPage(page, perPage).pipe(
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
    return this.getJson<any>(`media/${id}`).pipe(
      map(res => fixWpMediaUrl(res?.source_url || '')),
      catchError(() => of(''))
    );
  }

  /* --------------- SERVICES --------------- */
  getServicesRaw(): Observable<any[]> {
    const params = new HttpParams().set('per_page', '1');
    return this.getJson<any[]>('services', params);
  }

  getServicesData(): Observable<any> {
    const params = new HttpParams().set('per_page', '1');
    return this.getJson<any[]>('services', params).pipe(
      map(list => {
        const item = list?.[0] ?? {};
        if (item?.acf) {
          Object.keys(item.acf).forEach(k => {
            const v = (item.acf as any)[k];
            if (typeof v === 'string' && /<img|url\(/i.test(v)) {
              (item.acf as any)[k] = rewriteUploadsInHtml(v);
            }
          });
        }
        return item;
      }),
      catchError(err => {
        console.error('[WP] getServicesData error:', err);
        return of({});
      })
    );
  }

  /* --------------- METHODS --------------- */
  getMethodsRaw(): Observable<any[]> {
    const params = new HttpParams().set('per_page', '1');
    return this.getJson<any[]>('methods', params);
  }

  getMethodsData(): Observable<any> {
    const params = new HttpParams().set('per_page', '1');
    return this.getJson<any[]>('methods', params).pipe(
      map(list => list?.[0] ?? {}),
      catchError(err => {
        console.error('[WP] getMethodsData error:', err);
        return of({});
      })
    );
  }

  /* --------------- TEAM --------------- */
  getTeamData(): Observable<any> {
    const params = new HttpParams().set('per_page', '1');
    return this.getJson<any[]>('team', params).pipe(
      map(list => {
        const item = list?.[0] ?? {};
        const acf = item?.acf ?? {};

        // HERO intro
        if (acf?.hero?.intro_body) {
          acf.hero.intro_body = rewriteUploadsInHtml(acf.hero.intro_body);
        }

        // FIRMS : nettoie HTML + normalise les médias
        const firms = acf?.firms ?? {};
        for (let i = 1; i <= 12; i++) {
          const key = `firm_${i}`;
          const f = firms[key];
          if (!f) continue;

          if (f.partner_description) {
            f.partner_description = rewriteUploadsInHtml(f.partner_description);
          }
          if (f.titles_partner_ != null) {
            f.titles_partner_ = rewriteUploadsInHtml(f.titles_partner_);
          } else if (f.titles_partner != null) {
            f.titles_partner = rewriteUploadsInHtml(f.titles_partner);
          }

          if (typeof f.partner_image === 'string') f.partner_image = fixWpMediaUrl(f.partner_image);
          if (typeof f.logo === 'string') f.logo = fixWpMediaUrl(f.logo);
          if (typeof f.organism_logo === 'string') f.organism_logo = fixWpMediaUrl(f.organism_logo);
        }

        // TEACHING intro
        if (acf?.teaching?.intro_body) {
          acf.teaching.intro_body = rewriteUploadsInHtml(acf.teaching.intro_body);
        }

        return item;
      }),
      catchError(err => {
        console.error('[WP] getTeamData error:', err);
        return of({});
      })
    );
  }

  private normalizeTeamPartnersFrom(acfRoot: any): PartnerCard[] {
    const firms = (acfRoot?.firms ?? acfRoot) || {};
    const out: PartnerCard[] = [];

    Object.keys(firms).forEach(key => {
      if (!/^firm_\d+$/i.test(key)) return;
      const f = firms[key] || {};

      const area = (f.region_name ?? '').toString().trim();
      const first = (f.partner_lastname ?? '').toString().trim();
      const last = (f.partner_familyname ?? '').toString().trim();
      const jobHtml = (f.titles_partner_ ?? f.titles_partner ?? '').toString();
      const photo = fixWpMediaUrl((f.partner_image ?? '').toString().trim());
      const linkedin = (f.partner_lk ?? '').toString().trim();
      const email = (f.contact_email ?? '').toString().trim();

      if ((first || last) && photo) {
        out.push({ photo, area, nameFirst: first, nameLast: last, jobHtml, linkedin, email });
      }
    });

    return out;
  }

  getTeamPartners(): Observable<PartnerCard[]> {
    const params = new HttpParams().set('per_page', '1');
    return this.getJson<any[]>('team', params).pipe(
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
      map(
        (cards: PartnerCard[]) =>
          cards.find(c => `${c.nameFirst} ${c.nameLast}`.toLowerCase().includes(q)) || null
      ),
      catchError(() => of(null))
    );
  }
}
