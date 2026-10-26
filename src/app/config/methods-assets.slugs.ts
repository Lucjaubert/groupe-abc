// src/app/config/methods-assets.slugs.ts

export type Lang = 'fr' | 'en';

/**
 * Base paths (listing) pour les pages “methods_asset”.
 * - FR: /methodes-evaluation-immobiliere/:slug
 * - EN: /en/valuation-methods-assets/:slug
 */
export const METHODS_ASSETS_BASE: Record<Lang, string> = {
  fr: '/methodes-evaluation-immobiliere',
  en: '/en/valuation-methods-assets',
};

/**
 * Anciennes URL / libellés -> slug WP (FR).
 * - Anciennes URL publiées (dont les slugs inventés que la page méthodes mettait dans
 *   son HTML SSR) : server.ts les redirige en 301 vers la vraie fiche.
 * - Libellés ACF de la page méthodes qui ne correspondent pas à un titre WP.
 * Ces slugs ne sont jamais produits (liens, canonical, hreflang, sitemap).
 * Chaque cible DOIT exister dans WordPress (methods_asset).
 */
export const METHODS_ASSETS_ALIASES_TO_CANONICAL: Record<string, string> = {
  'credit-ball': 'expertise-credit-bail',
  'credit-bail': 'expertise-credit-bail',
  'bureaux-locaux-pro': 'bureaux-locaux-professionnels',
  'expertise-bureaux-locaux-professionnels': 'bureaux-locaux-professionnels',
  'boutiques-boites-commerciales': 'expertise-locaux-commerciaux',
  'biens-residentiels': 'expertise-biens-residentiels',
  'expertise-entrepots-locaux-activites': 'entrepots-locaux-activites',
  'entrepots-locaux-dactivites': 'entrepots-locaux-activites',
  'expertise-gisements-fonciers': 'gisements-fonciers',
  'expertise-friches-industrielles': 'friches-industrielles',
  'expertise-charges-foncieres-urbaines': 'charges-foncieres-urbaines',
  'expertise-lotissements': 'lotissements',
  'expertise-terrains-agricoles': 'terrains-agricoles',
  'expertise-fonds-de-commerce': 'fonds-de-commerce',
  'expertise-droit-au-bail': 'droit-au-bail',
  'expertise-indemnite-eviction': 'indemnite-d-eviction',
  'expertise-usufruit': 'usufruit',
};

/**
 * Slugs EN “propres” (display) pour chaque slug WP.
 * Clé = slug WP réel (cf. /wp-json/wp/v2/methods_asset), valeur = slug de l’URL EN.
 * Les slugs non listés gardent le slug WP en EN.
 */
export const METHODS_ASSETS_CANONICAL_TO_EN: Record<string, string> = {
  'expertise-credit-bail': 'leasehold-financing',
  'bureaux-locaux-professionnels': 'offices-professional-premises',
  'expertise-locaux-commerciaux': 'retail-commercial-premises',
  'expertise-biens-residentiels': 'residential-assets',
};

/** Reverse map EN display => canonical WP */
export const METHODS_ASSETS_EN_TO_CANONICAL: Record<string, string> = Object.fromEntries(
  Object.entries(METHODS_ASSETS_CANONICAL_TO_EN).map(([canonical, en]) => [en, canonical]),
);

/* =========================================================
   Helpers
   ========================================================= */

export function normalizeSlug(s: string): string {
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
 */
export function canonicalizeMethodsAssetSlug(anySlug: string): string {
  const n = normalizeSlug(anySlug);

  // si on reçoit déjà un slug EN "propre"
  const fromEn = METHODS_ASSETS_EN_TO_CANONICAL[n];
  const maybeCanonical = fromEn || n;

  // aliases → canonical WP
  return METHODS_ASSETS_ALIASES_TO_CANONICAL[maybeCanonical] || maybeCanonical;
}

/**
 * À partir du slug canonical WP, fournit le slug à afficher dans l’URL
 * selon la langue (EN peut être “traduit”).
 */
export function toMethodsAssetDisplaySlug(canonicalWpSlug: string, lang: Lang): string {
  const c = normalizeSlug(canonicalWpSlug);

  if (lang === 'en') {
    const en = METHODS_ASSETS_CANONICAL_TO_EN[c];
    if (en) return normalizeSlug(en);
  }

  return c;
}

/**
 * Si on lit un slug depuis l’URL (FR/EN), on le convertit vers le canonical WP.
 * (utile pour le composant detail qui doit requêter WP avec le vrai slug)
 */
export function fromMethodsAssetUrlSlug(urlSlug: string, lang: Lang): string {
  const n = normalizeSlug(urlSlug);

  if (lang === 'en') {
    // slug EN -> canonical
    const canonical = METHODS_ASSETS_EN_TO_CANONICAL[n];
    if (canonical) return canonicalizeMethodsAssetSlug(canonical);
  }

  // FR (ou EN non mappé) -> canonical via aliases
  return canonicalizeMethodsAssetSlug(n);
}

/**
 * Construit la route [base, slugDisplay] compatible router.navigate([ ... ]).
 * Exemple : buildMethodsAssetRoute('en','expertise-credit-bail')
 * -> ['/en/valuation-methods-assets','leasehold-financing']
 */
export function buildMethodsAssetRoute(lang: Lang, anySlug: string): any[] {
  const canonicalWp = canonicalizeMethodsAssetSlug(anySlug);
  const display = toMethodsAssetDisplaySlug(canonicalWp, lang);
  return [METHODS_ASSETS_BASE[lang], display];
}

/**
 * Chemin (relatif à l'origine) d'un détail : liens, canonical, hreflang, sitemap.
 */
export function buildMethodsAssetPath(lang: Lang, anySlug: string): string {
  const canonicalWp = canonicalizeMethodsAssetSlug(anySlug);
  const display = toMethodsAssetDisplaySlug(canonicalWp, lang);
  return `${METHODS_ASSETS_BASE[lang]}/${encodeURIComponent(display)}`;
}

/**
 * Traduit un chemin de détail methods_asset vers la langue cible (hreflang, switch de langue).
 * Retourne null si le chemin n'est pas un détail methods_asset.
 */
export function translateMethodsAssetDetailPath(currPath: string, targetLang: Lang): string | null {
  const p = normalizeSlug(currPath);

  let wpSlug = '';
  if (p.startsWith('en/valuation-methods-assets/')) {
    wpSlug = fromMethodsAssetUrlSlug(p.replace('en/valuation-methods-assets/', ''), 'en');
  } else if (p.startsWith('methodes-evaluation-immobiliere/')) {
    wpSlug = fromMethodsAssetUrlSlug(p.replace('methodes-evaluation-immobiliere/', ''), 'fr');
  }

  return wpSlug ? buildMethodsAssetPath(targetLang, wpSlug) : null;
}
