# AKSES APLIKASI DARI INTERNET
## Bejo Stiker POS — Cloudflare Tunnel + Proteksi Login

> **📌 Sedang menyiapkan hosting VPS + domain `bejodigitalprint.com`?**
> Panduan migrasi lengkap ada di **[MIGRASI-VPS.md](./MIGRASI-VPS.md)** — berisi setup DNS, VPS, PM2/Caddy/HTTPS, environment variable, instalasi **PocketBase** (database + realtime + auth), checklist verifikasi, sampai rollback.
> Dokumen ini menjelaskan cara *sementara* membuka aplikasi dari komputer/HP lain **di luar jaringan lokal** (lewat internet), beserta batasan dan risikonya.

---

## 1. Cara Menjalankan (Paling Mudah)

Klik dua kali file berikut di folder project:

```
jalankan-online.bat
```

Skrip akan otomatis:
1. Menjalankan server aplikasi di `http://localhost:3000`
2. Membuat terowongan Cloudflare
3. Menampilkan **alamat publik**, **username**, dan **password**

Tampilan akhirnya seperti ini:

```
==================================================================
  APLIKASI SIAP DIAKSES DARI INTERNET
==================================================================

  ALAMAT   : https://xxxxx-xxxx-xxxx.trycloudflare.com
  USERNAME : bejo
  PASSWORD : ********

  Status proteksi : terlindungi (401 - benar)
==================================================================
```

Bagikan **ALAMAT**, **USERNAME**, dan **PASSWORD** tersebut ke orang yang perlu mengakses.

> **Penting:** alamat `trycloudflare.com` **berubah setiap kali** skrip dijalankan ulang. Jadi setiap mau dipakai dari luar, jalankan skrip dan kirim alamat terbaru.

---

## 2. Cara Menjalankan Manual

Kalau ingin menjalankan sendiri tanpa skrip:

```powershell
# Terminal 1 — server aplikasi
cd 'D:\DOCUMENTS\Default Project'
npx.cmd tsx server.ts

# Terminal 2 — terowongan internet
& 'C:\Program Files (x86)\cloudflared\cloudflared.exe' tunnel --url http://localhost:3000 --no-autoupdate
```

Alamat publik muncul di output terminal 2, pada baris `Your quick Tunnel has been created!`.

---

## 3. Dua Lapis Login

Pengguna dari internet akan melewati **dua** login:

| Lapis | Kapan muncul | Kredensial |
|---|---|---|
| **1. Proteksi jaringan** | Langsung saat membuka alamat (dialog native browser) | `REMOTE_ACCESS_USER` + `REMOTE_ACCESS_PASS` dari `.env` |
| **2. Login aplikasi** | Setelah halaman terbuka | Akun aplikasi (Developer/Admin/Kasir/Owner) |

Lapis pertama menjaga agar aplikasi tidak bisa dijangkau bot/penyusup. Lapis kedua menentukan hak akses di dalam aplikasi.

**Akses dari jaringan lokal** (WiFi kantor yang sama) **tidak** melewati lapis pertama — hanya login aplikasi. Ini disengaja agar pengguna di toko tidak terganggu.

---

## 4. Mengubah Username & Password

Edit file `.env` di root project:

```
REMOTE_ACCESS_USER=bejo
REMOTE_ACCESS_PASS=ganti-dengan-password-baru
```

Lalu restart server (server akan otomatis restart saat `.env` berubah, atau tutup dan jalankan ulang skrip).

**Catatan:** `.env` sudah masuk `.gitignore` sehingga tidak ikut ter-commit. Jangan pernah membagikan isi file ini.

Untuk menonaktifkan proteksi (tidak disarankan), kosongkan `REMOTE_ACCESS_PASS`:

```
REMOTE_ACCESS_PASS=
```

---

## 5. Cara Kerja Singkat

```
Pengguna internet
      |  https (terenkripsi)
      v
Cloudflare Edge
      |  terowongan keluar (QUIC) — router TIDAK perlu diubah
      v
cloudflared (komputer Anda)
      |  localhost:3000
      v
Server aplikasi  -->  Vite (UI) + Express (API) + data/ (database invoice)
```

Keunggulan cara ini:
- **Tanpa port forwarding** — router tidak disentuh sama sekali
- **HTTPS otomatis** — data terenkripsi
- **IP publik dinamis tidak masalah**

Deteksi akses luar dilakukan lewat header `cf-connecting-ip`, `cf-ray`, `cf-visitor`, dan `x-forwarded-for`, karena cloudflared meneruskan request dari `127.0.0.1`.

---

## 6. Batasan yang WAJIB Diketahui

### 6.1 Sinkronisasi data antar komputer

| Data | Tersinkron? | Keterangan |
|---|---|---|
| Produk, pelanggan, transaksi, shift, SPK, invoice, pajak | **Ya** | Lewat **PocketBase** self-hosted di VPS (`https://bejodigitalprint.com/api/pb`) |
| Invoice (database server) | **Ya** | Tersimpan di `data/invoices_db.json` di komputer ini |
| Pengaturan landing page, laporan keuangan, preferensi | **Tidak** | Tersimpan di localStorage — hanya milik browser masing-masing |

