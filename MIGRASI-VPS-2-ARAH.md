# MIGRASI KE VPS WINDOWS — PANDUAN 2 ARAH (Rumah Web → bejodigitalprint.com)

> **Target:** VPS **Windows Server** di Rumah Web, domain `bejodigitalprint.com`.
> Semua langkah Panel VPS (SolusVM/Virtualizor) dipisahkan dari langkah Terminal/PC.

---

## 🎯 Gambaran Besar

```
Internet ──https──> Caddy (service Windows, port 80/443, TLS otomatis)
                         │
                         ├──/api/pb/*──> PocketBase (127.0.0.1:8090)  ← database + realtime + auth
                         │
                         └── /* ──────> Node.js 22 (service "BejoStikerPOS", port 3000)
                                           │
                                           └──> Gemini API
```

| Lapisan | Technology Windows | Service |
|---|---|---|
| Web server | Node.js 22 LTS (`dist/server.cjs`) | `BejoStikerPOS` (NSSM) |
| Database + realtime + auth | **PocketBase v0.28** (SQLite) | `PocketBase` (NSSM) |
| Reverse proxy + TLS | Caddy for Windows | `Caddy` (NSSM) |
| Auto start | Windows Service | ketiganya `SERVICE_AUTO_START` |
| Auto restart | NSSM `AppExit = Restart` | throttling 5 detik |
| Firewall | Windows Defender Firewall | 80, 443 terbuka; 3000 & 8090 **tidak** dibuka ke internet |

> ✅ **Firebase sudah dihapus sepenuhnya.** Basis data kini self-hosted di VPS sendiri (PocketBase),
> real-time sync memakai SSE PocketBase, dan auth memakai koleksi `users` di PocketBase.
> Bila PocketBase mati, aplikasi otomatis jatuh ke **Mode Lokal** (localStorage) tanpa kehilangan data.

---

# BAGIAN A — Sisi Dashboard VPS (panel Rumah Web)

### A1. Login ke panel VPS
Buka panel **VPS** Rumah Web (bukan cPanel/DirectAdmin) → **Login**.

> Semua pengaturan sistem operasi dilakukan di panel **VPS** atau lewat **Remote Desktop**, bukan lewat cPanel.

### A2. Pastikan VPS|Windows siap
Menu **Virtual Servers / VPS**:

| Yang harus ada | Nilai |
|---|---|
| Status | **Running** |
| OS | **Windows Server 2019 / 2022 (Datacenter, 64-bit)** |
| Resources | minimal **2 vCPU / 4 GB RAM / 60 GB SSD** (Windows butuh RAM lebih besar dari Linux) |
| IPv4 | 1 IP publik (catat!) |
| RDP | port default **3389** |

> Kalau OS-nya belum Windows: buat **snapshot**, lalu **reinstall** dengan Windows Server (⚠️ data hilang).
> Kalau panel menyediakan "Windows Server" lain (mis. 2012/2016), pilih **2019 atau 2022**.

### A3. Kredensial & data akses
| Item | Nilai |
|---|---|
| IP VPS | `x.x.x.x` |
| Port RDP | `3389` |
| User | `Administrator` (atau `bejo` bila dibuat) |
| Password | (dari panel / yang Anda tentukan saat membuat VPS) |
| Hostname | `vps.bejodigitalprint.com` |

### A4. Firewall di panel VPS
Menu **Firewall / Security Group** → tambah rule:

| Port | Protocol | Source | Keterangan |
|---|---|---|---|
| 3389 | TCP | IP Anda (atau semua bila perlu) | Remote Desktop |
| 22 | TCP | IP Anda | SSH (untuk deploy otomatis; opsional) |
| 80 | TCP | Semua | HTTP → penerbitan sertifikat SSL |
| 443 | TCP | Semua | HTTPS |

> Port **3000 tidak boleh** dibuka (aplikasi hanya diakses lewat Caddy di 443).

