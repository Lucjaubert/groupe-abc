// src/app/services/seo.service.ts
import { Injectable, Inject, Renderer2, RendererFactory2, PLATFORM_ID } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export type OgType = 'website' | 'article';

export interface Hreflang {
  lang: string;  // 'fr', 'en', 'x-default', ...
  href: string;  // URL absolue recommandée
}

export interface SeoConfig {
  title:        string;
  description?: string;
  keywords?:    string;

  // Langues
  lang?:        'fr' | 'en';
  locale?:      string;               // 'fr_FR' | 'en_US'
  localeAlt?:   string[];             // ['en_US']…

  image?:       string;               // absolue ou relative
  imageAlt?:    string;
  imageWidth?:  number;
  imageHeight?: number;

  type?:        OgType;               // 'website' | 'article'
  canonical?:   string;               // absolue ou relative
  robots?:      string;               // 'index,follow'…

  // Twitter
  twitterSite?:    string;
  twitterCreator?: string;

  // Article
  publishedTime?: string;
  modifiedTime?:  string;

  // Hreflang
  alternates?:   Hreflang[];

  // JSON-LD (@graph ou objet)
  jsonLd?:       object;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private rnd: Renderer2;
  private isBrowser: boolean;

  constructor(
    private title: Title,
    private meta : Meta,
    private router: Router,
    @Inject(DOCUMENT) private doc: Document,
    @Inject(PLATFORM_ID) platformId: Object,
    renderer: RendererFactory2
  ) {
    this.rnd = renderer.createRenderer(null, null);
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /** Mise à jour complète (title, metas, OG/Twitter, canonical, hreflang, JSON-LD, langue) */
  update(cfg: SeoConfig): void {
    if (cfg.title) this.title.setTitle(cfg.title);

    // <html lang> + meta content-language
    if (cfg.lang) {
      this.doc.documentElement.setAttribute('lang', cfg.lang);
      this.setNamedMeta('content-language', cfg.lang);
    }

    // Metas classiques
    this.setNamedMeta('description', cfg.description);
    this.setNamedMeta('keywords',    cfg.keywords);

    // Robots (Googlebot suit 'robots')
    this.setNamedMeta('robots',    cfg.robots);
    this.setNamedMeta('googlebot', cfg.robots);

    // Origin (navigateur → window.origin ; SSR → environment.siteUrl)
    const origin  = this.siteOrigin() || environment.siteUrl || '';
    const pageUrl = this.absUrl(cfg.canonical || this.currentUrl() || this.routerUrlAsAbs(origin), origin);
    const imgUrl  = this.absUrl(cfg.image || '', origin);

    // Open Graph
    const ogType   = (cfg.type ?? 'website') as OgType;
    const ogLocale = cfg.locale || (cfg.lang === 'en' ? 'en_US' : 'fr_FR');

    this.setOpenGraph({
      'og:type':        ogType,
      'og:locale':      ogLocale,
      'og:title':       cfg.title,
      'og:description': cfg.description ?? '',
      'og:image':       imgUrl || '',
      'og:url':         pageUrl
    });

    // og:locale:alternate
    this.clearOgLocaleAlternate();
    (cfg.localeAlt || (ogLocale.startsWith('fr') ? ['en_US'] : ['fr_FR']))
      .forEach(l => this.setPropMeta('og:locale:alternate', l));

    // OG image détails
    if (imgUrl) {
      this.setPropMeta('og:image:alt',   cfg.imageAlt || cfg.title);
      if (cfg.imageWidth)  this.setPropMeta('og:image:width',  String(cfg.imageWidth));
      if (cfg.imageHeight) this.setPropMeta('og:image:height', String(cfg.imageHeight));
    }

    // Article
    if (ogType === 'article') {
      if (cfg.publishedTime) this.setPropMeta('article:published_time', cfg.publishedTime);
      if (cfg.modifiedTime)  this.setPropMeta('article:modified_time',  cfg.modifiedTime);
    }

    // Twitter
    const twitterCard = imgUrl ? 'summary_large_image' : 'summary';
    this.setTwitter({
      'twitter:card':        twitterCard,
      'twitter:title':       cfg.title,
      'twitter:description': cfg.description ?? '',
      'twitter:image':       imgUrl || '',
      ...(cfg.twitterSite    ? { 'twitter:site':    cfg.twitterSite }    : {}),
      ...(cfg.twitterCreator ? { 'twitter:creator': cfg.twitterCreator } : {})
    });

    // Canonical
    this.setCanonical(pageUrl || undefined);

    // hreflang alternates
    this.setAlternates(cfg.alternates || []);

    // JSON-LD (page)
    this.clearJsonLd();
    if (cfg.jsonLd) this.addJsonLd(cfg.jsonLd);
  }

  /** JSON-LD “sitewide” persistant (WebSite / Organization…) */
  setSitewideJsonLd(obj: object): void {
    if (!obj) return;
    let script = this.doc.getElementById('ld-sitewide') as HTMLScriptElement | null;
    if (!script) {
      script = this.rnd.createElement('script') as HTMLScriptElement;
      script.id = 'ld-sitewide';
      script.type = 'application/ld+json';
      this.rnd.appendChild(this.doc.head, script);
    }
    script.text = JSON.stringify(obj);
  }

  /* ======================
   * Outils OG / Twitter
   * ====================== */

  setOpenGraph(og: Record<string, string | undefined>): void {
    for (const [prop, val] of Object.entries(og)) {
      if (!prop.startsWith('og:')) continue;
      this.setPropMeta(prop, val);
    }
  }

  setTwitter(tw: Record<string, string | undefined>): void {
    for (const [name, val] of Object.entries(tw)) {
      if (!name.startsWith('twitter:')) continue;
      this.setNamedMeta(name, val);
    }
  }

  /* ======================
   * Canonical / hreflang
   * ====================== */

  setCanonical(url?: string): void {
    const link = this.upsertLink('canonical', url);
    if (!url && link) link.remove();
  }

  setAlternates(alts: Hreflang[]): void {
    // purge existants
    Array.from(this.doc.head.querySelectorAll('link[rel="alternate"][hreflang]'))
      .forEach(el => el.remove());

    if (!alts?.length) return;
    for (const a of alts) {
      if (!a.lang || !a.href) continue;
      const link = this.rnd.createElement('link') as HTMLLinkElement;
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', a.lang);
      link.setAttribute('href', a.href);
      this.rnd.appendChild(this.doc.head, link);
    }
  }

  /** Supprime les metas og:locale:alternate existantes (évite les doublons) */
  private clearOgLocaleAlternate(): void {
    try {
      this.doc
        .querySelectorAll('meta[property="og:locale:alternate"]')
        .forEach(m => m.remove());
    } catch {
      // no-op (SSR ou environnement sans DOM)
    }
  }


  /* ======================
   * JSON-LD page
   * ====================== */

  clearJsonLd(): void {
    this.doc.querySelectorAll<HTMLScriptElement>('script[data-jsonld="1"]').forEach(s => s.remove());
  }

  addJsonLd(obj: object): void {
    if (!obj) return;
    const script = this.rnd.createElement('script') as HTMLScriptElement;
    script.type = 'application/ld+json';
    script.text = JSON.stringify(obj);
    script.setAttribute('data-jsonld', '1');
    this.rnd.appendChild(this.doc.head, script);
  }

  /* ======================
   * Helpers URL / meta
   * ====================== */

  /** URL absolue courante (browser). En SSR, on renvoie siteUrl + router.url */
  currentUrl(): string {
    if (this.isBrowser) {
      try { return this.doc.defaultView?.location?.href ?? ''; } catch { return ''; }
    }
    return this.routerUrlAsAbs(environment.siteUrl || '');
  }

  /** Origin du site (browser) */
  siteOrigin(): string {
    if (!this.isBrowser) return '';
    try {
      const loc = this.doc.defaultView?.location;
      return loc ? `${loc.protocol}//${loc.host}` : '';
    } catch { return ''; }
  }

  /** Construit une absolue depuis router.url (SSR) */
  private routerUrlAsAbs(origin: string): string {
    const base = (origin || '').replace(/\/$/, '');
    const path = (this.router.url || '/').replace(/\/{2,}/g, '/');
    return base + (path.startsWith('/') ? path : `/${path}`);
  }

  /** Absolutise si besoin, en utilisant origin ou environment.siteUrl */
  private absUrl(url: string, origin: string): string {
    if (!url) return '';
    try {
      if (/^https?:\/\//i.test(url)) return url;           // déjà absolue
      if (/^\/\//.test(url)) return (this.isBrowser ? (this.doc.defaultView?.location?.protocol ?? 'https:') : 'https:') + url;
      const base = (origin || environment.siteUrl || '').replace(/\/$/, '');
      return base ? `${base}${url.startsWith('/') ? url : `/${url}`}` : url;
    } catch { return url; }
  }

  private setNamedMeta(name: string, content?: string): void {
    if (!content) { this.removeMeta('name', name); return; }
    this.meta.updateTag({ name, content }, `name='${cssEscape(name)}'`);
  }

  private setPropMeta(property: string, content?: string): void {
    if (!content) { this.removeMeta('property', property); return; }
    this.meta.updateTag({ property, content }, `property='${cssEscape(property)}'`);
  }

  private removeMeta(kind: 'name' | 'property', token: string): void {
    const selector = `${kind}='${cssEscape(token)}'`;
    const el = this.doc.head.querySelector(`meta[${selector}]`);
    if (el) el.remove();
  }

  private upsertLink(rel: string, href?: string): HTMLLinkElement | null {
    let link = this.doc.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!href) {
      if (link) link.remove();
      return link || null;
    }
    if (!link) {
      link = this.rnd.createElement('link') as HTMLLinkElement;
      link.setAttribute('rel', rel);
      this.rnd.appendChild(this.doc.head, link);
    }
    link.setAttribute('href', href);
    return link;
  }
}

/** Échappe une valeur pour un sélecteur CSS attribute */
function cssEscape(v: string): string {
  return v.replace(/"/g, '\\"');
}
