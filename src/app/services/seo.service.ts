import { Injectable, Inject, Renderer2, RendererFactory2 } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

export interface SeoConfig {
  title:        string;
  description?: string;
  keywords?:    string;
  image?:       string;
  type?:        'website' | 'article';
  jsonLd?:      object;
}

@Injectable({ providedIn: 'root' })
export class SeoService {

  private rnd: Renderer2;

  constructor(
    private title: Title,
    private meta : Meta,
    @Inject(DOCUMENT) private doc: Document,
    renderer: RendererFactory2
  ) {
    this.rnd = renderer.createRenderer(null, null);
  }

  update(cfg: SeoConfig): void {

    this.title.setTitle(cfg.title);
    this.setMeta('description', cfg.description ?? '');
    if (cfg.keywords) this.setMeta('keywords', cfg.keywords);

    this.setMeta('og:type',        cfg.type ?? 'website', true);
    this.setMeta('og:title',       cfg.title,             true);
    this.setMeta('og:description', cfg.description ?? '', true);
    if (cfg.image) this.setMeta('og:image', cfg.image, true);

    this.setMeta('og:url', this.doc.location.href, true);
    this.setMeta('twitter:card', 'summary_large_image');
    this.setMeta('twitter:title', cfg.title);
    if (cfg.description) this.setMeta('twitter:description', cfg.description);
    if (cfg.image)       this.setMeta('twitter:image', cfg.image);

    let canonical = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!canonical) {
      canonical = this.rnd.createElement('link') as HTMLLinkElement;
      canonical.setAttribute('rel', 'canonical');
      this.rnd.appendChild(this.doc.head, canonical);
    }
    canonical.setAttribute('href', this.doc.location.href);

    Array.from(
      this.doc.querySelectorAll<HTMLScriptElement>('script[data-jsonld="1"]')
    ).forEach(el => el.remove());

    if (cfg.jsonLd) {
      const script = this.rnd.createElement('script') as HTMLScriptElement;
      script.type = 'application/ld+json';
      script.text = JSON.stringify(cfg.jsonLd);
      script.setAttribute('data-jsonld', '1');
      this.rnd.appendChild(this.doc.head, script);
    }
  }

  private setMeta(name: string, content: string, property = false): void {
    this.meta.updateTag({ [property ? 'property' : 'name']: name, content });
  }
}