### A5. Snapshot & console
| Fitur panel | Kegunaan |
|---|---|
| **Snapshot / Image** | Ambil snapshot sebelum deploy besar atau sebelum reinstall |
| **Console / VNC / HTML5** | Alternatif masuk VPS tanpa RDP (dipakai kalau RDP terblokir) |
| **Reboot / Restart** | Restart bersih |
| **Reinstall** | Reset ke Windows Server 2022 |

### A6. DNS domain → IP VPS
Di panel domain / registrar:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `<IP VPS>` | Auto |
| A | `www` | `<IP VPS>` | Auto |
| A | `vps` | `<IP VPS>` | Auto |

Cek dari PC: `nslookup bejodigitalprint.com` → **harus sudah menunjuk IP VPS** sebelum lanjut (sertifikat SSL butuh DNS hidup).

---

# BAGIAN B - Sisi Aplikasi (PC Anda + VPS Windows)

## B1. PC siap: Node, SSH key
```powershell
node -v     # v20+ (v22 disarankan)
ssh -V      # OpenSSH Client harus ada
if (-not (Test-Path "$env:USERPROFILE\.ssh\id_ed25519")) {
  ssh-keygen -t ed25519 -C "bejo-pc" -f "$env:USERPROFILE\.ssh\id_ed25519"
}
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub"
```
> Public key ini bisa ditambahkan di panel VPS (menu **SSH Keys**) bila tersedia. Jika tidak, Anda tetap bisa masuk via RDP (langkah B3) — deploy cukup dilakukan manual dari RDP.

## B2. Masuk ke VPS lewat Remote Desktop (RDP)
Di PC: tekan `Win + R` → ketik `mstsc` → isi `IP_VPS` → login sebagai `Administrator`.

> Tips: klik kanan file `.ps1` di desktop VPS → **Run with PowerShell** (jalankan sebagai Administrator).

## B3. Aktifkan OpenSSH Server di VPS (untuk deploy otomatis via SCP/SSH)
Di **PowerShell sebagai Administrator** di dalam VPS:
```powershell
# cek dulu
Get-Service sshd -ErrorAction SilentlyContinue

# bila belum ada
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
New-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -DisplayName "OpenSSH Server (sshd)" `
  -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22
```
Kembali ke PC, tes:
```powershell
ssh Administrator@<IP_VPS>
```

## B4. Build produksi di PC
```powershell
cd "D:\DOCUMENTS\Default Project"
npm install
npm run build     # menghasilkan dist\index.html, dist\assets, dist\server.cjs
```

## B5. Siapkan environment variable untuk server
Buat `env-server.txt` (jangan commit):
```
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
> `REMOTE_ACCESS_*` = login **Basic Auth browser** untuk pengunjung luar (beda dengan login aplikasi).
> `VITE_PB_SYNC_*` = akun sinkronisasi milik **aplikasi** (bukan user humans). Ganti passwordnya!

## B6. Pasang Node + Caddy + NSSM + Service di VPS
Di **PowerShell Administrator di VPS** (lewat RDP), copy file `deploy/install-vps-windows.ps1` ke VPS lalu jalankan:
```powershell
# cara 1: file sudah ada di VPS (mis. di folder download)
powershell -NoProfile -ExecutionPolicy Bypass -File C:\deploy\install-vps-windows.ps1

# cara 2: paste manual isi skrip ke PowerShell VPS lalu:
#   .\install-vps-windows.ps1
```
Yang dilakukan skrip:
1. Node.js 22 LTS terpasang otomatis (diam, bila belum ada)
2. Caddy diunduh ke `C:\caddy`
3. NSSM diunduh ke `C:\nssm`
4. Folder `C:\bejo-pos`, `C:\caddy\logs`, `C:\backups\bejo-pos` dibuat
5. Firewall Windows: 80 & 443 dibuka, 3000 diblokir
6. Service `BejoStikerPOS` & `Caddy` terdaftar (auto start + auto restart)
7. `Caddyfile` awal dibuat untuk `bejodigitalprint.com`

Cek:
```powershell
Get-Service BejoStikerPOS, Caddy
& C:\caddy\caddy.exe version
```

