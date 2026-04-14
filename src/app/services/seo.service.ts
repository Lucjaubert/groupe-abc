import {
  Injectable,
  Inject,
  Optional,
  Renderer2,
  RendererFactory2,
  PLATFORM_ID,
} from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export type OgType = 'website' | 'article';

export interface Hreflang {
  lang: string;
  href: string;
}

export interface SeoConfig {
  title: string;
  description?: string;
  keywords?: string;

  // Langues
  lang?: 'fr' | 'en';
  locale?: string;
  localeAlt?: string[];

  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;

  type?: OgType;
  canonical?: string;
  robots?: string;

  // Twitter
  twitterSite?: string;
  twitterCreator?: string;

  // Article
  publishedTime?: string;
  modifiedTime?: string;

  // Hreflang
  alternates?: Hreflang[];

  // JSON-LD (@graph ou objet)
  jsonLd?: object;
}

/**
 * Mapping canonique FR ⇄ EN pour les pages majeures.
 * IMPORTANT :
 *  - chemins ABSOLUS, incluant /en pour la version EN
 *  - DOIT refléter tes vraies routes Angular.
 */
const ALT_MAP: { fr: string; en: string }[] = [
  { fr: '/', en: '/en' },

  { fr: '/expert-immobilier-reseau-national', en: '/en/expert-network-chartered-valuers' },
  { fr: '/expertise-immobiliere-services', en: '/en/real-estate-valuation-services' },
  { fr: '/methodes-evaluation-immobiliere', en: '/en/valuation-methods-assets' },
  { fr: '/experts-immobiliers-agrees', en: '/en/chartered-valuers-team' },
  { fr: '/actualites-expertise-immobiliere', en: '/en/real-estate-valuation-news' },
  { fr: '/contact-expert-immobilier', en: '/en/contact-chartered-valuers' },

  { fr: '/mentions-legales', en: '/en/legal-notice' },
];

/**
 * Type minimal “express-like” pour SSR_REQUEST
 * (évite d’importer express côté Angular)
 */
type SsrRequestLike = {
  header?: (name: string) => string | undefined;
  headers?: Record<string, any>;
};

@Injectable({ providedIn: 'root' })
export class SeoService {
  private rnd: Renderer2;
  private isBrowser: boolean;

  constructor(
    private title: Title,
    private meta: Meta,
    private router: Router,
    @Inject(DOCUMENT) private doc: Document,
    @Inject(PLATFORM_ID) platformId: Object,
    renderer: RendererFactory2,

    // ✅ Injecté par ton SSR (run-ssr.mjs) si tu le fournis
    //   provider: { provide: 'SSR_REQUEST', useValue: req }
    @Optional() @Inject('SSR_REQUEST') private ssrReq?: SsrRequestLike,
  ) {
    this.rnd = renderer.createRenderer(null, null);
    this.isBrowser = isPlatformBrowser(platformId);
  }

