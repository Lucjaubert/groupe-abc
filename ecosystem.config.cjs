module.exports = {
  apps: [
    {
      name: 'groupe-abc-prod',
      cwd: '/var/www/lucjaubert_c_usr14/data/www/groupe-abc.fr/groupe-abc_angular',

      // ✅ Lancer run-ssr.mjs (pas ssr.mjs)
      script: 'run-ssr.mjs',

      interpreter: 'node',
      node_args: ['--enable-source-maps'],

      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '4000',
        SSR_ROOT: '/var/www/lucjaubert_c_usr14/data/www/groupe-abc.fr/groupe-abc_angular',
        PUBLIC_HOST: 'groupe-abc.fr',

        // ✅ à décommenter / ajouter :
        WP_INTERNAL_ORIGIN: 'https://groupe-abc.fr',
        WP_API_BASE: 'https://groupe-abc.fr/wordpress',

        // optionnel mais utile pour sitemap
        PUBLIC_BASE: 'https://groupe-abc.fr',
      },

      error_file: '/root/.pm2/logs/groupe-abc-prod-error.log',
      out_file: '/root/.pm2/logs/groupe-abc-prod-out.log',
      merge_logs: true,

      watch: false,
      max_restarts: 10,
      restart_delay: 2000,
    },
  ],
};
