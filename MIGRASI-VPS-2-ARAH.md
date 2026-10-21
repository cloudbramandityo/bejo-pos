# MIGRASI KE VPS — PANDUAN 2 ARAH (Rumah Web → bejodigitalprint.com)

Panduan **langkah demi langkah**, dipisah menjadi:

- **BAGIAN A — Sisi Dashboard VPS (panel Rumah Web)** → yang Anda klik di browser panel.
- **BAGIAN B — Sisi Aplikasi (PC Anda)** → yang Anda jalankan di komputer ini + terminal VPS.
- **BAGIAN C — Checklist, troubleshooting, dan rollback.**

> Nama menu di panel Rumah Web (SolusVM/Virtualizor) berbeda-beda tiap versi. Kalau nama tidak persis, cari menu yang **mengg likened**: *Virtual Server / VPS / Instance / Server*, *Firewall / Security Group*, *Console / VNC*, *DNS / Zone Editor*.

---

## 🎯 Gambaran Besar

| # | Dilakukan DI (panel Rumah Web) | Dilakukan DI (PC Anda / terminal VPS) |
|---|---|---|
| 1 | Pesan VPS + pilih OS Ubuntu | Siapkan build & paket source |
| 2 | Masukkan SSH public key | Generate SSH key (kalau belum ada) |
| 3 | Buka firewall 22/80/443 | Pasang Node 22, PM2, Caddy |
| 4 | Arahkan DNS domain → IP VPS | Upload source + jalankan deploy |
| 5 | Pantau status/console VPS | Isi `.env`, aktifkan HTTPS, verifikasi |
| 6 | (Opsional) Snapshot berkala | Matikan server lokal (cutover) |

---

# BAGIAN A — Sisi Dashboard VPS (Rumah Web)

### A1. Login ke panel Rumah Web
Buka panel VPS Anda (biasanya `https://vps.rumahweb.co.id/...` atau subdomain dari akun Anda) → **Login**.

> Panel ini **berbeda** dari panel hosting cPanel/DirectAdmin. Semua yang menyangkut **sistem operasi** (install, firewall, SSH) dilakukan di panel **VPS**, bukan cPanel.

---

### A2. Pastikan paket VPS sudah ada
Menu **Virtual Servers / VPS** → daftar server.

| Yang harus ada | Keterangan |
|---|---|
| Status | **Running** |
| OS | Ubuntu 22.04 LTS atau 24.04 LTS |
| IPv4 | 1 IP publik (catat!) |
| RAM | minimal 2 GB (1 GB bisa, tapi disarankan 2 GB) |
| Disk | minimal 30 GB |
| User SSH | `root` (umumnya) |

> **Catatan:** beberapa panel hanya menampilkan OS saat **memesan** server. Kalau server sudah ada dengan OS lain, buat **snapshot** dulu, lalu **reinstall** dengan Ubuntu 22.04/24.04 (data hilang — pastikan backup lokal Anda sudah aman).

---

### A3. Catat & simpan data akses
Tempel di catatan Anda:

```
IP VPS        : x.x.x.x
Port SSH      : 22
User          : root
Hostname      : vps.bejodigitalprint.com
```

---

### A4. Tambahkan SSH Public Key (opsional tapi disarankan)
Menu **SSH Keys** (atau **Add SSH Key**) → **New Key** → Name: `bejo-pc` → Paste public key dari PC Anda.

Public key PC Anda ada di:
```
C:\Users\DESKTOP\.ssh\id_ed25519.pub
```
(kalau belum ada, buat di BAGIAN B langkah B1).

> Gunanya: tidak perlu password root, dan login VPS jauh lebih aman.

---

### A5. Buka Firewall di Panel VPS
Menu **Firewall** (pada beberapa panel: **Config Firewall** / **Security Group**) → **Add rule**:

| Port | Protocol | Source | Keterangan |
|---|---|---|---|
| 22 | TCP | Semua (atau IP Anda saja) | SSH |
| 80 | TCP | Semua | HTTP (untuk penerbitan sertifikat SSL) |
| 443 | TCP | Semua | HTTPS |
| 3000 | TCP | **IP PC Anda saja** (sementara) | Tes aplikasi tanpa proxy — hapus setelah Caddy aktif |

> **Penting:** port **3000 tidak boleh** dibuka ke semua pihak setelah migrasi selesai (aplikasi diakses lewat Caddy di 443).