Artinya pengaturan landing page dan input Laporan Keuangan **tidak** ikut pindah ke komputer lain.

### 6.2 Komputer harus tetap menyala

Aplikasi berjalan di komputer ini. Kalau komputer dimatikan, sleep, atau koneksi internet putus, akses dari luar ikut mati.

### 6.3 Terowongan gratis tanpa jaminan

`trycloudflare.com` (quick tunnel) ditujukan untuk penggunaan sementara/pengujian. Untuk pemakaian jangka panjang sebaiknya memakai **named tunnel** dengan domain sendiri (lihat bagian 8).

---

## 7. RISIKO KEAMANAN — Baca Sebelum Dipakai Serius

### 7.1 Aturan akses database

> ⚠️ **SUDAH DIPERBAIKI.** Sebelumnya aturan Firestore mengizinkan `read, write: if true`
> sehingga siapa pun yang membuka aplikasi bisa membaca/menulis seluruh data toko.
> Kini basis data adalah **PocketBase self-hosted** dengan API rules
> `@request.auth.id != ""` (hanya request terautentikasi), plus dilindungi
> **Basic Auth Caddy** + port 8090 yang hanya listen di localhost.

Pastikan di VPS:
- PocketBase API rules tiap koleksi ≠ kosong (lihat `scripts/create-pocketbase-collections.mjs`)
- Akun sinkronisasi `sync@bejo.local` memakai password kuat
- `REMOTE_ACCESS_PASS` (Basic Auth) berbeda dari password aplikasi

### 7.2 Password developer tersimpan di kode klien

`src/utils/authSecurity.ts` menyimpan kredensial developer dalam bentuk hex yang di-"obfuscate". Ini **bukan enkripsi** — bisa dibaca siapa pun lewat DevTools.

### 7.3 Server API tanpa pembatasan

`server.ts` tidak memiliki CORS restriction, rate limiting, atau token sesi. Endpoint seperti `/api/generate-image` dan `/api/ai-assistant` akan memakai kuota API Gemini Anda bila kunci diisi.

### 7.4 Rekomendasi bertahap

1. **Sekarang:** gunakan password kuat di `.env` (sudah dilakukan), dan jangan sebarkan alamat publik ke sembarang orang.
2. **Sudah:** API rules PocketBase dikunci (hanya request terautentikasi) + Basic Auth Caddy.
3. **Kalau dipakai rutin:** pindahkan kredensial keluar dari kode klien, tambahkan autentikasi token di API server.

---

## 8. Opsi Jangka Panjang: Named Tunnel (Alamat Tetap)

Quick tunnel punya alamat yang berubah-ubah. Kalau ingin alamat tetap seperti `pos.bejostiker.com`:

1. Punya domain yang sudah aktif di Cloudflare
2. Login cloudflared:
   ```powershell
   cloudflared tunnel login
   ```
3. Buat tunnel tetap:
   ```powershell
   cloudflared tunnel create bejo-pos
   cloudflared tunnel route dns bejo-pos pos.bejostiker.com
   ```
4. Buat file `config.yml`:
   ```yaml
   tunnel: bejo-pos
   credentials-file: C:\Users\DESKTOP\.cloudflared\<ID>.json
   ingress:
     - hostname: pos.bejostiker.com
       service: http://localhost:3000
     - service: http_status:404
   ```
5. Jalankan:
   ```powershell
   cloudflared tunnel run bejo-pos
   ```

Dengan cara ini alamat tidak berubah, dan bisa dijadikan layanan Windows agar menyala otomatis saat komputer dinyalakan.

---

## 9. Ringkasan Perintah Berguna

| Keperluan | Perintah |
|---|---|
| Jalankan semua (server + tunnel) | klik `jalankan-online.bat` |
| Cek server lokal | buka `http://localhost:3000` |
| Cek akses LAN (komputer lain di WiFi sama) | `http://192.168.1.16:3000` |
| Hentikan server | tutup jendela "bejo-server", atau `Stop-Process -Name node -Force` |
| Hentikan tunnel | `Stop-Process -Name cloudflared -Force` |
| Lihat log server | `%TEMP%\bejo-server.log` |
| Lihat log tunnel | `%TEMP%\bejo-tunnel.log` |

---

## 10. File Terkait

| File | Fungsi |
|---|---|
| `jalankan-online.bat` | Peluncur satu klik |
| `jalankan-online.ps1` | Skrip utama (server + tunnel + tampilkan URL) |
| `server.ts` | Lapisan proteksi login akses luar (Basic Auth) |
| `vite.config.ts` | `allowedHosts` agar domain terowongan tidak diblokir Vite |
| `.env` | Kredensial akses (`REMOTE_ACCESS_USER`, `REMOTE_ACCESS_PASS`) |

---

*Terakhir diperbarui: 20 Oktober 2026*