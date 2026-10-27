/**
 * =====================================================================
 *  BEJO Digital Print - PM2 process config
 *  Dijalankan di VPS:  pm2 start ecosystem.config.cjs
 *  Autosave + startup:  pm2 save && pm2 startup
 * =====================================================================
 */
module.exports = {
  apps: [
    {
      name: 'bejo-pos',
      script: 'dist/server.cjs',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '700M',
      kill_timeout: 10000,
      wait_ready: false,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
    },
  ],
};