Firewall **lapis sistem** (ufw) akan kita atur sendiri di terminal (BAGIAN B, B6).

---

### A6. Arahkan DNS Domain → IP VPS
Di **panel domain / registrar** tempat `bejodigitalprint.com` dibeli (bisa juga lewat **Zone Editor** di panel Rumah Web bila domain-nya dikelola di sana):

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `<IP VPS>` | Auto / 300 |
| A | `www` | `<IP VPS>` | Auto / 300 |
| A | `vps` | `<IP VPS>` | Auto / 300 |

Tambahkan juga (untuk email & keamanan):
| Type | Name | Value |
|---|---|---|
| MX | `@` | `mx1.rumahweb.co.id` (sesuaikan) |
| TXT | `@` | `v=spf1 include:... -all` (opsional) |

**Cek propagasi dari PC Anda:**
```powershell
nslookup bejodigitalprint.com
ping bejodigitalprint.com
```
Harus sudah menunjuk IP VPS sebelum lanjut ke BAGIAN B (sertifikat SSL butuh DNS hidup).

---

### A7. Cek fitur panel yang berguna
| Fitur | Kegunaan |
|---|---|
| **Console / VNC** | Akses terminal kalau SSH gagal (mis. kunci SSH publik salah) |
| **Reboot / Restart** | Restart bersih bila macet |
| **Snapshot / Backup** | Ambil snapshot sebelum deploy besar |
| **Bandwidth / Monitoring** | Pantau pemakaian CPU/RAM |
| **Reinstall / OS Change** | Reset ke Ubuntu 22.04 bila perlu |

---

# BAGIAN B — Sisi Aplikasi (PC Anda)

## B1. Pastikan PC siap & buat SSH key (bila belum)
```powershell
node -v            # harus v20+ (v22 disarankan)
npm -v
ssh -V             # harus ada (OpenSSH Client)

# Buat key kalau belum ada
if (-not (Test-Path "$env:USERPROFILE\.ssh\id_ed25519")) {
  ssh-keygen -t ed25519 -C "bejo-pc" -f "$env:USERPROFILE\.ssh\id_ed25519"
}
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub"   # copy ini ke panel Rumah Web (langkah A4)
```

## B2. Uji koneksi ke VPS
```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519" root@<IP_VPS>
```
Kalau `Permission denied`:
- public key belum di-paste ke panel (A4) → ulangi
- pakai password root dulu: `ssh root@<IP_VPS>` (kalau panel mengizinkan)

## B3. Build produksi di PC & cek hasilnya
```powershell
cd "D:\DOCUMENTS\Default Project"
npm install
npm run build
```
Harus menghasilkan `dist\index.html` + `dist\assets\...` + `dist\server.cjs`.

## B4. Siapkan nilai environment untuk server
Buat file `env-server.txt` (jangan commit!) berisi:
```
APP_URL=https://bejodigitalprint.com
GEMINI_API_KEY=<API_KEY_ANDA>
REMOTE_ACCESS_USER=bejo
REMOTE_ACCESS_PASS=<PASSWORD_KUAT>
PORT=3000
```
> Password ini = **login Basic Auth browser** untuk pengunjung luar. Tab POS memakai login sendiri. Pilih password kuat, jangan sama dengan password akun Developer.

## B5. Kemas source (tanpa node_modules, dist, .env)
```powershell
cd "D:\DOCUMENTS\Default Project"
tar -czf "$env:TEMP\bejo-deploy.tar.gz" `
  --exclude=node_modules --exclude=dist --exclude=.git --exclude=.env `
  --exclude=logs --exclude=dev-server.log --exclude=URL-INTERNET.txt .
```

## B6. Upload ke VPS
**Cara 1 — SCP (cepat):**
```powershell
scp -i "$env:USERPROFILE\.ssh\id_ed25519" "$env:TEMP\bejo-deploy.tar.gz" root@<IP_VPS>:/tmp/
```

**Cara 2 — FileZilla/WinSCP (GUI):**
- Protokol: **SFTP**
- Host: `<IP_VPS>`, Port: 22, User: `root`, Auth: key/password
- Upload `bejo-deploy.tar.gz` ke `/tmp/`

**Cara 3 — sekali jalan (paket + deploy):**
```powershell
.\deploy\deploy-vps.ps1 -Host <IP_VPS> -User root -KeyPath "$env:USERPROFILE\.ssh\id_ed25519"
```

