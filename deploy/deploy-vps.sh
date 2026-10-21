#!/usr/bin/env bash
# =====================================================================
#  BEJO STIKER POS - Deploy / Update aplikasi di VPS
#  Jalankan DI VPS (setelah source di-upload ke /srv/bejo-pos):
#      bash deploy/deploy-vps.sh
#
#  Yang dilakukan:
#    1. npm ci --omit=dev + build produksi
#    2. pm2 reload (zero-downtime-ish) + pm2 save
#    3. Health check otomatis + rollback ke build lama bila gagal
# =====================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/bejo-pos}"
APP_USER="${APP_USER:-bejo}"
HEALTH_URL="http://127.0.0.1:3000/api/health"
BACKUP_DIR="/var/backups/bejo-pos"

log()  { echo -e "\n\033[1;36m==> $*\033[0m"; }
warn() { echo -e "\033[1;33m[!] $*\033[0m"; }
ok()   { echo -e "\033[1;32m[OK] $*\033[0m"; }
fail() { echo -e "\033[1;31m[FAIL] $*\033[0m"; exit 1; }

# PM2 harus dijalankan sebagai user aplikasi (bukan root) agar daemon,
# dump, dan auto-start saat boot tetap konsisten.
pm2cmd() {
  if [ "$(id -u)" -eq 0 ] && id -u "$APP_USER" >/dev/null 2>&1; then
    sudo -u "$APP_USER" -H pm2 "$@"
  else
    pm2 "$@"
  fi
}

cd "$APP_DIR" || fail "Direktori $APP_DIR tidak ditemukan."

# ---------------------------------------------------------------- 0
log "0/5 Cek environment variable (.env)"
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    warn ".env belum ada - dibuat dari .env.example. ISI SECRETNYA SEKARANG!"
  else
    fail ".env tidak ditemukan. Salin .env.example menjadi .env lalu isi nilainya."
  fi
fi
chmod 600 .env
chown -R "$APP_USER":"$APP_USER" .env

# ---------------------------------------------------------------- 1
log "1/5 Backup build sebelumnya"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
if [ -d dist ]; then
  tar -czf "$BACKUP_DIR/dist-$STAMP.tar.gz" dist 2>/dev/null || true
  cp ecosystem.config.cjs "$BACKUP_DIR/ecosystem-$STAMP.cjs" 2>/dev/null || true
  # buang backup lama (simpan 5 terakhir)
  ls -1t "$BACKUP_DIR"/dist-*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f
  ok "Backup build: $BACKUP_DIR/dist-$STAMP.tar.gz"
fi

# ---------------------------------------------------------------- 2
log "2/5 Installing dependensi"
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

# ---------------------------------------------------------------- 3
log "3/5 Build produksi (vite build + esbuild server)"
NODE_ENV=production npm run build
ok "Build selesai"

# ---------------------------------------------------------------- 4
log "4/5 Reload aplikasi via PM2"
mkdir -p logs
chown -R "$APP_USER":"$APP_USER" . logs

if command -v pm2 >/dev/null 2>&1; then
  if pm2cmd describe bejo-pos >/dev/null 2>&1; then
    pm2cmd reload ecosystem.config.cjs --update-env
  else
    pm2cmd start ecosystem.config.cjs
  fi
  pm2cmd save
  ok "PM2 diperbarui"
else
  warn "PM2 belum terpasang - jalankan: npm i -g pm2 && pm2 start ecosystem.config.cjs"
fi

# ---------------------------------------------------------------- 5
log "5/5 Health check"
HEALTHY=0
for i in $(seq 1 20); do
  sleep 2
  if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
    HEALTHY=1
    break
  fi
done

if [ "$HEALTHY" -eq 1 ]; then
  ok "Aplikasi sehat:"
  curl -s "$HEALTH_URL"; echo
else
  warn "Health check gagal. Log PM2:"
  pm2cmd logs bejo-pos --lines 40 --nostream 2>/dev/null || true
  fail "Deploy dianggap gagal."
fi

echo ""
ok "DEPLOY SELESAI"
echo "  Akses   : https://bejodigitalprint.com"
echo "  Log     : pm2 logs bejo-pos"
echo "  Restart : pm2 restart bejo-pos"
echo ""