  update(cfg: SeoConfig): void {
    if (cfg.title) this.title.setTitle(cfg.title);

    // <html lang> + meta content-language
    if (cfg.lang) {
      try {
        this.doc.documentElement.setAttribute('lang', cfg.lang);
      } catch {}
      this.setNamedMeta('content-language', cfg.lang);
    }

    // Metas classiques
    this.setNamedMeta('description', cfg.description);
    this.setNamedMeta('keywords', cfg.keywords);

    // Robots (default index,follow)
    const robots = cfg.robots && cfg.robots.trim().length ? cfg.robots : 'index,follow';
    this.setNamedMeta('robots', robots);
    this.setNamedMeta('googlebot', robots);

    // Origin & URLs
    const origin = this.siteOrigin();
    const routerPath = this.normalizePath((this.router.url || '/').split(/[?#]/)[0]);

    const pageUrl = this.absUrl(
      cfg.canonical || this.absFromOrigin(origin, routerPath),
      origin,
    );
    const imgUrl = this.absUrl(cfg.image || '', origin);

    // Open Graph
    const ogType = (cfg.type ?? 'website') as OgType;
    const ogLocale = cfg.locale || (cfg.lang === 'en' ? 'en_US' : 'fr_FR');

    this.setOpenGraph({
      'og:type': ogType,
      'og:locale': ogLocale,
      'og:title': cfg.title,
      'og:description': cfg.description ?? '',
      'og:image': imgUrl || '',
      'og:url': pageUrl,
    });

    // og:locale:alternate
    this.clearOgLocaleAlternate();
    (cfg.localeAlt || (ogLocale.startsWith('fr') ? ['en_US'] : ['fr_FR'])).forEach((l) =>
      this.setPropMeta('og:locale:alternate', l),
    );

    // OG image details
    if (imgUrl) {
      this.setPropMeta('og:image:alt', cfg.imageAlt || cfg.title);
      if (cfg.imageWidth) this.setPropMeta('og:image:width', String(cfg.imageWidth));
      if (cfg.imageHeight) this.setPropMeta('og:image:height', String(cfg.imageHeight));
    }

    // Article
    if (ogType === 'article') {
      if (cfg.publishedTime) this.setPropMeta('article:published_time', cfg.publishedTime);
      if (cfg.modifiedTime) this.setPropMeta('article:modified_time', cfg.modifiedTime);
    }

    // Twitter
    const twitterCard = imgUrl ? 'summary_large_image' : 'summary';
    this.setTwitter({
      'twitter:card': twitterCard,
      'twitter:title': cfg.title,
      'twitter:description': cfg.description ?? '',
      'twitter:image': imgUrl || '',
      ...(cfg.twitterSite ? { 'twitter:site': cfg.twitterSite } : {}),
      ...(cfg.twitterCreator ? { 'twitter:creator': cfg.twitterCreator } : {}),
    });

    // ✅ Canonical (toujours injecté dans le HTML SSR)
    this.setCanonical(pageUrl || undefined);

    // ✅ hreflang alternates (toujours injectés dans le HTML SSR)
    const hreflangs =
      cfg.alternates && cfg.alternates.length
        ? cfg.alternates
        : this.buildDefaultAlternates(origin, routerPath);

    this.setAlternates(hreflangs);

    // JSON-LD (page)
    this.clearJsonLd();
    if (cfg.jsonLd) this.addJsonLd(cfg.jsonLd);
  }

  /** JSON-LD “sitewide” persistant (WebSite / Organization…) */
  setSitewideJsonLd(obj: object): void {
    if (!obj) return;

    const head = this.getHead();
    if (!head) return;

    let script = this.doc.getElementById('ld-sitewide') as HTMLScriptElement | null;
    if (!script) {
      script = this.rnd.createElement('script') as HTMLScriptElement;
      script.id = 'ld-sitewide';
      script.type = 'application/ld+json';
      try {
        this.rnd.appendChild(head, script);
      } catch {}
    }
    try {
      script.text = JSON.stringify(obj);
    } catch {}
  }

  /* ======================
   * Hreflang mapping
   * ====================== */

  private buildDefaultAlternates(origin: string, path: string): Hreflang[] {
    const clean = this.normalizePath(path) || '/';

    // 1) On cherche dans le ALT_MAP
    const direct = ALT_MAP.find((p) => p.fr === clean || p.en === clean);

    if (direct) {
      const isEn = clean === direct.en;

      const frHref = this.absFromOrigin(origin, direct.fr);
      const enHref = this.absFromOrigin(origin, direct.en);

      return [
        { lang: 'fr', href: frHref },
        { lang: 'en', href: enHref },
        { lang: 'x-default', href: isEn ? enHref : frHref },
      ];
    }

    /**
     * Détail d’actif (FR) : /methodes-evaluation-immobiliere/:slug
     * -> EN : /en/valuation-methods-assets/:slug
     */
    if (clean.startsWith('/methodes-evaluation-immobiliere/')) {
      const slug = clean
        .replace('/methodes-evaluation-immobiliere/', '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');

      if (slug) {
        const frHref = this.absFromOrigin(origin, `/methodes-evaluation-immobiliere/${slug}`);
        const enHref = this.absFromOrigin(origin, `/en/valuation-methods-assets/${slug}`);

        return [
          { lang: 'fr', href: frHref },
          { lang: 'en', href: enHref },
          { lang: 'x-default', href: frHref },
        ];
      }
    }

    /**
     * Détail d’actif (EN) : /en/valuation-methods-assets/:slug
     * -> FR : /methodes-evaluation-immobiliere/:slug
     */
    if (clean.startsWith('/en/valuation-methods-assets/')) {
      const slug = clean
        .replace('/en/valuation-methods-assets/', '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');

      if (slug) {
        const frHref = this.absFromOrigin(origin, `/methodes-evaluation-immobiliere/${slug}`);
        const enHref = this.absFromOrigin(origin, `/en/valuation-methods-assets/${slug}`);

        return [
          { lang: 'fr', href: frHref },
          { lang: 'en', href: enHref },
          { lang: 'x-default', href: frHref },
        ];
      }
    }

    // 2) Fallback générique (routes non mappées)
    const isEn = clean === '/en' || clean.startsWith('/en/');
    const frPath = isEn ? clean.replace(/^\/en(\/|$)/, '/') || '/' : clean;
    const enPath = isEn ? clean : clean === '/' ? '/en' : `/en${clean}`;

    const frHref = this.absFromOrigin(origin, frPath);
    const enHref = this.absFromOrigin(origin, enPath);

    return [
      { lang: 'fr', href: frHref },
      { lang: 'en', href: enHref },
      { lang: 'x-default', href: isEn ? enHref : frHref },
    ];
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
    const head = this.getHead();
    if (!head) return;

    try {
      Array.from(head.querySelectorAll('link[rel="alternate"][hreflang]')).forEach((el) => el.remove());
    } catch {}

    if (!alts?.length) return;

    for (const a of alts) {
      if (!a.lang || !a.href) continue;
      const link = this.rnd.createElement('link') as HTMLLinkElement;
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', a.lang);
      link.setAttribute('href', a.href);
      try {
        this.rnd.appendChild(head, link);
      } catch {}
    }
  }

  private clearOgLocaleAlternate(): void {
    try {
      this.doc.querySelectorAll('meta[property="og:locale:alternate"]').forEach((m) => m.remove());
    } catch {}
  }

  /* ======================
   * JSON-LD page
   * ====================== */

  clearJsonLd(): void {
    try {
      this.doc
        .querySelectorAll<HTMLScriptElement>('script[data-jsonld="1"]')
        .forEach((s) => s.remove());
    } catch {}
  }

  addJsonLd(obj: object): void {
    if (!obj) return;

    const head = this.getHead();
    if (!head) return;

    const script = this.rnd.createElement('script') as HTMLScriptElement;
    script.type = 'application/ld+json';
    script.setAttribute('data-jsonld', '1');
    try {
      script.text = JSON.stringify(obj);
    } catch {
      script.text = '';
    }
    try {
      this.rnd.appendChild(head, script);
    } catch {}
  }

  /* ======================
   * Helpers URL / meta
   * ====================== */

  currentUrl(): string {
    const base = (environment.siteUrl || 'https://groupe-abc.fr').replace(/\/$/, '');
    const path = this.normalizePath(this.router.url || '/');

    if (!this.isBrowser) {
      return this.absFromOrigin(base, path);
    }

    try {
      return this.doc.defaultView?.location?.href ?? this.absFromOrigin(base, path);
    } catch {
      return this.absFromOrigin(base, path);
    }
  }

  /**
   * ✅ Origin SSR fiable :
   * - prend host + x-forwarded-proto si SSR_REQUEST est fourni
   * - sinon fallback environment.siteUrl
   */
  siteOrigin(): string {
    const fallback = (environment.siteUrl || 'https://groupe-abc.fr').replace(/\/$/, '');

    // SSR: req headers
    if (!this.isBrowser && this.ssrReq) {
      try {
        const h = (name: string) =>
          this.ssrReq?.header?.(name) ||
          (this.ssrReq?.headers?.[name] as string | undefined);

        const proto = String(h('x-forwarded-proto') || h('X-Forwarded-Proto') || 'https')
          .split(',')[0]
          .trim();
        const host = String(h('host') || h('Host') || 'groupe-abc.fr')
          .split(',')[0]
          .trim();

        return `${proto}://${host}`.replace(/\/$/, '');
      } catch {
        return fallback;
      }
    }

    // Browser
    if (this.isBrowser) {
      try {
        const loc = this.doc.defaultView?.location;
        return loc ? `${loc.protocol}//${loc.host}` : fallback;
      } catch {
        return fallback;
      }
    }

    return fallback;
  }

  /**
   * Convertit `url` en URL absolue fiable sans casser `https://`
   * - accepte absolu http(s)
   * - accepte protocole relatif //cdn...
   * - accepte relatif /path ou path
   */
  private absUrl(url: string, origin: string): string {
    if (!url) return '';

    try {
      // Déjà absolu
      if (/^https?:\/\//i.test(url)) return url;

      // Protocole relatif
      if (/^\/\//.test(url)) {
        const proto = this.isBrowser
          ? this.doc.defaultView?.location?.protocol ?? 'https:'
          : 'https:';
        return proto + url;
      }

      // Relatif -> absolu
      const base = (origin || environment.siteUrl || '').replace(/\/$/, '');
      if (!base) return url;

      return new URL(url.startsWith('/') ? url : `/${url}`, base).toString();
    } catch {
      return url;
    }
  }

  /**
   * Construit une URL absolue à partir d’un origin + path
   * (évite les `.replace(/\/{2,}/g,'/')` qui cassent https://)
   */
  private absFromOrigin(origin: string, path: string): string {
    const base = (origin || '').replace(/\/$/, '');
    const p = this.normalizePath(path || '/');
    try {
      return new URL(p, base).toString();
    } catch {
      return base + (p.startsWith('/') ? p : `/${p}`);
    }
  }

  private normalizePath(p: string): string {
    const raw = (p || '/').split(/[?#]/)[0] || '/';
    const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
    // on normalise uniquement le PATH (pas d'URL absolue ici)
    return withSlash.replace(/\/{2,}/g, '/');
  }

  private setNamedMeta(name: string, content?: string): void {
    if (!content) {
      this.removeMeta('name', name);
      return;
    }
    this.meta.updateTag({ name, content }, `name='${cssEscape(name)}'`);
  }

  private setPropMeta(property: string, content?: string): void {
    if (!content) {
      this.removeMeta('property', property);
      return;
    }
    this.meta.updateTag({ property, content }, `property='${cssEscape(property)}'`);
  }

  private removeMeta(kind: 'name' | 'property', token: string): void {
    const head = this.getHead();
    if (!head) return;

    try {
      const selector = `${kind}='${cssEscape(token)}'`;
      const el = head.querySelector(`meta[${selector}]`);
      if (el) el.remove();
    } catch {}
  }

  private upsertLink(rel: string, href?: string): HTMLLinkElement | null {
    const head = this.getHead();
    if (!head) return null;

    let link: HTMLLinkElement | null = null;

    try {
      link = head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    } catch {}

    if (!href) {
      if (link) {
        try {
          link.remove();
        } catch {}
      }
      return link || null;
    }

    if (!link) {
      link = this.rnd.createElement('link') as HTMLLinkElement;
      link.setAttribute('rel', rel);
      try {
        this.rnd.appendChild(head, link);
      } catch {}
    }

    link.setAttribute('href', href);
    return link;
  }

  /**
   * ✅ Head SSR-safe (Domino)
   * - document.head si dispo
   * - sinon <head> via getElementsByTagName
   */
  private getHead(): HTMLElement | null {
    try {
      if ((this.doc as any)?.head) return (this.doc as any).head as HTMLElement;
      const heads = this.doc.getElementsByTagName('head');
      return (heads && heads.length ? (heads[0] as any) : null) as HTMLElement | null;
    } catch {
      return null;
    }
  }
}

function cssEscape(v: string): string {
  // escape minimal pour selectors entre quotes
  return String(v)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
}