## B7. Bootstrap VPS (Node 22, PM2, Caddy, firewall)
Di terminal VPS:
```bash
mkdir -p /root/deploy && tar -xzf /tmp/bejo-deploy.tar.gz -C /root/deploy
cp /root/deploy/deploy/install-vps.sh /root/
bash /root/install-vps.sh
```
Yang terjadi: Node 22 terpasang, PM2 + Caddy terpasang, ufw menyalakan 22/80/443, user `bejo` dibuat, `/srv/bejo-pos` disiapkan, PM2 daftarkan auto-start saat boot.

## B8. Extract source & jalankan deploy
```bash
mkdir -p /srv/bejo-pos
tar -xzf /tmp/bejo-deploy.tar.gz -C /srv/bejo-pos
cd /srv/bejo-pos
chown -R bejo:bejo /srv/bejo-pos
bash deploy/deploy-vps.sh
```
Yang terjadi: `npm ci` → `npm run build` → `pm2 reload` → `pm2 save` → **health check otomatis**.

## B9. Isi .env di VPS
```bash
cd /srv/bejo-pos
nano .env          # isi sesuai B4
chmod 600 .env
chown bejo:bejo .env
sudo -u bejo -H pm2 restart bejo-pos --update-env
```
Alternatif tanpa nano (pakai file dari PC):
```powershell
scp -i "$env:USERPROFILE\.ssh\id_ed25519" env-server.txt root@<IP_VPS>:/srv/bejo-pos/.env
ssh -i "$env:USERPROFILE\.ssh\id_ed25519" root@<IP_VPS> "chmod 600 /srv/bejo-pos/.env && chown bejo:bejo /srv/bejo-pos/.env && cd /srv/bejo-pos && sudo -u bejo -H pm2 restart bejo-pos --update-env"
```

## B10. Aktifkan HTTPS (Caddy)
```bash
cp /srv/bejo-pos/deploy/Caddyfile /etc/caddy/Caddyfile
caddy fmt --overwrite /etc/caddy/Caddyfile
systemctl reload caddy
systemctl status caddy
```
Caddy otomatis meminta sertifikat Let's Encrypt. Cek:
```bash
curl -I https://bejodigitalprint.com
curl -s https://bejodigitalprint.com/api/health
```

## B11. Firebase: aktifkan Anonymous + deploy rules
1. Browser → Firebase Console → project `noted-segment-9xjsq` → **Authentication** → **Sign-in method** → **Anonymous** → **Enable** → Save
2. **Firestore Database** → **Rules** → tempel isi file `firestore.rules` (di repo) → **Publish**

Alternatif CLI:
```bash
npm i -g firebase-tools
firebase login
firebase use noted-segment-9xjsq
firebase deploy --only firestore:rules
```

## B12. Verifikasi menyeluruh
```bash
# 1. proses
sudo -u bejo -H pm2 status
# 2. health lokal
curl -s http://127.0.0.1:3000/api/health
# 3. health publik
curl -s https://bejodigitalprint.com/api/health
# 4. log error
sudo -u bejo -H pm2 logs bejo-pos --lines 50 --nostream
# 5. port terbuka
ss -ltnp | grep -E '3000|80|443'
```
Lalu dari browser (HP, data seluler — **matikan WiFi**):
| Uji | Harapan |
|---|---|
| `https://bejodigitalprint.com` | 401 Basic Auth (popup login browser) |
| Masuk dengan user/pass | Halaman landing publik tampil |
| Masuk ke aplikasi | Tab POS, Katalog, Laporan, Website normal |
| F12 → Console | Tidak ada `permission-denied` / error auth |
| Tab Website → pratinjau | Pratinjau live + favicon + judul tab sesuai |

## B13. Cutover (matikan server lokal)
Setelah semuanya stabil:
```powershell
# hentikan supervisor always-on di PC
Set-Content "D:\DOCUMENTS\Default Project\.stop-supervisor" "stop"
# atau matikan service/tunnel di VPS bila masih dipakai
```
> Simpan dulu **URL terowongan** di `URL-INTERNET.txt` sebagai cadangan kalau domain bermasalah.

## B14. Update aplikasi berikutnya (rutinitas)
```powershell
# ubah kode di PC
.\deploy\deploy-vps.ps1 -Host <IP_VPS> -User root -KeyPath "$env:USERPROFILE\.ssh\id_ed25519"
```
Rollback bila bermasalah:
```bash
ls -lt /var/backups/bejo-pos/
cd /srv/bejo-pos && tar -xzf /var/backups/bejo-pos/dist-<STAMP>.tar.gz && sudo -u bejo -H pm2 restart bejo-pos
```

