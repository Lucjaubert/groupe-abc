import { Injectable, Inject, Renderer2, RendererFactory2, PLATFORM_ID } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

export interface SeoConfig {
  title:        string;
  description?: string;
  keywords?:    string;            // utile pour certains moteurs/outils
  image?:       string;            // URL absolue recommandée
  type?:        'website' | 'article';
  canonical?:   string;            // si non fourni, déduit de currentUrl()
  jsonLd?:      object;            // JSON-LD principal (optionnel)
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

  /** Mise à jour standard (Title + Description + OG/Twitter + Canonical + JSON-LD optionnel) */
  update(cfg: SeoConfig): void {
    // Title
    if (cfg.title) this.title.setTitle(cfg.title);

    // Meta de base
    this.setNamedMeta('description', cfg.description);
    this.setNamedMeta('keywords', cfg.keywords);

    // Open Graph (propriétés)
    this.setOpenGraph({
      'og:type':        cfg.type ?? 'website',
      'og:title':       cfg.title,
      'og:description': cfg.description ?? '',
      'og:image':       cfg.image || '',
      'og:url':         this.currentUrl() || ''
    });

    // Twitter
    this.setTwitter({
      'twitter:card':        'summary_large_image',
      'twitter:title':       cfg.title,
      'twitter:description': cfg.description ?? '',
      'twitter:image':       cfg.image || ''
    });

    // Canonical
    this.setCanonical(cfg.canonical || this.currentUrl() || undefined);

    // JSON-LD principal
    this.clearJsonLd();
    if (cfg.jsonLd) this.addJsonLd(cfg.jsonLd);
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

  /** Définit (ou retire) le canonical */
  setCanonical(url?: string): void {
    if (!this.isBrowser) return; // pas d’head côté serveur avec ce renderer
    let link = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!url) {
      if (link) link.remove();
      return;
    }
    if (!link) {
      link = this.rnd.createElement('link') as HTMLLinkElement;
      link.setAttribute('rel', 'canonical');
      this.rnd.appendChild(this.doc.head, link);
    }
    link.setAttribute('href', url);
  }

  /** Supprime tous les scripts JSON-LD précédemment injectés par ce service */
  clearJsonLd(): void {
    if (!this.isBrowser) return;
    this.doc.querySelectorAll<HTMLScriptElement>('script[data-jsonld="1"]').forEach(s => s.remove());
  }

  /** Ajoute un script JSON-LD */
  addJsonLd(obj: object): void {
    if (!this.isBrowser || !obj) return;
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

  /* ======================
   * Helpers internes
   * ====================== */

  private setNamedMeta(name: string, content?: string): void {
    // si pas de contenu → on supprime la meta pour éviter le bruit
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
}

/** Échappe une valeur pour un sélecteur CSS attribute */
function cssEscape(v: string): string {
  // minimal, suffisant pour nos noms de metas
  return v.replace(/"/g, '\\"');
}
