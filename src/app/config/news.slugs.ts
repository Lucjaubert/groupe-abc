// src/app/config/news.slugs.ts

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
 * Aliases -> slug canonical WP (FR)
 * Utiles pour :
 * - anciens slugs
 * - variantes manuelles
 * - slugs historiques "article-x", etc. (si tu veux les supporter)
 *
 * ⚠️ Laisse vide au départ si tu veux, puis enrichis au fil de l’eau.
 */
export const NEWS_ALIASES_TO_CANONICAL: Record<string, string> = {
  // Exemples (à adapter si besoin)
  // 'article-7': 'point-marche-l-immobilier-commercial-bordelais',
  // 'point-marche-immobilier-commercial-bordeaux': 'point-marche-l-immobilier-commercial-bordelais',
};

/**
 * Slugs EN "propres" (display) pour chaque slug canonical WP.
 * Clé   = slug WP canonical (souvent FR)
 * Valeur = slug affiché dans l'URL EN
 *
 * ✅ Tu peux avancer progressivement :
 * - mets uniquement les articles prioritaires
 * - les autres garderont le slug WP FR (fallback)
 */
export const NEWS_CANONICAL_TO_EN: Record<string, string> = {
  // --- Articles que tu m'as listés ---
  'point-marche-l-immobilier-commercial-bordelais': 'bordeaux-commercial-real-estate-market-update',
  'permis-de-louer-a-bordeaux-tout': 'bordeaux-rental-permit-everything-you-need-to-know',
  'la-croissance-des-expertises-sur-les': 'growth-in-valuations-on',
  'credit-immobilier-le-recours-a-un': 'mortgage-credit-using-a',
  'frais-de-notaire-de-quoi-sont-ils': 'notary-fees-what-are-they-made-of',
  'le-marche-du-coliving-en-france': 'coliving-market-in-france',
  'la-tension-entre-valeur-assurantielle-et': 'tension-between-insurance-value-and',
  'travaux-dpe-ce-qu-il-faut': 'dpe-works-what-you-need-to-know',
  'point-marche-l-immobilier-de-bureaux': 'office-real-estate-market-update',

  // Tu peux en ajouter ensuite :
  // 'slug-wp-fr': 'translated-english-slug',
};

/** Reverse map EN display => canonical WP */
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
 * 1) normalise
 * 2) si slug EN connu -> convertit en canonical WP
 * 3) si alias connu -> convertit en canonical WP
 *
 * Résultat = slug canonical WP (souvent FR) à utiliser pour requêter WordPress
 */
export function canonicalizeNewsSlug(anySlug: string): string {
  const n = normalizeNewsSlug(anySlug);

  // si on reçoit un slug EN "propre"
  const fromEn = NEWS_EN_TO_CANONICAL[n];
  const maybeCanonical = fromEn || n;

  // aliases -> canonical WP
  return NEWS_ALIASES_TO_CANONICAL[maybeCanonical] || maybeCanonical;
}

/**
 * À partir du slug canonical WP, fournit le slug à afficher dans l’URL
 * selon la langue (EN peut être “traduit”).
 */
export function toNewsDisplaySlug(canonicalWpSlug: string, lang: Lang): string {
  const c = normalizeNewsSlug(canonicalWpSlug);

  if (lang === 'en') {
    const en = NEWS_CANONICAL_TO_EN[c];
    if (en) return normalizeNewsSlug(en);
  }

  // FR (ou EN non mappé) -> slug WP canonical
  return c;
}

/**
 * Si on lit un slug depuis l’URL (FR/EN), on le convertit vers le canonical WP.
 * (utile pour le composant detail qui doit requêter WP avec le vrai slug)
 */
export function fromNewsUrlSlug(urlSlug: string, lang: Lang): string {
  const n = normalizeNewsSlug(urlSlug);

  if (lang === 'en') {
    const canonical = NEWS_EN_TO_CANONICAL[n];
    if (canonical) return canonicalizeNewsSlug(canonical);
  }

  return canonicalizeNewsSlug(n);
}

/**
 * Construit la route [base, slugDisplay] compatible router.navigate([ ... ]).
 * Exemple :
 * buildNewsRoute('en', 'point-marche-l-immobilier-de-bureaux')
 * -> ['/en/real-estate-valuation-news', 'office-real-estate-market-update']
 */
export function buildNewsRoute(lang: Lang, anySlug: string): any[] {
  const canonicalWp = canonicalizeNewsSlug(anySlug);
  const display = toNewsDisplaySlug(canonicalWp, lang);
  return [NEWS_BASE[lang], display];
}

/**
 * Construit l'URL string absolue/relative d’un article (pratique pour sitemap/SEO/helpers)
 */
export function buildNewsPath(lang: Lang, anySlug: string): string {
  const canonicalWp = canonicalizeNewsSlug(anySlug);
  const display = toNewsDisplaySlug(canonicalWp, lang);
  return `${NEWS_BASE[lang]}/${display}`;
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
 * Traduit uniquement la partie route+slug pour News detail
 * sans casser WordPress (on repasse toujours par le canonical WP)
 */
export function translateNewsDetailPath(currPath: string, targetLang: Lang): string | null {
  const p = normalizeNewsSlug(currPath);

  // EN -> FR
  if (p.startsWith('en/real-estate-valuation-news/')) {
    const slugEn = p.replace('en/real-estate-valuation-news/', '');
    const canonical = canonicalizeNewsSlug(slugEn);

    if (targetLang === 'fr') {
      return `/actualites-expertise-immobiliere/${toNewsDisplaySlug(canonical, 'fr')}`;
    }

    // EN -> EN : normalise / stabilise
    return `/en/real-estate-valuation-news/${toNewsDisplaySlug(canonical, 'en')}`;
  }

  // FR -> EN
  if (p.startsWith('actualites-expertise-immobiliere/')) {
    const slugFr = p.replace('actualites-expertise-immobiliere/', '');
    const canonical = canonicalizeNewsSlug(slugFr);

    if (targetLang === 'en') {
      return `/en/real-estate-valuation-news/${toNewsDisplaySlug(canonical, 'en')}`;
    }

    // FR -> FR : normalise / stabilise
    return `/actualites-expertise-immobiliere/${toNewsDisplaySlug(canonical, 'fr')}`;
  }

  return null;
}
