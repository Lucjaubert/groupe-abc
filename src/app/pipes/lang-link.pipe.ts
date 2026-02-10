// src/app/pipes/lang-link.pipe.ts

import { Pipe, PipeTransform } from '@angular/core';
import { LanguageService, Lang } from '../services/language.service';

@Pipe({
  name: 'langLink',
  standalone: true,
})
export class LangLinkPipe implements PipeTransform {
  constructor(private lang: LanguageService) {}

  transform(path: string, forceLang?: Lang): string {
    if (!path) return '/';

    // liens externes : on ne touche pas
    const raw = String(path).trim();
    if (/^https?:\/\//i.test(raw)) return raw;

    // normalise chemin
    let p = raw.startsWith('/') ? raw : `/${raw}`;
    p = p.replace(/\/{2,}/g, '/');

    // langue à appliquer : soit forcée, soit langue courante
    const target: Lang = forceLang || this.lang.lang;

    // ---------- EN ----------
    if (target === 'en') {
      if (p === '/en' || p.startsWith('/en/')) return p;
      return (`/en${p}`).replace(/\/{2,}/g, '/');
    }

    // ---------- FR ----------
    if (p === '/en') return '/';
    if (p.startsWith('/en/')) {
      const stripped = p.slice(3) || '/';
      return stripped === '' ? '/' : stripped;
    }

    return p;
  }
}
