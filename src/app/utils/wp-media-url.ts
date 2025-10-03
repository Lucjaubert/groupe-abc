// src/app/utils/wp-media-url.ts
const ROOT = 'https://groupe-abc.fr';

/**
 * Force toute URL d’upload à pointer vers /wordpress/wp-content/uploads/...
 * Gère les formes absolues et relatives, et aussi les //domain sans protocole.
 */
export function fixWpMediaUrl(url?: string): string {
  if (!url) return '';
  let u = url.trim();

  // protocole-relative → https:
  if (/^\/\//.test(u)) u = 'https:' + u;

  // absolue vers domaine racine sans /wordpress → ajoute /wordpress
  u = u.replace(
    /^https?:\/\/groupe-abc\.fr\/wp-content\/uploads\//i,
    'https://groupe-abc.fr/wordpress/wp-content/uploads/'
  );

  // relative → ajoute /wordpress
  u = u.replace(
    /^\/wp-content\/uploads\//i,
    '/wordpress/wp-content/uploads/'
  );

  return u;
}

/** Dans un bloc HTML (ACF), réécrit src=… et url(...) des uploads */
export function rewriteUploadsInHtml(html?: string): string {
  if (!html) return '';
  return html
    // src="..."/src='...'
    .replace(
      /(\ssrc=['"])\s*\/wp-content\/uploads\//gi,
      '$1/wordpress/wp-content/uploads/'
    )
    .replace(
      /(\ssrc=['"])https?:\/\/groupe-abc\.fr\/wp-content\/uploads\//gi,
      '$1https://groupe-abc.fr/wordpress/wp-content/uploads/'
    )
    // url(/wp-content/...) dans des styles inline
    .replace(
      /(url\(\s*['"]?)\/wp-content\/uploads\//gi,
      '$1/wordpress/wp-content/uploads/'
    )
    .replace(
      /(url\(\s*['"]?)https?:\/\/groupe-abc\.fr\/wp-content\/uploads\//gi,
      '$1https://groupe-abc.fr/wordpress/wp-content/uploads/'
    );
}
