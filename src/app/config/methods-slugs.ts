export type Lang = 'fr' | 'en';

const SLUG_ALIASES: Record<string, string> = {
  'credit-ball': 'expertise-credit-bail',
  'bureaux-locaux-pro': 'expertise-bureaux-locaux-professionnels',
  'boutiques-boites-commerciales': 'expertise-locaux-commerciaux',
};

const SLUG_EN_CANONICAL: Record<string, string> = {
  lotissements: 'land-subdivisions',
  'expertise-credit-bail': 'leasehold-financing',
  'expertise-bureaux-locaux-professionnels': 'offices-professional-premises',
  'expertise-locaux-commerciaux': 'retail-commercial-premises',
};

const SLUG_EN_TO_CANONICAL: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_EN_CANONICAL).map(([canonical, en]) => [en, canonical]),
);

export function normalizeSlug(s: string): string {
  return (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** slug URL (EN ou FR) -> slug WP canonical (FR) */
export function canonicalizeMethodsAssetSlug(slug: string): string {
  const normalized = normalizeSlug(slug);
  const maybeFromEn = SLUG_EN_TO_CANONICAL[normalized];
  const asWp = maybeFromEn || normalized;
  return SLUG_ALIASES[asWp] || asWp;
}

/** slug WP canonical -> slug affiché dans l’URL selon langue */
export function toDisplayMethodsAssetSlug(canonicalWpSlug: string, lang: Lang): string {
  const c = normalizeSlug(canonicalWpSlug);
  if (lang === 'en') {
    const en = SLUG_EN_CANONICAL[c];
    if (en) return normalizeSlug(en);
  }
  return c;
}

export function isMethodsAssetDetailPath(path: string): boolean {
  const p = normalizeSlug(path);
  return (
    p.startsWith('methodes-evaluation-immobiliere/') ||
    p.startsWith('en/valuation-methods-assets/')
  );
}

/** traduit uniquement la partie route+slug pour methods_asset detail */
export function translateMethodsAssetDetailPath(currPath: string, targetLang: Lang): string | null {
  const p = normalizeSlug(currPath);

  // EN -> FR
  if (p.startsWith('en/valuation-methods-assets/')) {
    const slugEn = p.replace('en/valuation-methods-assets/', '');
    const canonical = canonicalizeMethodsAssetSlug(slugEn);
    if (targetLang === 'fr') return `/methodes-evaluation-immobiliere/${canonical}`;
    // EN -> EN : conserve
    return `/en/valuation-methods-assets/${toDisplayMethodsAssetSlug(canonical, 'en')}`;
  }

  // FR -> EN
  if (p.startsWith('methodes-evaluation-immobiliere/')) {
    const slugFr = p.replace('methodes-evaluation-immobiliere/', '');
    const canonical = canonicalizeMethodsAssetSlug(slugFr);
    if (targetLang === 'en')
      return `/en/valuation-methods-assets/${toDisplayMethodsAssetSlug(canonical, 'en')}`;
    // FR -> FR : conserve
    return `/methodes-evaluation-immobiliere/${canonical}`;
  }

  return null;
}
