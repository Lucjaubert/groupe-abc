import { Injectable, Inject, Renderer2, RendererFactory2, PLATFORM_ID } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

export type OgType = 'website' | 'article';

export interface Hreflang {
  lang: string;     // 'fr', 'en', 'x-default', ...
  href: string;     // URL absolue recommandée
}

export interface SeoConfig {
  title:        string;
  description?: string;
  keywords?:    string;

  // Langues
  lang?:        'fr' | 'en';           // pilote <html lang> + meta content-language
  locale?:      string;                // ex. 'fr_FR' | 'en_US'
  localeAlt?:   string[];              // ex. ['en_US'] -> og:locale:alternate

  image?:       string;                 // URL absolue ou relative
  imageAlt?:    string;                 // texte alternatif de l'image
  imageWidth?:  number;                 // ex. 1200
  imageHeight?: number;                 // ex. 630

  type?:        OgType;                 // 'website' | 'article'
  canonical?:   string;                 // URL absolue ou relative
  robots?:      string;                 // 'index,follow' | 'noindex,nofollow'

  // Twitter (facultatif)
  twitterSite?:    string;              // '@groupeabc'
  twitterCreator?: string;              // '@auteur'

  // Article (optionnel si type='article')
  publishedTime?: string;               // ISO 8601
  modifiedTime?:  string;               // ISO 8601

  // Hreflang alternates
  alternates?:   Hreflang[];

  // JSON-LD de page (@graph ou objet)
  jsonLd?:       object;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private rnd: Renderer2;
  private isBrowser: boolean;

