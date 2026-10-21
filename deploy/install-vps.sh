#!/usr/bin/env bash
# =====================================================================
#  BEJO STIKER POS - Bootstrap VPS (Ubuntu/Debian)
#  Jalankan SEKALI pada VPS baru:
#      sudo bash install-vps.sh
#
#  Yang dilakukan:
#    1. Update paket & pasang dependensi dasar
#    2. Pasang Node.js 22 LTS (NodeSource)
#    3. Pasang PM2 (process manager) + Caddy (reverse proxy + HTTPS)
#    4. Mengatur firewall (ufw): hanya 22, 80, 443
#    5. Membuat user aplikasi "bejo" & direktori /srv/bejo-pos
#    6. Menyalakan PM2 saat boot
# =====================================================================
set -euo pipefail

APP_USER="bejo"
APP_DIR="/srv/bejo-pos"
DOMAIN="bejodigitalprint.com"
WWW_DOMAIN="www.${DOMAIN}"

log()  { echo -e "\n\033[1;36m==> $*\033[0m"; }
warn() { echo -e "\033[1;33m[!] $*\033[0m"; }
ok()   { echo -e "\033[1;32m[OK] $*\033[0m"; }

if [ "$(id -u)" -ne 0 ]; then
  warn "Jalankan dengan sudo: sudo bash install-vps.sh"
  exit 1
fi

# ---------------------------------------------------------------- 1
log "1/6 Update sistem & pasang dependensi dasar"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg git unzip build-essential python3 ufw rsync jq
ok "Paket dasar siap"

# ---------------------------------------------------------------- 2
log "2/6 Memasang Node.js 22 LTS"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt 20 ]; then
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -y
  apt-get install -y nodejs
fi
ok "Node.js $(node -v) / npm $(npm -v)"

# ---------------------------------------------------------------- 3
log "3/6 Memasang PM2"
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi
pm2 startup systemd -u "$APP_USER" --hp "/home/${APP_USER}" >/dev/null 2>&1 || true
ok "PM2 $(pm2 -v)"

log "3b/6 Memasang Caddy (reverse proxy + HTTPS otomatis)"
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi
ok "Caddy terpasang"

# ---------------------------------------------------------------- 4
log "4/6 Mengatur firewall (ufw)"
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
ufw --force enable >/dev/null
ok "Port terbuka: 22, 80, 443 (port 3000 sengaja ditutup)"

# ---------------------------------------------------------------- 5
log "5/6 Membuat user aplikasi & direktori"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$APP_USER"
fi
mkdir -p "$APP_DIR" /var/log/caddy /var/backups/bejo-pos
chown -R "$APP_USER":"$APP_USER" "$APP_DIR" /var/backups/bejo-pos
ok "User ${APP_USER} & direktori ${APP_DIR} siap"

# ---------------------------------------------------------------- 6
log "6/6 Menyiapkan konfigurasi Caddy"
if [ -f "$APP_DIR/deploy/Caddyfile" ]; then
  cp "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
  caddy fmt --overwrite /etc/caddy/Caddyfile || true
  systemctl reload caddy || systemctl restart caddy
  ok "Caddyfile aktif untuk ${DOMAIN} + ${WWW_DOMAIN}"
else
  warn "deploy/Caddyfile belum ada di ${APP_DIR} - salin manual setelah upload source."
fi

cat <<EOT

===================================================================
 INSTALL VPS SELESAI
===================================================================
 Node.js  : $(node -v)
 PM2      : $(pm2 -v)
 Caddy    : $(caddy version 2>/dev/null | head -1)
 App dir  : ${APP_DIR}
 Domain   : https://${DOMAIN}

 LANGKAH BERIKUTNYA:
 1. Upload source ke VPS lalu jalankan:
      bash ${APP_DIR}/deploy/deploy-vps.sh
 2. Pastikan DNS A record ${DOMAIN} -> IP VPS sudah diarahkan.
 3. Cek health:  curl -s http://127.0.0.1:3000/api/health
 4. Lihat log   :  pm2 logs bejo-pos --lines 50
===================================================================

EOT