## B7. Upload source ke VPS
**Cara 1 — lewat RDP + FileZilla/Windows Explorer (paling sederhana)**
- Copy folder project (tanpa `node_modules`, `dist`, `.env`) ke `C:\bejo-pos` di VPS lewat RDP drive sharing / FileZilla SFTP.

**Cara 2 — deploy dari dalam VPS (lewat RDP)**
> Skrip deploy lama berbasis SSH (`remote-run.ps1`, `deploy-vps-windows.ps1`) sudah dihapus. Deploy produksi dijalankan di dalam VPS agar Caddy, NSSM, dan PocketBase ikut diverifikasi.

## B8. Jalankan deploy (di VPS)
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\bejo-pos\deploy\deploy-vps.ps1 -Force
```
Skrip universal ini: unduh source `main` dari GitHub → `npm ci` + build → pasang Caddyfile → restart `BejoStikerPOS` → health check + rollback → verifikasi DNS/HTTPS/domain publik.

## B9. Isi `.env` di VPS
```powershell
notepad C:\bejo-pos\.env
# isi sesuai langkah B5
```
```powershell
Restart-Service BejoStikerPOS
```

## B10. HTTPS otomatis oleh Caddy
Caddy sudah dikonfigurasi oleh `install-vps-windows.ps1` (Caddyfile di `C:\caddy\Caddyfile`).
Setelah deploy selesai, Caddy membaca Caddyfile terbaru:
```powershell
# refresh Caddyfile dari project (punya domain + header keamanan)
Copy-Item C:\bejo-pos\deploy\Caddyfile.windows C:\caddy\Caddyfile -Force
& C:\caddy\caddy.exe fmt --overwrite C:\caddy\Caddyfile
Restart-Service Caddy
```
Cek:
```powershell
curl.exe -I https://bejodigitalprint.com
curl.exe -s https://bejodigitalprint.com/api/health
```

## B11. PocketBase — database + realtime + auth (WAJIB, urut)

> Firebase **tidak lagi dipakai**. Semua data (produk, pelanggan, transaksi, stok, agen, shift, SPK,
> laporan, invoice, pajak, CMS Website) kini disimpan di **PocketBase** di VPS ini.

### B11.1 Pasang PocketBase + service Windows
Di **PowerShell Administrator di VPS**:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\bejo-pos\deploy\setup-pocketbase.ps1
```
Yang dilakukan skrip:
1. Unduh PocketBase v0.28.1 (windows_amd64) ke `C:\pocketbase`
2. Lokasi data: `C:\pocketbase\pb_data` (file `data.db` = basis data SQLite)
3. Daftarkan service Windows `PocketBase` (NSSM, auto start + auto restart, port **8090**)
4. Firewall: port 8090 **hanya lokal** (127.0.0.1) — tidak dibuka ke internet
5. Update `Caddyfile` (route `/api/pb/*` → PocketBase) lalu restart Caddy

Cek:
```powershell
Get-Service PocketBase
curl.exe -s http://127.0.0.1:8090/api/health
#hopefully: {"message":"API is healthy.","code":200,...}
```

### B11.2 Buat admin PocketBase (sekali saja)
```powershell
& C:\pocketbase\pocketbase.exe admin create admin@bejodigitalprint.com "<PASSWORD_ADMIN>"
```
Atau buka `http://127.0.0.1:8090/_/` di browser VPS (Remote Desktop) → **Sign up** sebagai admin.

### B11.3 Buat 27 koleksi + skema (dari PC)
Jalankan **di PC Anda** (butuh `pocketbase` npm, sudah ada di project):
```powershell
cd "D:\DOCUMENTS\Default Project"
$env:POCKETBASE_URL="http://<IP_VPS>:8090"     # sementara: buka port 8090 utk seeding
$env:PB_ADMIN_EMAIL="admin@bejodigitalprint.com"
$env:PB_ADMIN_PASSWORD="<PASSWORD_ADMIN>"
node scripts\create-pocketbase-collections.mjs --drop
```
> Jika port 8090 tidak ingin dibuka ke internet, jalankan perintah ini di **VPS** (Node 22 sudah terpasang),
> lalu hapus variabel `$env:` tersebut. Alternatif: pakai terowongan SSH.

