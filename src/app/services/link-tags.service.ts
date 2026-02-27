import { Inject, Injectable, Optional } from '@angular/core';
import { DOCUMENT } from '@angular/common';

type HreflangItem = { lang: string; href: string };

@Injectable({ providedIn: 'root' })
export class LinkTagsService {
  constructor(@Inject(DOCUMENT) private doc: Document) {}

  setCanonical(href: string) {
    if (!href) return;
    const head = this.doc?.head;
    if (!head) return;

    // remove existing canonical(s)
    head.querySelectorAll('link[rel="canonical"]').forEach(n => n.remove());

    const link = this.doc.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', href);
    head.appendChild(link);
  }

  setHreflangs(items: HreflangItem[]) {
    const head = this.doc?.head;
    if (!head) return;

    // remove existing alternates
    head.querySelectorAll('link[rel="alternate"][hreflang]').forEach(n => n.remove());

    for (const it of items || []) {
      if (!it?.lang || !it?.href) continue;
      const link = this.doc.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', it.lang);
      link.setAttribute('href', it.href);
      head.appendChild(link);
    }
  }
}
