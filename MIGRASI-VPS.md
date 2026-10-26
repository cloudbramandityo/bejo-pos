# MIGRASI KE VPS — BEJO STIKER POS

> 📌 **PANDUAN UTAMA (VPS WINDOWS — Rumah Web):** **[MIGRASI-VPS-2-ARAH.md](./MIGRASI-VPS-2-ARAH.md)**
> Dipecah jelas antara **sisi Dashboard VPS (panel Rumah Web)** dan **sisi Aplikasi (PC Anda)**, lengkap dengan perintah, urutan, checklist, dan troubleshooting.
>
> 📎 Dokumen ini menyimpan catatan historis varian Linux/Ubuntu. Skrip Linux (`install-vps.sh` / `deploy-vps.sh`) sudah dihapus. Untuk VPS Windows yang sudah live, satu-satunya skrip deploy adalah `deploy\deploy-vps.ps1`; skrip instalasi awal tetap `install-vps-windows.ps1`, `setup-pocketbase.ps1`, dan `finish-deploy.ps1`.

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
| Basis data | **PocketBase v0.28** (SQLite, self-hosted, port internal **8090**) |
| Real-time & auth | PocketBase Realtime (SSE) + koleksi `users` |
| Reverse proxy + TLS | Caddy (HTTPS otomatis Let's Encrypt) — route `/api/pb/*` → PocketBase |
| Firewall | UFW — hanya 22, 80, 443 terbuka (3000 & 8090 **tidak** dibuka) |
| Data lokal | localStorage per browser (fallback Mode Lokal bila server mati) |

```
Internet ──https──> Caddy (80/443, TLS otomatis)
                         │
                         ├──/api/pb/*──> PocketBase (127.0.0.1:8090)  ← DB + realtime + auth
                         │
                         └── /* ──────> Node/Express (PM2, port 3000)
                                          │
                                          └──> Gemini API (AI Assistant)
```

> ✅ **Firebase sudah dihapus sepenuhnya** (Firestore + Auth). Basis data kini milik sendiri di VPS.
> Aplikasi otomatis memakai **Mode Lokal** (localStorage) bila PocketBase tidak terjangkau.

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

> Skrip `install-vps.sh` sudah dihapus. Langkah di bawah hanya catatan historis Linux.

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

> Skrip Linux (`install-vps.sh`, `deploy-vps.sh`) dan skrip deploy lama berbasis SSH sudah dihapus. Bagian ini hanya catatan historis.

Untuk VPS Windows yang sudah live, deploy dilakukan di dalam VPS lewat RDP:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\bejo-pos\deploy\deploy-vps.ps1 -Force
```

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

# --- PocketBase (database + realtime + auth) ---
VITE_POCKETBASE_URL=https://bejodigitalprint.com/api/pb
VITE_PB_SYNC_EMAIL=sync@bejo.local
VITE_PB_SYNC_PASSWORD=<PASSWORD_SINKRONISASI_KUAT>
POCKETBASE_UPSTREAM=http://127.0.0.1:8090
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

## 7. PocketBase — database + realtime + auth (WAJIB sebelum domain dipublikasikan)

> Firebase **tidak lagi dipakai**. Semua data aplikasi kini disimpan di PocketBase (SQLite) di VPS sendiri.

### 7.1 Pasang & jalankan PocketBase
```bash
cd /srv/bejo-pos
sudo mkdir -p /opt/pocketbase/pb_data
cd /opt/pocketbase
sudo wget -q https://github.com/pocketbase/pocketbase/releases/download/v0.28.1/pocketbase_0.28.1_linux_amd64.zip
sudo unzip -o pocketbase_0.28.1_linux_amd64.zip && sudo rm pocketbase_0.28.1_linux_amd64.zip
sudo chmod +x pocketbase

# service systemd
sudo tee /etc/systemd/system/pocketbase.service > /dev/null <<'EOF'
[Unit]
Description=PocketBase (database + realtime + auth)
After=network.target

[Service]
Type=simple
User=bejo
WorkingDirectory=/opt/pocketbase
ExecStart=/opt/pocketbase/pocketbase serve --http=127.0.0.1:8090 --dir=/opt/pocketbase/pb_data
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now pocketbase
curl -s http://127.0.0.1:8090/api/health
```

### 7.2 Buat admin PocketBase (sekali saja)
```bash
sudo /opt/pocketbase/pocketbase admin create admin@bejodigitalprint.com "<PASSWORD_ADMIN>" --dir=/opt/pocketbase/pb_data
```

### 7.3 Buat koleksi + skema (dari komputer)
```bash
cd /path/ke/project
export POCKETBASE_URL="http://<IP_VPS>:8090"
export PB_ADMIN_EMAIL="admin@bejodigitalprint.com"
export PB_ADMIN_PASSWORD="<PASSWORD_ADMIN>"
node scripts/create-pocketbase-collections.mjs --drop
```
Membuat **27 koleksi** (`products`, `customers`, `transactions`, `users`, `settings`, `invoices`, …)
beserta API rules `@request.auth.id != ""`.

### 7.4 Akun sinkronisasi aplikasi
```bash
node -e "const PocketBase=require('pocketbase');(async()=>{const pb=new PocketBase(process.env.POCKETBASE_URL);await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL,process.env.PB_ADMIN_PASSWORD);const r=await pb.collection('users').create({email:'sync@bejo.local',password:process.env.PB_SYNC_PASSWORD,passwordConfirm:process.env.PB_SYNC_PASSWORD,name:'Bejo Sync Service',role:'developer',isActive:true});console.log('Sync user OK:',r.id);})()"
```
> Password harus sama dengan `VITE_PB_SYNC_PASSWORD` di `.env`.

### 7.5 Migrasi data lama (opsional)
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/service-account-key.json"
export FIREBASE_PROJECT_ID="noted-segment-9xjsq"
node scripts/migrate-firestore-to-pocketbase.mjs       # --dry-run untuk uji dulu
```

### 7.6 Route Caddy untuk realtime (WAJIB)
`deploy/Caddyfile` sudah memuat:
```
handle /api/pb/* {
    reverse_proxy 127.0.0.1:8090
}
```
> Jangan lewat proxy Node — streaming SSE untuk realtime harus tidak di-buffer.

```bash
cp /srv/bejo-pos/deploy/Caddyfile /etc/caddy/Caddyfile
caddy fmt --overwrite /etc/caddy/Caddyfile
systemctl reload caddy
```

---

## 8. Verifikasi (checklist wajib)

| # | Perintah / Langkah | Harap |
|---|---|---|
| 1 | `curl -s http://127.0.0.1:3000/api/health` | `status: ok`, `mode: production` |
| 2 | `pm2 list` | `bejo-pos` status **online**, restart 0 |
| 3 | `systemctl status pocketbase` | **active (running)** |
| 4 | `curl -s http://127.0.0.1:8090/api/health` | `API is healthy` |
| 5 | `curl -I https://bejodigitalprint.com` | HTTP 200/301 + header `Strict-Transport-Security` |
| 6 | Buka `https://bejodigitalprint.com` dari HP (data seluler) | Halaman landing tampil |
| 7 | Tanpa login browser | **401** (Basic Auth) |
| 8 | Dengan `REMOTE_ACCESS_USER/PASS` | Masuk → halaman aplikasi |
| 9 | Login aplikasi (akun Developer/Admin) | Tab POS, Katalog, Laporan, Website terbuka |
| 10 | Tab **Website** → pratinjau | Pratinjau live, favicon & judul tab sesuai |
| 11 | Console browser (F12) | `[PocketBase] Terhubung & terautentikasi.` (tanpa `permission-denied`) |
| 12 | Ubah data di Admin UI PocketBase | Data berubah **live** di aplikasi (realtime) |
| 13 | `pm2 logs bejo-pos --lines 50` | Tidak ada error berulang |

---

## 9. Operasional harian

```bash
pm2 status                        # status aplikasi
pm2 logs bejo-pos --lines 100     # log
pm2 restart bejo-pos              # restart
pm2 reload bejo-pos --update-env # reload + muat .env terbaru
pm2 monit                         # monitor CPU/RAM real-time
systemctl status pocketbase       # status database
systemctl restart pocketbase      # restart database
```

### Update aplikasi (setelah ada perubahan kode)
Untuk VPS Windows (di dalam VPS lewat RDP):
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\bejo-pos\deploy\deploy-vps.ps1 -Force
```
Rollback Linux (historis):
```bash
ls -lt /var/backups/bejo-pos/                 # pilih build lama
cd /srv/bejo-pos && tar -xzf /var/backups/bejo-pos/dist-<STAMP>.tar.gz && pm2 restart bejo-pos
```

### Backup
- **Data aplikasi**: tab Pengaturan → *Pencadangan & Pemulihan Data Offline* → Unduh JSON
- **Basis data**: salin folder `/opt/pocketbase/pb_data` (matikan service sebentar agar konsisten)
- **Backup VPS**: `pm2 save` + snapshot disk dari provider

---

## 10. Pemecahan masalah

| Gejala | Penyebab & Solusi |
|---|---|
| `502 Bad Gateway` | PM2 mati/port beda → `pm2 logs bejo-pos`, pastikan `PORT=3000` |
| Console: "Server tidak terjangkau" / Mode Lokal | PocketBase mati | `systemctl status pocketbase`; `curl 127.0.0.1:8090/api/health` |
| Console: 401 Unauthorized | Akun sinkronisasi belum dibuat / password beda | Buat user `sync@bejo.local`; samakan dengan `VITE_PB_SYNC_PASSWORD` → build ulang |
| Realtime tidak berubah | Caddy tidak meneruskan SSE `/api/pb` | Pastikan `handle /api/pb/*` ada di Caddyfile → `systemctl reload caddy` |
| Sertifikat TLS gagal | DNS belum mengarah / port 80 tertutup → cek `dig +short bejodigitalprint.com`, `ufw status` |
| Halaman tanpa login Basic Auth | `REMOTE_ACCESS_PASS` kosong di `.env` → isi lalu `pm2 restart bejo-pos --update-env` |
| Halaman publik terbuka tanpa login | Request dianggap lokal → pastikan Caddy meneruskan `X-Forwarded-For` (sudah di Caddyfile) & `trust proxy` aktif (sudah di server.ts) |
| `API key should be set` | `GEMINI_API_KEY` kosong di `.env` |
| Halaman kosong / 404 di sub-halaman | `dist/` belum ter-build → jalankan `npm run build` di VPS lalu `pm2 reload` |
| Lambat / timeout | RAM kurang → `free -h`, naikkan size VPS; atau `pm2 restart` |

---

## 11. Checklist sebelum domain diumumkan ke publik

- [ ] HTTPS aktif, `http://` otomatis jadi `https://` (Caddy)
- [ ] `REMOTE_ACCESS_PASS` kuat & berbeda dari password aplikasi
- [ ] Service `pocketbase` aktif (systemd, auto start + auto restart)
- [ ] 27 koleksi PocketBase sudah dibuat + akun sinkronisasi `sync@bejo.local`
- [ ] `.env` berisi `VITE_POCKETBASE_URL`, `VITE_PB_SYNC_EMAIL`, `VITE_PB_SYNC_PASSWORD`
- [ ] Caddyfile punya route `handle /api/pb/*` (realtime SSE)
- [ ] Port 3000 & 8090 **tidak** dibuka di `ufw`
- [ ] `APP_URL` = `https://bejodigitalprint.com`
- [ ] `GEMINI_API_KEY` valid (cek AI Assistant)
- [ ] Uji dari HP dengan data seluler (bukan WiFi) — pastikan tidak 403/401
- [ ] Uji realtime: ubah data di Admin UI PocketBase → aplikasi berubah live
- [ ] Backup JSON data aplikasi sudah diunduh
- [ ] Server lokal (PC) dimatikan setelah migrasi, atau tetap sebagai cadangan

---

## 12. Opsi tambahan

- **Cloudflare named tunnel (historis)**: skrip `tunnel-always-on.ps1` sudah dihapus. VPS Windows produksi memakai Caddy + domain langsung.
- **Docker**: `docker build -t bejo-pos . && docker run -d -p 3000:3000 --env-file .env --restart always bejo-pos` (image sudah siap di `Dockerfile`).
- **Cloud Run**: `gcloud run deploy bejo-pos --source . --set-env-vars-from-file .env` (butuh Dockerfile + akses GCP).
- **Multi-VPS / scaling**: `instances: 2` pada `ecosystem.config.cjs` + sticky session bila memakai WebSocket (saat ini aplikasi tidak memakai WebSocket, jadi aman).
