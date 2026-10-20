import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR === 'true' ? false : { overlay: false },
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Izinkan akses lewat domain terowongan (Cloudflare/ngrok) agar aplikasi
      // bisa dibuka dari internet tanpa diblokir proteksi host Vite.
      // Tambahkan hostname Anda sendiri di ALLOWED_HOSTS (dipisah koma).
      allowedHosts: [
        '.trycloudflare.com',
        '.ngrok-free.app',
        '.ngrok-free.dev',
        '.ngrok.io',
        '.loca.lt',
        '.lhr.life',
        ...(process.env.ALLOWED_HOSTS || '')
          .split(',')
          .map((h) => h.trim())
          .filter(Boolean),
      ],
    },
  };
});
