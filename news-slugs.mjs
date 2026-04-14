// server/news-slugs.mjs
export const NEWS_CANONICAL_TO_EN = {
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

export function toNewsEnSlug(canonicalSlug) {
  const s = String(canonicalSlug || '').trim().toLowerCase();
  return NEWS_CANONICAL_TO_EN[s] || s;
}
