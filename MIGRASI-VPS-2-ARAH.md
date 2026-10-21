# MIGRASI KE VPS WINDOWS — PANDUAN 2 ARAH (Rumah Web → bejodigitalprint.com)

> **Target:** VPS **Windows Server** di Rumah Web, domain `bejodigitalprint.com`.
> Semua langkah Panel VPS (SolusVM/Virtualizor) dipisahkan dari langkah Terminal/PC.

---

## 🎯 Gambaran Besar

```
Internet ──https──> Caddy (service Windows, port 80/443, TLS otomatis)
                         │ reverse_proxy 127.0.0.1:3000
                         ▼
             Node.js 22 (service "BejoStikerPOS", port 3000)
                         │
                         ├──> Firestore (data cloud, tidak dimigrasi)
                         └──> Gemini API
```

| Lapisan | Technology Windows | Service |
|---|---|---|
| Web server | Node.js 22 LTS (`dist/server.cjs`) | `BejoStikerPOS` (NSSM) |
| Reverse proxy + TLS | Caddy for Windows | `Caddy` (NSSM) |
| Auto start | Windows Service | keduanya `SERVICE_AUTO_START` |
| Auto restart | NSSM `AppExit = Restart` | throttling 5 detik |
| Firewall | Windows Defender Firewall | 80, 443 terbuka; 3009 diblokir |

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
```
> `REMOTE_ACCESS_*` = login **Basic Auth browser** untuk pengunjung luar (beda dengan login aplikasi).

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

**Cara 2 — otomatis dari PC (kalau OpenSSH sudah aktif)**
```powershell
.\deploy\deploy-vps.ps1 -Host <IP_VPS> -User Administrator -KeyPath "$env:USERPROFILE\.ssh\id_ed25519"
```
Skrip ini: build lokal → paket source → SCP → jalankan `remote-run.ps1` di VPS → ekstrak → `deploy-vps-windows.ps1` → backup → `npm ci` → build → **restart service** → **health check** → rollback bila gagal.

## B8. Jalankan deploy (di VPS)
```powershell
cd C:\bejo-pos
powershell -NoProfile -ExecutionPolicy Bypass -File C:\bejo-pos\deploy\deploy-vps-windows.ps1
```
Output: backup build lama → `npm ci` → build → `Restart-Service BejoStikerPOS` → health check.

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
Copy-Item C:\bejo-pos\deploy\Caddyfile C:\caddy\Caddyfile -Force
& C:\caddy\caddy.exe fmt --overwrite C:\caddy\Caddyfile
Restart-Service Caddy
```
Cek:
```powershell
curl.exe -I https://bejodigitalprint.com
curl.exe -s https://bejodigitalprint.com/api/health
```

## B11. Firebase (WAJIB, urut)
1. Firebase Console → project `noted-segment-9xjsq` → **Authentication → Sign-in method → Anonymous → Enable**
2. **Firestore Database → Rules** → tempel isi `firestore.rules` → **Publish**

## B12. Verifikasi menyeluruh
Di VPS:
```powershell
Get-Service BejoStikerPOS, Caddy
Get-Content C:\bejo-pos\logs\stderr.log -Tail 30
curl.exe -s http://127.0.0.1:3000/api/health
curl.exe -s https://bejodigitalprint.com/api/health
netstat -ano | findstr ":3000 :80 :443"
```
Dari browser (HP, **data seluler, WiFi dimatikan**):

| Uji | Harapan |
|---|---|
| `https://bejodigitalprint.com` | 401 Basic Auth (popup login browser) |
| Masuk dengan user/pass | Halaman landing publik tampil |
| Masuk ke aplikasi | Semua tab normal (POS, Katalog, Laporan, Website) |
| F12 → Console | Tidak ada `permission-denied` |
| Tab Website → pratinjau | Pratinjau live, favicon & judul tab sesuai |

