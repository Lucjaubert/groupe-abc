import {
  SEO_FR_HOME,
  SEO_FR_ABOUT,
  SEO_FR_SERVICES,
  SEO_FR_METHODS,
  SEO_FR_TEAM,
  SEO_FR_NEWS_LIST,
  SEO_FR_CONTACT,
  SEO_FR_LEGAL,
  SEO_EN_HOME,
  SEO_EN_ABOUT,
  SEO_EN_SERVICES,
  SEO_EN_METHODS,
  SEO_EN_TEAM,
  SEO_EN_NEWS_LIST,
  SEO_EN_CONTACT,
  SEO_EN_LEGAL,
} from './seo-pages.config';
import { SeoConfig } from '../services/seo.service';

// 👇 export pour réutiliser ailleurs (faq.routes.ts, etc.)
export type Lang = 'fr' | 'en';

// 👇 export pour typer les clés de routes FAQ / SEO
export type SeoRouteKey =
  | 'home'
  | 'about'
  | 'services'
  | 'methods'
  | 'team'
  | 'news-list'
  | 'contact'
  | 'legal';

export const SEO_ROUTE_CONFIG: Record<SeoRouteKey, { fr: SeoConfig; en: SeoConfig }> = {
  home:       { fr: SEO_FR_HOME,      en: SEO_EN_HOME },
  about:      { fr: SEO_FR_ABOUT,     en: SEO_EN_ABOUT },
  services:   { fr: SEO_FR_SERVICES,  en: SEO_EN_SERVICES },
  methods:    { fr: SEO_FR_METHODS,   en: SEO_EN_METHODS },
  team:       { fr: SEO_FR_TEAM,      en: SEO_EN_TEAM },
  'news-list':{ fr: SEO_FR_NEWS_LIST, en: SEO_EN_NEWS_LIST },
  contact:    { fr: SEO_FR_CONTACT,   en: SEO_EN_CONTACT },
  legal:      { fr: SEO_FR_LEGAL,     en: SEO_EN_LEGAL },
};

export function getSeoForRoute(key: SeoRouteKey, lang: Lang): SeoConfig {
  return SEO_ROUTE_CONFIG[key][lang];
}
