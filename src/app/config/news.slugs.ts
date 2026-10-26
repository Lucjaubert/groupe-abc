// src/app/config/news.slugs.ts
//
// Source de vérité UNIQUE des URL d'actualités (app Angular + sitemap server.ts).
// - FR : /actualites-expertise-immobiliere/<slug WP>
// - EN : /en/real-estate-valuation-news/<slug EN traduit, sinon slug WP>
// Aucun slug dérivé du titre, aucun alias historique : le slug WordPress fait foi.

export type Lang = 'fr' | 'en';

/**
 * Base paths (listing) pour les pages News.
 * - FR: /actualites-expertise-immobiliere/:slug
 * - EN: /en/real-estate-valuation-news/:slug
 */
export const NEWS_BASE: Record<Lang, string> = {
  fr: '/actualites-expertise-immobiliere',
  en: '/en/real-estate-valuation-news',
};

/**
 * Post WP "news" : porte l'intro de la page Actualités (acf.news),
 * ce n'est pas un article -> jamais de page détail ni d'entrée sitemap.
 */
export const NEWS_INTRO_SLUG = 'news';

/**
 * Slugs WP "article-N" : redirigés en 301 vers la liste par nginx,
 * ils ne peuvent donc jamais répondre 200 -> exclus des liens et du sitemap.
 */
const NGINX_REDIRECTED_SLUG = /^article-\d+$/;

/**
 * Slugs EN "propres" (display) pour chaque slug WP.
 * Clé   = slug WP (FR)
 * Valeur = slug affiché dans l'URL EN
 * Les articles non listés gardent le slug WP en EN.
 */
export const NEWS_CANONICAL_TO_EN: Record<string, string> = {
  'point-marche-l-immobilier-commercial-bordelais': 'bordeaux-commercial-real-estate-market-update',
  'permis-de-louer-a-bordeaux-tout': 'bordeaux-rental-permit-everything-you-need-to-know',
  'la-croissance-des-expertises-sur-les': 'growth-in-valuations-on',
  'credit-immobilier-le-recours-a-un': 'mortgage-credit-using-a',
  'frais-de-notaire-de-quoi-sont-ils': 'notary-fees-what-are-they-made-of',
  'le-marche-du-coliving-en-france': 'coliving-market-in-france',
  'la-tension-entre-valeur-assurantielle-et': 'tension-between-insurance-value-and',
  'travaux-dpe-ce-qu-il-faut': 'dpe-works-what-you-need-to-know',
  'point-marche-l-immobilier-de-bureaux': 'office-real-estate-market-update',
};

/** Reverse map EN display => slug WP */
export const NEWS_EN_TO_CANONICAL: Record<string, string> = Object.fromEntries(
  Object.entries(NEWS_CANONICAL_TO_EN).map(([canonical, en]) => [en, canonical]),
);

/* =========================================================
   Helpers
   ========================================================= */

export function normalizeNewsSlug(s: string): string {
  return (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Un item WP /news est-il un article publiable (page détail 200 + sitemap) ?
 * Même règle pour la liste, le détail et le sitemap.
 */
export function isNewsArticle(item: any): boolean {
  const slug = normalizeNewsSlug(item?.slug || '');
  return (
    !!slug &&
    slug !== NEWS_INTRO_SLUG &&
    !NGINX_REDIRECTED_SLUG.test(slug) &&
    !!item?.acf?.post
  );
}

/**
 * Slug WP -> slug affiché dans l'URL selon la langue (EN peut être traduit).
 */
export function toNewsDisplaySlug(wpSlug: string, lang: Lang): string {
  const c = normalizeNewsSlug(wpSlug);

  if (lang === 'en') {
    const en = NEWS_CANONICAL_TO_EN[c];
    if (en) return normalizeNewsSlug(en);
  }

  return c;
}

/**
 * Slug lu dans l'URL (FR/EN) -> slug WP à requêter.
 */
export function fromNewsUrlSlug(urlSlug: string, lang: Lang): string {
  const n = normalizeNewsSlug(urlSlug);
  if (lang === 'en') return NEWS_EN_TO_CANONICAL[n] || n;
  return n;
}

/**
 * Construit la route [base, slugDisplay] compatible router.navigate([ ... ]).
 * Exemple :
 * buildNewsRoute('en', 'point-marche-l-immobilier-de-bureaux')
 * -> ['/en/real-estate-valuation-news', 'office-real-estate-market-update']
 */
export function buildNewsRoute(lang: Lang, wpSlug: string): any[] {
  return [NEWS_BASE[lang], toNewsDisplaySlug(wpSlug, lang)];
}

/**
 * Chemin (relatif à l'origine) d'un article : liens, canonical, hreflang, sitemap.
 */
export function buildNewsPath(lang: Lang, wpSlug: string): string {
  return `${NEWS_BASE[lang]}/${encodeURIComponent(toNewsDisplaySlug(wpSlug, lang))}`;
}

/**
 * Détecte si un path correspond à un détail news FR/EN
 */
export function isNewsDetailPath(path: string): boolean {
  const p = normalizeNewsSlug(path);
  return (
    p.startsWith('actualites-expertise-immobiliere/') ||
    p.startsWith('en/real-estate-valuation-news/')
  );
}

/**
 * Traduit un chemin de détail news vers la langue cible (hreflang, switch de langue).
 * Retourne null si le chemin n'est pas un détail news.
 */
export function translateNewsDetailPath(currPath: string, targetLang: Lang): string | null {
  const p = normalizeNewsSlug(currPath);

  let wpSlug = '';
  if (p.startsWith('en/real-estate-valuation-news/')) {
    wpSlug = fromNewsUrlSlug(p.replace('en/real-estate-valuation-news/', ''), 'en');
  } else if (p.startsWith('actualites-expertise-immobiliere/')) {
    wpSlug = fromNewsUrlSlug(p.replace('actualites-expertise-immobiliere/', ''), 'fr');
  }

  return wpSlug ? buildNewsPath(targetLang, wpSlug) : null;
}