Output: 27 koleksi dibuat (`products`, `customers`, `transactions`, `users`, `settings`, `invoices`, …)
dengan API rules `@request.auth.id != ""` (hanya request terautentikasi yang boleh akses).

### B11.4 Buat akun sinkronisasi aplikasi
```powershell
# di PC
node -e "const PocketBase=require('pocketbase');(async()=>{const pb=new PocketBase('http://<IP_VPS>:8090');await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL,process.env.PB_ADMIN_PASSWORD);const r=await pb.collection('users').create({email:'sync@bejo.local',password:process.env.PB_SYNC_PASSWORD,passwordConfirm:process.env.PB_SYNC_PASSWORD,name:'Bejo Sync Service',role:'developer',isActive:true});console.log('Sync user OK:',r.id);})()"
```
> **WAJIB:** password di sini harus sama dengan `VITE_PB_SYNC_PASSWORD` di `.env` (langkah B9).

### B11.5 Migrasi data lama (opsional, bila ada data Firebase)
Bila aplikasi lama masih punya data di Firestore, jalankan di PC:
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="D:\DOCUMENTS\Default Project\service-account-key.json"
$env:FIREBASE_PROJECT_ID="noted-segment-9xjsq"
$env:POCKETBASE_URL="http://<IP_VPS>:8090"
$env:PB_ADMIN_EMAIL="admin@bejodigitalprint.com"
$env:PB_ADMIN_PASSWORD="<PASSWORD_ADMIN>"
node scripts\migrate-firestore-to-pocketbase.mjs            # tanpa --dry-run untuk menulis
```
> `--dry-run` = hanya menghitung. `--truncate` = kosongkan koleksi tujuan dulu.
> Bila tidak ada data lama, lewati langkah ini — aplikasi akan melakukan **seeding** otomatis saat pertama dijalankan.

### B11.6 Migrasi otomatis file aplikasi (bila dari source lama)
Bila source di PC masih memakai Firebase, jalankan **sekali**:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\migrate-to-pocketbase.ps1
```
Skrip ini mem-backup, mengganti seluruh import `firebase` → `backend/pocketbaseBackend`,
mengganti nama fungsi (Firestore → PocketBase), menghapus `src/firebase.ts`, menambahkan proxy Caddy,
lalu menjalankan `npm install` + type-check + build.

### B11.7 Verifikasi realtime
Di browser aplikasi (F12 → Console) harusnya muncul:
```
[PocketBase] Auth: authenticated (sync@bejo.local)
[PocketBase] Terhubung & terautentikasi.
Connected to PocketBase successfully
```
Uji live: ubah satu produk di **Admin UI PocketBase** (`http://127.0.0.1:8090/_/`) → tab Katalog di
browser harus **langsung berubah** tanpa refresh.

## B12. Verifikasi menyeluruh
Di VPS:
```powershell
Get-Service BejoStikerPOS, Caddy, PocketBase
Get-Content C:\bejo-pos\logs\stderr.log -Tail 30
curl.exe -s http://127.0.0.1:3000/api/health
curl.exe -s http://127.0.0.1:8090/api/health
curl.exe -s https://bejodigitalprint.com/api/health
curl.exe -s https://bejodigitalprint.com/api/pb/api/health     # realtime/DB via Caddy
netstat -ano | findstr ":3000 :8090 :80 :443"
```
Dari browser (HP, **data seluler, WiFi dimatikan**):

| Uji | Harapan |
|---|---|
| `https://bejodigitalprint.com` | 401 Basic Auth (popup login browser) |
| Masuk dengan user/pass | Halaman landing publik tampil |
| Masuk ke aplikasi | Semua tab normal (POS, Katalog, Laporan, Website) |
| F12 → Console | `[PocketBase] Terhubung & terautentikasi.` (tanpa `permission-denied`) |
| Tab Website → pratinjau | Pratinjau live, favicon & judul tab sesuai |
| Ubah produk di Admin UI PocketBase | Tab Katalog berubah **live** (realtime) |

