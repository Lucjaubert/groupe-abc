import { Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from '../services/language.service';

@Pipe({
  name: 'langLink',
  standalone: true,
})
export class LangLinkPipe implements PipeTransform {

  constructor(private lang: LanguageService) {}

  transform(path: string): string {
    if (!path) {
      return '/';
    }

    // normalise
    let p = path.startsWith('/') ? path : `/${path}`;
    p = p.replace(/\/{2,}/g, '/');

    const current = this.lang.lang;

    // Si on est en EN : on préfixe par /en si pas déjà fait
    if (current === 'en') {
      // si déjà en /en ou lien absolu externe, on ne touche pas
      if (p === '/en' || p.startsWith('/en/')) return p;
      if (p.startsWith('http://') || p.startsWith('https://')) return p;

      return (`/en${p}`).replace(/\/{2,}/g, '/');
    }

    // Si on est en FR :
    // - /en → /
    // - /en/xxx → /xxx
    if (p === '/en') return '/';
    if (p.startsWith('/en/')) {
      const stripped = p.slice(3) || '/';
      return stripped === '' ? '/' : stripped;
    }

    return p;
  }
}


