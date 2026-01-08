// src/app/resolvers/seo-resolver.service.ts
import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve } from '@angular/router';
import { SeoService, SeoConfig } from '../services/seo.service';
import { getSeoForRoute } from '../config/seo.routes';

@Injectable({ providedIn: 'root' })
export class SeoResolver implements Resolve<SeoConfig | null> {

  constructor(private seo: SeoService) {}

  resolve(route: ActivatedRouteSnapshot): SeoConfig | null {
    // exemple : on met une clé dans la data de la route
    const key = route.data['seoKey'] as
      | 'home'
      | 'about'
      | 'services'
      | 'methods'
      | 'team'
      | 'news-list'
      | 'contact'
      | 'legal'
      | undefined;

    if (!key) return null;

    const isEN = route.routeConfig?.path?.startsWith('en/') ?? false;
    const lang = isEN ? 'en' : 'fr';

    const cfg = getSeoForRoute(key, lang);

    // application directe ici
    this.seo.update(cfg);

    // on renvoie éventuellement la config (optionnel)
    return cfg;
  }
}
