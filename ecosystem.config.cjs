module.exports = {
  apps: [
    {
      name: 'groupe-abc-prod',
      cwd: '/var/www/lucjaubert_c_usr14/data/www/groupe-abc.fr/groupe-abc_angular',
      // Lancer EXACTEMENT ce fichier :
      script: 'ssr.mjs',
      // Utiliser Node en mode ESM
      node_args: [],
      interpreter: 'node',
      // Env de prod
      env: {
        NODE_ENV: 'production',
        PORT: '4000'
      },
      // Log files
      error_file: '/root/.pm2/logs/groupe-abc-prod-error.log',
      out_file:   '/root/.pm2/logs/groupe-abc-prod-out.log',
      merge_logs: true,
      // Pas de watch en prod
      watch: false,
      // Redémarrages auto si crash
      max_restarts: 10,
      restart_delay: 2000
    }
  ]
};