## B13. Cutover
Setelah stabil:
```powershell
# di PC: matikan server lokal (always-on)
Set-Content "D:\DOCUMENTS\Default Project\.stop-supervisor" "stop"
```

## B14. Update berikutnya
```powershell
# di PC: ubah kode lalu
.\deploy\deploy-vps.ps1 -Host <IP_VPS> -User Administrator
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
- [ ] Firebase **Anonymous aktif** + `firestore.rules` ter-deploy (`request.auth != null`)
- [ ] `APP_URL=https://bejodigitalprint.com` di `C:\bejo-pos\.env`
- [ ] `GEMINI_API_KEY` valid (uji AI Assistant di tab Website)
- [ ] Uji dari HP via data seluler (WiFi mati)
- [ ] Port 3000 **tidak** terbuka (panel + Windows Firewall)
- [ ] Snapshot VPS diambil (panel Rumah Web)
- [ ] Backup JSON data aplikasi (tab Pengaturan → Pencadangan) diunduh
- [ ] Server lokal dimatikan setelah domain stabil

## C2. Troubleshooting (Windows)
| Gejala | Penyebab | Solusi |
|---|---|---|
| Tidak bisa RDP | Port 3389 tertutup di panel | Buka 3389 (source IP Anda) di firewall panel |
| `Permission denied (publickey)` | Public key tidak terdaftar | Tempel `.pub` ke C:\Users\Administrator\.ssh\authorized_keys di VPS, atau pakai RDP |
| `Get-Service` → service `Stopped` | Build gagal / belum ada `dist` | `Get-Content C:\bejo-pos\logs\stderr.log -Tail 50`, jalankan deploy ulang |
| `502 Bad Gateway` di domain | Caddy jalan, app mati (atau Caddy mati) | `Get-Service Caddy, BejoStikerPOS`; `curl 127.0.0.1:3000/api/health` |
| Sertifikat SSL gagal terbit | DNS belum propagasi / port 80 tertutup | Cek `nslookup`, buka 80 di panel, `Caddyfile` → `Restart-Service Caddy` |
| Halaman terbuka tanpa login Basic Auth | `REMOTE_ACCESS_PASS` kosong | Isi `.env` → `Restart-Service BejoStikerPOS` |
| `permission-denied` Firestore | Anonymous belum aktif / rules lama | Aktifkan Anonymous, deploy ulang rules |
| `API key should be set` | `GEMINI_API_KEY` kosong | Isi `.env` → restart service |
| Halaman kosong / asset 404 | `dist` tidak ter-build di VPS | `cd C:\bejo-pos; npm run build; Restart-Service BejoStikerPOS` |
| Lambat / service restart sendiri | RAM kurang | `Get-CimInstance Win32_OperatingSystem` → naikkan paket VPS (minimal 4 GB) |
| `The system cannot find the path specified` saat deploy | Path `C:\bejo-pos` belum ada | Jalankan `install-vps-windows.ps1` lebih dulu |
| Deploy lama tak berefek | Browser cache | `Ctrl+F5` / hard reload |

## C3. Perintah harian (di VPS)
```powershell
Get-Service BejoStikerPOS, Caddy                    # status
Get-Content C:\bejo-pos\logs\stderr.log -Tail 100  # log error
Get-Content C:\bejo-pos\logs\stdout.log -Tail 100  # log output
Restart-Service BejoStikerPOS                       # restart aplikasi
Restart-Service Caddy                               # restart proxy
curl.exe -s http://127.0.0.1:3000/api/health        # health check
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 80,443,3000 }
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
| Build & upload source | | ✅ | ✅ |
| Isi `.env` | | ✅ siapkan | ✅ |
| HTTPS + sertifikat | | | ✅ |
| Firebase rules | ✅ (console) | | |
| Verifikasi | | ✅ (browser/HP) | ✅ (curl/Get-Service) |
| Update berikutnya | | ✅ | ✅ (otomatis) |