---

# BAGIAN C — Checklist & Troubleshooting

## C1. Checklist final sebelum annon luncur
- [ ] DNS `@` & `www` → IP VPS, propagasi selesai
- [ ] HTTPS aktif, `http://` → `https://` otomatis, sertifikat valid
- [ ] `www` → domain utama (redirect permanen)
- [ ] `REMOTE_ACCESS_PASS` kuat & berbeda dari password aplikasi
- [ ] Firebase **Anonymous aktif** + `firestore.rules` ter-deploy (`request.auth != null`)
- [ ] `APP_URL=https://bejodigitalprint.com` di `.env` server
- [ ] `GEMINI_API_KEY` valid (uji AI Assistant di tab Website)
- [ ] Uji dari HP via data seluler (bukan WiFi)
- [ ] Port 3000 **tidak** terbuka di firewall panel
- [ ] Backup JSON data aplikasi (tab Pengaturan → Pencadangan) sudah diunduh
- [ ] Snapshot VPS dibuat (panel Rumah Web)
- [ ] Server lokal dimatikan setelah domain terbukti stabil

## C2. Troubleshooting
| Gejala | Penyebab | Solusi |
|---|---|---|
| `Permission denied (publickey)` | Public key belum terdaftar / salah | Paste ulang `.pub` di panel (A4), ulangi `ssh -i ...` |
| Timeout saat SSH | Firewall panelPort 22 tertutup | Buka 22 di panel + `ufw allow 22` |
| `curl: (7) Failed to connect` | PM2 mati / port beda | `pm2 logs bejo-pos`, pastikan `PORT=3000` di `.env` |
| `502 Bad Gateway` di domain | Caddy tidak menemukan app | `systemctl status caddy`, `pm2 status`, cek `curl 127.0.0.1:3000` |
| Sertifikat SSL gagal terbit | DNS belum propagasi / port 80 tertutup | Tunggu propagasi, buka 80 di panel, `caddy fmt` lalu reload |
| Halaman terbuka tanpa login Basic Auth | `REMOTE_ACCESS_PASS` kosong | Isi `.env` → `pm2 restart bejo-pos --update-env` |
| `permission-denied` di Firestore | Anonymous belum aktif atau rules lama | Aktifkan Anonymous, deploy ulang rules |
| `API key should be set` | `GEMINI_API_KEY` kosong | Isi di `.env` → restart |
| Halaman kosong / asset 404 | `dist/` tidak ikut ter-build di VPS | `cd /srv/bejo-pos && npm run build && pm2 reload` |
| Lambat / OOM | RAM kurang | `free -h` di VPS, upgrade paket, `max_memory_restart` di ecosystem |
| Nginx/Apache bawaan panel bentrok dengan Caddy | Port 80/443 dipakai | Nonaktifkan web server bawaan panel/hosting |
| Update kode tidak berubah | Cache browser | `Ctrl+F5` / hard reload |

## C3. Perintah harian yang paling sering dipakai
```bash
cd /srv/bejo-pos
sudo -u bejo -H pm2 status                  # status
sudo -u bejo -H pm2 logs bejo-pos --lines 100 --nostream   # log
sudo -u bejo -H pm2 restart bejo-pos        # restart
sudo -u bejo -H pm2 reload ecosystem.config.cjs --update-env
sudo -u bejo -H pm2 monit                   # monitor real-time
systemctl status caddy                      # status reverse proxy
ufw status                                 # status firewall
```

## C4.-who-owns-what (ringkas)
| Tugas | Panel Rumah Web | PC Anda | Terminal VPS |
|---|---|---|---|
| Pesan VPS & pilih OS | ✅ | | |
| Tambah SSH key | ✅ | ✅ (generate) | |
| Buka/tutup port | ✅ | | ✅ (ufw) |
| Arahkan DNS | ✅ | | |
| Build aplikasi | | ✅ | ✅ (build di VPS oleh deploy script) |
| Upload source | | ✅ | |
| Install Node/PM2/Caddy | | | ✅ |
| Isi .env | | ✅ (siapkan) | ✅ (tulis) |
| HTTPS + sertifikat | | | ✅ |
| Firebase rules | ✅ (console) | | |
| Verifikasi | | ✅ (browser/HP) | ✅ (curl/pm2) |
| Update berikutnya | | ✅ | ✅ |
