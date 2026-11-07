<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/72b37ab8-0067-4169-ad03-3579d8ed03ec

## Deploy VPS Windows

Satu-satunya skrip deploy produksi ada di `deploy/deploy-vps.ps1` dan dijalankan di dalam VPS Windows sebagai Administrator:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\bejo-pos\deploy\deploy-vps.ps1 -Force
```

Skrip mengunduh source `main`, menjalankan build, memperbarui Caddyfile, me-restart service, melakukan health check + rollback, lalu memverifikasi akses internet.

## Catatan rekonsiliasi struk live (2026-11-07)

Rekonsiliasi nomor struk ganda sudah dijalankan terhadap PocketBase produksi (`https://bejodigitalprint.com/api/pb`) lewat `npm run sales:reconcile`: pratinjau dulu, lalu `--apply` setelah rencana ditinjau pemilik. Hasil terverifikasi baca-ulang:

- Record penjualan 633 → 329; 304 duplikat murni (isi sama persis) dihapus, 7 penjualan berbeda bernomor sama diberi nomor baru `BS2026/10/0159`–`BS2026/10/0165` (tidak ada penjualan nyata yang hilang), 319 penanda id disamakan.
- Verifikasi akhir: 0 nomor struk ganda tersisa.
- Bukti (cadangan seluruh record sebelum menulis, rencana, dan verifikasi) tersimpan di folder `backups/` perangkat yang menjalankan — sengaja tidak dilacak git: `sales-reconcile-backup-2026-11-07T04-42-40.json`, `sales-reconcile-plan-2026-11-07T04-40-34.json`, `sales-reconcile-verify-2026-11-07T04-42-40.json`.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
