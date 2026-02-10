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
 * Aliases → slug canonique WP (FR).
 * Objectif : si on reçoit un slug “historique” / “slugifié” / “EN”,
 * on retrouve toujours le vrai slug WP (canonical).
 */
export const METHODS_ASSETS_ALIASES_TO_CANONICAL: Record<string, string> = {
  // historiques / erreurs de saisie / anciens slugs
  'credit-ball': 'expertise-credit-bail',
  'bureaux-locaux-pro': 'expertise-bureaux-locaux-professionnels',
  'boutiques-boites-commerciales': 'expertise-locaux-commerciaux',

  // ✅ cas concret : EN qui pointe vers un slug “slugifié du libellé”
  // alors que WP est en “expertise-...”
  'biens-residentiels': 'expertise-biens-residentiels',
};

/**
 * Slugs EN “propres” (display) pour chaque slug canonique WP.
 * Objectif : URL EN lisible, sans toucher au slug WP.
 *
 * ⚠️ Mets ici UNIQUEMENT les slugs que tu veux vraiment traduire en EN.
 * Sinon, l’URL EN gardera le slug canonique WP (FR) par défaut.
 */
export const METHODS_ASSETS_CANONICAL_TO_EN: Record<string, string> = {
  // Ceux que tu as déjà (et qui doivent fonctionner) :
  'expertise-credit-bail': 'leasehold-financing',
  'expertise-bureaux-locaux-professionnels': 'offices-professional-premises',
  'expertise-locaux-commerciaux': 'retail-commercial-premises',

  // ✅ recommandé pour corriger /en/.../biens-residentiels
  // (et avoir une vraie URL EN propre)
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