## B13. Cutover
Setelah stabil:
```powershell
# di PC: matikan server lokal (always-on)
Set-Content "D:\DOCUMENTS\Default Project\.stop-supervisor" "stop"
```

## B14. Update berikutnya
Commit + push ke `main`, lalu di VPS lewat RDP:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\bejo-pos\deploy\deploy-vps.ps1 -Force
```
Rollback (di VPS):
```powershell
Get-ChildItem C:\backups\bejo-pos -Directory | Sort-Object Name -Descending
Remove-Item C:\bejo-pos\dist -Recurse -Force
Copy-Item C:\backups\bejo-pos\dist-<STAMP> C:\bejo-pos\dist -Recurse
Restart-Service BejoStikerPOS
```

---

# BAGIAN C — Checklist, Troubleshooting, Operasional

## C1. Checklist final sebelumdomain diumumkan
- [ ] DNS `@` & `www` → IP VPS, propagasi selesai (`nslookup`)
- [ ] HTTPS aktif, `http://` → `https://`, sertifikat valid
- [ ] `www` → domain utama (redirect permanen)
- [ ] `REMOTE_ACCESS_PASS` kuat & berbeda dari password aplikasi
- [ ] Service `PocketBase` **Running** (auto start + auto restart)
- [ ] 27 koleksi PocketBase sudah dibuat (`node scripts\create-pocketbase-collections.mjs`)
- [ ] Akun sinkronisasi `sync@bejo.local` dibuat & passwordnya sama dengan `VITE_PB_SYNC_PASSWORD`
- [ ] `.env` di VPS berisi `VITE_POCKETBASE_URL` + `VITE_PB_SYNC_EMAIL` + `VITE_PB_SYNC_PASSWORD`
- [ ] Caddy punya route `handle /api/pb/* { reverse_proxy 127.0.0.1:8090 }`
- [ ] Port **3000** & **8090** TIDAK terbuka ke internet (panel + Windows Firewall)
- [ ] `APP_URL=https://bejodigitalprint.com` di `C:\bejo-pos\.env`
- [ ] `GEMINI_API_KEY` valid (uji AI Assistant di tab Website)
- [ ] Uji dari HP via data seluler (WiFi mati)
- [ ] Uji realtime: ubah data di Admin UI PocketBase → aplikasi berubah live
- [ ] Snapshot VPS diambil (panel Rumah Web)
- [ ] Backup JSON data aplikasi (tab Pengaturan → Pencadangan) diunduh
- [ ] Backup `C:\pocketbase\pb_data` (copy folder saat service dimatikan)
- [ ] Server lokal dimatikan setelah domain stabil