  constructor(
    private title: Title,
    private meta : Meta,
    @Inject(DOCUMENT) private doc: Document,
    @Inject(PLATFORM_ID) platformId: Object,
    renderer: RendererFactory2
  ) {
    this.rnd = renderer.createRenderer(null, null);
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /** Mise à jour standard (Title + metas + OG/Twitter + Canonical + JSON-LD + hreflang + langue) */
  update(cfg: SeoConfig): void {
    // Title
    if (cfg.title) this.title.setTitle(cfg.title);

    // Langue document (<html lang>) + meta content-language
    if (cfg.lang) {
      this.doc.documentElement.setAttribute('lang', cfg.lang);
      this.setNamedMeta('content-language', cfg.lang);
    }

    // Metas de base
    this.setNamedMeta('description', cfg.description);
    this.setNamedMeta('keywords', cfg.keywords);

    // Robots
    this.setNamedMeta('robots', cfg.robots);
    this.setNamedMeta('googlebot', cfg.robots);

    // Résolution des URLs (absolutise si besoin)
    const origin  = this.siteOrigin() || '';
    const pageUrl = this.absUrl(cfg.canonical || this.currentUrl() || '', origin);
    const imgUrl  = this.absUrl(cfg.image || '', origin);

    // Open Graph
    const ogType: OgType = cfg.type ?? 'website';
    const ogLocale = cfg.locale || (cfg.lang === 'en' ? 'en_US' : 'fr_FR');
    this.setOpenGraph({
      'og:type':        ogType,
      'og:locale':      ogLocale,
      'og:title':       cfg.title,
      'og:description': cfg.description ?? '',
      'og:image':       imgUrl || '',
      'og:url':         pageUrl
    });

    // og:locale:alternate (autres langues dispo)
    this.clearOgLocaleAlternate();
    (cfg.localeAlt || (ogLocale.startsWith('fr') ? ['en_US'] : ['fr_FR']))
      .forEach(l => this.setPropMeta('og:locale:alternate', l));

    // OG image details
    if (imgUrl) {
      this.setPropMeta('og:image:alt',   cfg.imageAlt || cfg.title);
      if (cfg.imageWidth)  this.setPropMeta('og:image:width',  String(cfg.imageWidth));
      if (cfg.imageHeight) this.setPropMeta('og:image:height', String(cfg.imageHeight));
    }

    // Article times
    if (ogType === 'article') {
      if (cfg.publishedTime) this.setPropMeta('article:published_time', cfg.publishedTime);
      if (cfg.modifiedTime)  this.setPropMeta('article:modified_time',  cfg.modifiedTime);
    }

    // Twitter (si pas d'image → 'summary')
    const twitterCard = imgUrl ? 'summary_large_image' : 'summary';
    this.setTwitter({
      'twitter:card':        twitterCard,
      'twitter:title':       cfg.title,
      'twitter:description': cfg.description ?? '',
      'twitter:image':       imgUrl || '',
      ...(cfg.twitterSite    ? { 'twitter:site':    cfg.twitterSite }    : {}),
      ...(cfg.twitterCreator ? { 'twitter:creator': cfg.twitterCreator } : {})
    });

    // Canonical (actif aussi en SSR)
    this.setCanonical(pageUrl || undefined);

    // hreflang alternates
    this.setAlternates(cfg.alternates || []);

    // JSON-LD de page (remplace les précédents de page)
    this.clearJsonLd();
    if (cfg.jsonLd) this.addJsonLd(cfg.jsonLd);
  }

  /** JSON-LD “sitewide” (WebSite/Organization…), injecté une fois et persistant */
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

  /** Ajoute/merge des propriétés Open Graph (property="og:*") */
  setOpenGraph(og: Record<string, string | undefined>): void {
    for (const [prop, val] of Object.entries(og)) {
      if (!prop.startsWith('og:')) continue;
      this.setPropMeta(prop, val);
    }
  }

  /** Ajoute/merge des propriétés Twitter (name="twitter:*") */
  setTwitter(tw: Record<string, string | undefined>): void {
    for (const [name, val] of Object.entries(tw)) {
      if (!name.startsWith('twitter:')) continue;
      this.setNamedMeta(name, val);
    }
  }

  /** Définit (ou retire) le canonical — fonctionne aussi en SSR */
  setCanonical(url?: string): void {
    const link = this.upsertLink('canonical', url);
    if (!url && link) link.remove();
  }

  /** hreflang alternates (supprime puis recrée) */
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

  /** Supprime les metas og:locale:alternate existantes */
  private clearOgLocaleAlternate(): void {
    this.doc.querySelectorAll('meta[property="og:locale:alternate"]').forEach(m => m.remove());
  }

  /** Supprime tous les scripts JSON-LD “page” injectés par ce service */
  clearJsonLd(): void {
    this.doc.querySelectorAll<HTMLScriptElement>('script[data-jsonld="1"]').forEach(s => s.remove());
  }

  /** Ajoute un script JSON-LD “page” */
  addJsonLd(obj: object): void {
    if (!obj) return;
    const script = this.rnd.createElement('script') as HTMLScriptElement;
    script.type = 'application/ld+json';
    script.text = JSON.stringify(obj);
    script.setAttribute('data-jsonld', '1');
    this.rnd.appendChild(this.doc.head, script);
  }

  /** URL absolue courante côté navigateur ; string vide côté serveur */
  currentUrl(): string {
    if (!this.isBrowser) return '';
    try { return this.doc.defaultView?.location?.href ?? ''; } catch { return ''; }
  }

  /** Origin du site (https://domaine.tld) ; string vide côté serveur */
  siteOrigin(): string {
    if (!this.isBrowser) return '';
    try {
      const loc = this.doc.defaultView?.location;
      return loc ? `${loc.protocol}//${loc.host}` : '';
    } catch { return ''; }
  }

  /** Absolutise une URL relative si besoin (sinon renvoie telle quelle) */
  private absUrl(url: string, origin: string): string {
    if (!url) return '';
    try {
      // déjà absolue
      if (/^https?:\/\//i.test(url)) return url;
      // protocole-relative //domain/...
      if (/^\/\//.test(url)) return (this.isBrowser ? (this.doc.defaultView?.location?.protocol ?? 'https:') : 'https:') + url;
      // relative → préfixe origin si dispo
      return origin ? origin.replace(/\/$/, '') + (url.startsWith('/') ? url : `/${url}`) : url;
    } catch { return url; }
  }

  /* ======================
   * Helpers internes
   * ====================== */

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

  /** Crée ou met à jour un <link rel="...">; renvoie l'élément */
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
