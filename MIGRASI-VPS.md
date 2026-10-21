# MIGRASI KE VPS — BEJO STIKER POS

> 📌 **PANDUAN UTAMA (VPS WINDOWS — Rumah Web):** **[MIGRASI-VPS-2-ARAH.md](./MIGRASI-VPS-2-ARAH.md)**
> Dipecah jelas antara **sisi Dashboard VPS (panel Rumah Web)** dan **sisi Aplikasi (PC Anda)**, lengkap dengan perintah, urutan, checklist, dan troubleshooting.
>
> 📎 Dokumen ini (dan skrip `install-vps.sh` / `deploy-vps.sh`) adalah **variante Linux/Ubuntu** — dipakai bila VPS memakai Linux. Untuk VPS Windows gunakan skrip `deploy\install-vps-windows.ps1`, `deploy\deploy-vps-windows.ps1`, `deploy\remote-run.ps1`, dan `deploy\deploy-vps.ps1`.

Panduan lengkap memindahkan aplikasi ke VPS hosting dengan domain
**bejodigitalprint.com** (VPS: `vps.bejodigitalprint.com`).

---

## 0. Ringkasan

| Item | Nilai |
|---|---|
| Domain aplikasi | `https://bejodigitalprint.com` |
| Alias | `https://www.bejodigitalprint.com` (dialihkan otomatis) |
| Server aplikasi | Node.js 22 + Express (`dist/server.cjs`), port internal **3000** |
| Process manager | PM2 (auto-restart + auto-start saat boot) |
| Reverse proxy + TLS | Caddy (HTTPS otomatis Let's Encrypt) |
| Firewall | UFW — hanya 22, 80, 443 terbuka (3000 **tidak** dibuka) |
| Basis data | Firestore (tetap sama, tidak perlu migrasi data) |
| Data lokal | localStorage per browser (tidak ikut ter-deploy) |

```
Internet ──https──> Caddy (80/443, TLS otomatis)
                         │  reverse_proxy 127.0.0.1:3000
                         ▼
                  Node/Express (PM2, port 3000, 0.0.0.0 internal)
                         │
                         ├──> Firestore (data cloud, sudah ada)
                         └──> Gemini API (AI Assistant)
```

---

## 1. Prasyarat

- [ ] VPS Ubuntu 22.04/24.04 minimal, minimal **1 vCPU / 2 GB RAM / 40 GB SSD**
- [ ] Akses root/sudo ke VPS
- [ ] Akun SSH key (disarankan) atau password root
- [ ] Domain `bejodigitalprint.com` sudah dibeli & DNS bisa diedit
- [ ] Koneksi dari komputer ini ke VPS sudah bisavia SSH
- [ ] Node.js **v20+** sudah ada di komputer ini (untuk build lokal)

---

## 2. Domain & DNS (lakukan lebih dulu, proses SSL butuh IP)

Di registrar domain (Cloudflare / Namecheap / GoDaddy):

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `<IP_VPS_ANDA>` | Auto |
| A | `www` | `<IP_VPS_ANDA>` | Auto |
| A | `vps` | `<IP_VPS_ANDA>` | Auto |

- **Cloudflare**: biarkan proxy **oranye (Proxied)** aktif → IP asli tertutup, DDoS protection + cache gratis.
  - Jika memakai proxy, pastikan **SSL/TLS → Full (strict)**.
- Tunggu propagasi (biasanya 1–60 menit). Cek: `nslookup bejodigitalprint.com`

> Caddy otomatis meminta sertifikat Let's Encrypt, jadi **DNS harus sudah mengarah** ke VPS sebelum Caddy start.

---

## 3. Bootstrap VPS (sekali saja)

Login ke VPS:

```bash
ssh root@vps.bejodigitalprint.com
```

Upload skrip bootstrap (dari komputer ini):

```powershell
scp deploy/install-vps.sh root@vps.bejodigitalprint.com:/root/
```

Lalu jalankan di VPS:

```bash
bash /root/install-vps.sh
```

Yang dilakukan skrip:
1. Update paket + dependensi dasar (curl, git, build-essential, rsync, ufw)
2. Node.js 22 LTS (NodeSource) + PM2 + Caddy
3. Firewall ufw: izinkan 22, 80, 443 (port 3000 tetap tertutup)
4. User aplikasi `bejo` + direktori `/srv/bejo-pos` + `/var/backups/bejo-pos`
5. PM2 auto-start saat boot

---

## 4. Upload source & deploy

### Cara A — otomatis (dari komputer Windows)

```powershell
.\deploy\deploy-vps.ps1 -Host vps.bejodigitalprint.com -User root -KeyPath "$env:USERPROFILE\.ssh\id_ed25519"
```

Skrip ini: build produksi lokal → paket source (tanpa `node_modules`, `dist`, `.env`) → SCP ke VPS → jalankan `deploy/deploy-vps.sh` di VPS → health check otomatis.

### Cara B — manual

```bash
# di komputer: paketkan source
tar -czf bejo-deploy.tar.gz --exclude=node_modules --exclude=dist --exclude=.git --exclude=.env .

# unggah
scp bejo-deploy.tar.gz root@vps.bejodigitalprint.com:/tmp/

# di VPS
mkdir -p /srv/bejo-pos
tar -xzf /tmp/bejo-deploy.tar.gz -C /srv/bejo-pos
cd /srv/bejo-pos
bash deploy/deploy-vps.sh
```

`deploy-vps.sh` melakukan: backup build lama → `npm ci` → `npm run build` → `pm2 reload` → `pm2 save` → **health check** (bila gagal, build lama tetap ada di `/var/backups/bejo-pos`).

---

## 5. Environment variable di VPS

```bash
cd /srv/bejo-pos
cp .env.example .env
nano .env
```

Isi minimal:

```env
APP_URL=https://bejodigitalprint.com
GEMINI_API_KEY=<API_KEY_ANDA>
REMOTE_ACCESS_USER=bejo
REMOTE_ACCESS_PASS=<PASSWORD_KUAT>
PORT=3000
```

```bash
chmod 600 .env
chown bejo:bejo .env
pm2 restart bejo-pos --update-env
```

> `.env` **tidak** pernah ikut ter-commit dan tidak ikut terkirim saat deploy (otomatis dikecualikan).

---

## 6. HTTPS dengan Caddy

```bash
cp /srv/bejo-pos/deploy/Caddyfile /etc/caddy/Caddyfile
caddy fmt --overwrite /etc/caddy/Caddyfile
systemctl reload caddy
systemctl status caddy
```

Caddy otomatis:
- menerbitkan sertifikat Let's Encrypt untuk `bejodigitalprint.com` + `www`
- mengalihkan `www` → domain utama
- meneruskan ke `127.0.0.1:3000` (X-Forwarded-For diteruskan → proteksi login tetap akurat)

Cek: `curl -I https://bejodigitalprint.com` dan `https://bejodigitalprint.com/api/health`.

---

## 7. Firebase (WAJIB sebelum domain dipublikasikan)

Aplikasi kini memakai **autentikasi anonim** dan `firestore.rules` dikunci `request.auth != null`.

### 7.1 Aktifkan sign-in Anonymous
1. Buka [Firebase Console](https://console.firebase.google.com) → project `noted-segment-9xjsq`
2. **Authentication** → **Sign-in method** → **Anonymous** → **Enable** → Save

### 7.2 Terapkan rules
**Cara 1 — Console:** Firestore Database → **Rules** → tempel isi `firestore.rules` → **Publish**

**Cara 2 — CLI:**
```bash
npm i -g firebase-tools
firebase login
firebase use noted-segment-9xjsq
firebase deploy --only firestore:rules
```

> **Penting:** sebelum rules diperketat, aplikasi ini bisa dibaca/diubah siapa pun yang tahu API key proyek (API key ada di dalam bundle browser). Setelah rules aktif, hanya request terautentikasi (anonim dari aplikasi) yang bisa akses.
> Rollback tersedia: `firestore.rules.legacy-open` (sangat tidak disarankan).

---

## 8. Verifikasi (checklist wajib)

| # | Perintah / Langkah | Harap |
|---|---|---|
| 1 | `curl -s http://127.0.0.1:3000/api/health` | `status: ok`, `mode: production` |
| 2 | `pm2 list` | `bejo-pos` status **online**, restart 0 |
| 3 | `curl -I https://bejodigitalprint.com` | HTTP 200/301 + header `Strict-Transport-Security` |
| 4 | Buka `https://bejodigitalprint.com` dari HP (data seluler) | Halaman landing tampil |
| 5 | Tanpa login browser | **401** (Basic Auth) |
| 6 | Dengan `REMOTE_ACCESS_USER/PASS` | Masuk → halaman aplikasi |
| 7 | Login aplikasi (akun Developer/Admin) | Tab POS, Katalog, Laporan, Website terbuka |
| 8 | Tab **Website** → pratinjau | Pratinjau live, favicon & judul tab sesuai |
| 9 | Console browser (F12) | Tidak ada error `auth` / `permission-denied` |
| 10 | `pm2 logs bejo-pos --lines 50` | Tidak ada error berulang |

---

## 9. Operasional harian

```bash
pm2 status                        # status aplikasi
pm2 logs bejo-pos --lines 100     # log
pm2 restart bejo-pos              # restart
pm2 reload bejo-pos --update-env # reload + muat .env terbaru
pm2 monit                         # monitor CPU/RAM real-time
```

### Update aplikasi (setelah ada perubahan kode)
```powershell
.\deploy\deploy-vps.ps1 -Host vps.bejodigitalprint.com -User root
```
Rollback bila deploy bermasalah:
```bash
ls -lt /var/backups/bejo-pos/                 # pilih build lama
cd /srv/bejo-pos && tar -xzf /var/backups/bejo-pos/dist-<STAMP>.tar.gz && pm2 restart bejo-pos
```

### Backup
- **Data aplikasi**: tab Pengaturan → *Pencadangan & Pemulihan Data Offline* → Unduh JSON
- **Basis data**: export Firestore dari Firebase Console (Settings → Usage & billing → Export)
- **Backup VPS**: `pm2 save` + snapshot disk dari provider

---

## 10. Pemecahan masalah

| Gejala | Penyebab & Solusi |
|---|---|
| `502 Bad Gateway` | PM2 mati/port beda → `pm2 logs bejo-pos`, pastikan `PORT=3000` |
| Sertifikat TLS gagal | DNS belum mengarah / port 80 tertutup → cek `dig +short bejodigitalprint.com`, `ufw status` |
| Halaman tanpa login Basic Auth | `REMOTE_ACCESS_PASS` kosong di `.env` → isi lalu `pm2 restart bejo-pos --update-env` |
| Halaman publik terbuka tanpa login | Request dianggap lokal → pastikan Caddy meneruskan `X-Forwarded-For` (sudah di Caddyfile) & `trust proxy` aktif (sudah di server.ts) |
| `permission-denied` di Firestore | Anonymous auth belum diaktifkan → aktifkan di Firebase Console, atau rules belum ter-deploy |
| `API key should be set` | `GEMINI_API_KEY` kosong di `.env` |
| Halaman kosong / 404 di sub-halaman | `dist/` belum ter-build → jalankan `npm run build` di VPS lalu `pm2 reload` |
| Lambat / timeout | RAM kurang → `free -h`, naikkan size VPS; atau `pm2 restart` |

---

## 11. Checklist sebelum domain diumumkan ke publik

- [ ] HTTPS aktif, `http://` otomatis jadi `https://` (Caddy)
- [ ] `REMOTE_ACCESS_PASS` kuat & berbeda dari password aplikasi
- [ ] `firestore.rules` sudah `request.auth != null` (data tidak bisa dibaca publik)
- [ ] Metode sign-in **Anonymous** aktif di Firebase Console
- [ ] `APP_URL` = `https://bejodigitalprint.com`
- [ ] `GEMINI_API_KEY` valid (cek AI Assistant)
- [ ] Uji dari HP dengan data seluler (bukan WiFi) — pastikan tidak 403/401
- [ ] Backup JSON data aplikasi sudah diunduh
- [ ] Server lokal (PC) dimatikan setelah migrasi, atau tetap sebagai cadangan

---

## 12. Opsi tambahan

- **Cloudflare named tunnel** (URL tetap tanpa membuka port): isi `CLOUDFLARE_TUNNEL_TOKEN` + `CLOUDFLARE_PUBLIC_URL` di `.env`, jalankan `tunnel-always-on.ps1` di server → aplikasi tetap punya alamat tetap misalnya `app.bejodigitalprint.com`.
- **Docker**: `docker build -t bejo-pos . && docker run -d -p 3000:3000 --env-file .env --restart always bejo-pos` (image sudah siap di `Dockerfile`).
- **Cloud Run**: `gcloud run deploy bejo-pos --source . --set-env-vars-from-file .env` (butuh Dockerfile + akses GCP).
- **Multi-VPS / scaling**: `instances: 2` pada `ecosystem.config.cjs` + sticky session bila memakai WebSocket (saat ini aplikasi tidak memakai WebSocket, jadi aman).