## C2. Troubleshooting (Windows)
| Gejala | Penyebab | Solusi |
|---|---|---|
| Tidak bisa RDP | Port 3389 tertutup di panel | Buka 3389 (source IP Anda) di firewall panel |
| `Permission denied (publickey)` | Public key tidak terdaftar | Tempel `.pub` ke C:\Users\Administrator\.ssh\authorized_keys di VPS, atau pakai RDP |
| `Get-Service` → service `Stopped` | Build gagal / belum ada `dist` | `Get-Content C:\bejo-pos\logs\stderr.log -Tail 50`, jalankan deploy ulang |
| `502 Bad Gateway` di domain | Caddy jalan, app mati (atau Caddy mati) | `Get-Service Caddy, BejoStikerPOS`; `curl 127.0.0.1:3000/api/health` |
| Console: "Server tidak terjangkau" / Mode Lokal | PocketBase mati / 8090 diblokir | `Get-Service PocketBase`; `curl 127.0.0.1:8090/api/health`; firewall izinkan 8090 dari LOCALHOST |
| Console: 401 Unauthorized | Akun sinkronisasi belum dibuat / password beda | Buat user `sync@bejo.local`; samakan dengan `VITE_PB_SYNC_PASSWORD` di `.env` → build ulang |
| Console: 403 / 400 Failed to create record | API rules koleksi masih kosong | Jalankan ulang `node scripts\create-pocketbase-collections.mjs --drop` |
| Realtime tidak berubah | Caddy tidak meneruskan SSE `/api/pb` | Pastikan Caddyfile punya `handle /api/pb/*`; `Restart-Service Caddy` |
| 404 di `/api/pb/...` | Route proxy belum ada / service Caddy belum reload | `Copy-Item C:\bejo-pos\deploy\Caddyfile.windows C:\caddy\Caddyfile -Force; Restart-Service Caddy` |
| Sertifikat SSL gagal terbit | DNS belum propagasi / port 80 tertutup | Cek `nslookup`, buka 80 di panel, `Caddyfile` → `Restart-Service Caddy` |
| Halaman terbuka tanpa login Basic Auth | `REMOTE_ACCESS_PASS` kosong | Isi `.env` → `Restart-Service BejoStikerPOS` |
| `API key should be set` | `GEMINI_API_KEY` kosong | Isi `.env` → restart service |
| Halaman kosong / asset 404 | `dist` tidak ter-build di VPS | `cd C:\bejo-pos; npm run build; Restart-Service BejoStikerPOS` |
| Lambat / service restart sendiri | RAM kurang | `Get-CimInstance Win32_OperatingSystem` → naikkan paket VPS (minimal 4 GB) |
| `The system cannot find the path specified` saat deploy | Path `C:\bejo-pos` belum ada | Jalankan `install-vps-windows.ps1` lebih dulu |
| Deploy lama tak berefek | Browser cache | `Ctrl+F5` / hard reload |

## C3. Perintah harian (di VPS)
```powershell
Get-Service BejoStikerPOS, Caddy, PocketBase         # status
Get-Content C:\bejo-pos\logs\stderr.log -Tail 100  # log error
Get-Content C:\bejo-pos\logs\stdout.log -Tail 100  # log output
Get-Content C:\pocketbase\logs\stderr.log -Tail 100 # log PocketBase
Restart-Service BejoStikerPOS                       # restart aplikasi
Restart-Service Caddy                               # restart proxy
Restart-Service PocketBase                          # restart database
curl.exe -s http://127.0.0.1:3000/api/health        # health check aplikasi
curl.exe -s http://127.0.0.1:8090/api/health        # health check database
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 80,443,3000,8090 }
```

### C3.1 Backup basis data PocketBase
```powershell
# service dimatikan sebentar agar file SQLite konsisten
Stop-Service PocketBase
Copy-Item C:\pocketbase\pb_data "C:\backups\bejo-pos\pb_data-$(Get-Date -Format yyyyMMdd-HHmm)" -Recurse
Start-Service PocketBase
```

## C4. Update melalui panel (opsional)
Beberapa panel Rumah Web menyediakan tombol **"Restart"**/**"Console"** untuk VPS Windows — berguna saat service tidak merespons.

---

## 🎯 Ringkasan siapa melakukan apa
| Tugas | Panel Rumah Web | PC Anda | VPS (RDP/PowerShell) |
|---|:--:|:--:|:--:|
| Pilih Windows Server + sumber daya | ✅ | | |
| Password Administrator & RDP | ✅ | | |
| Buka port 3389/80/443 | ✅ | | ✅ (firewall Windows) |
| DNS | ✅ | | |
| Install Node/Caddy/NSSM + service | | | ✅ |
| Install PocketBase + service `PocketBase` | | | ✅ |
| Build & upload source | | ✅ | ✅ |
| Isi `.env` | | ✅ siapkan | ✅ |
| HTTPS + sertifikat | | | ✅ |
| Buat 27 koleksi PocketBase + akun sinkronisasi | | ✅ (Node script) | |
| Migrasi data Firestore → PocketBase (opsional) | | ✅ (Node script) | |
| Verifikasi | | ✅ (browser/HP) | ✅ (curl/Get-Service) |
| Update berikutnya | | ✅ | ✅ (otomatis) |
