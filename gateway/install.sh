#!/usr/bin/env bash
# Установка шлюза GigaChat на VPS (Ubuntu/Debian). Запуск:
#   sudo DOMAIN=giga.example.ru GIGACHAT_CREDENTIALS='<ключ авторизации>' bash install.sh
# DOMAIN должен указывать A-записью на IP этого VPS (нужен для HTTPS).
set -euo pipefail
: "${DOMAIN:?Укажите DOMAIN}"; : "${GIGACHAT_CREDENTIALS:?Укажите GIGACHAT_CREDENTIALS}"
APP=/opt/gigachat-gateway
apt-get update -y && apt-get install -y curl ca-certificates debian-keyring debian-archive-keyring apt-transport-https gnupg
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs
fi
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi
mkdir -p $APP
REPO=https://raw.githubusercontent.com/slavik4252/projectforwork3/main/gateway
curl -fsSL $REPO/server.mjs -o $APP/server.mjs
curl -fsSL $REPO/review-policy.mjs -o $APP/review-policy.mjs
curl -fsSL https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt -o $APP/russian_trusted_root_ca.pem
TOKEN=$( [ -f $APP/.env ] && grep -oP '^GIGACHAT_GATEWAY_TOKEN=\K.*' $APP/.env || openssl rand -hex 32 )
cat > $APP/.env <<ENV
GIGACHAT_CREDENTIALS=${GIGACHAT_CREDENTIALS}
GIGACHAT_GATEWAY_TOKEN=${TOKEN}
GIGACHAT_CA_PATH=$APP/russian_trusted_root_ca.pem
GIGACHAT_SCOPE=${GIGACHAT_SCOPE:-GIGACHAT_API_PERS}
PORT=3000
ENV
chmod 600 $APP/.env
cat > /etc/systemd/system/gigachat-gateway.service <<UNIT
[Unit]
Description=GigaChat gateway
After=network-online.target
[Service]
EnvironmentFile=$APP/.env
ExecStart=$(command -v node) $APP/server.mjs
Restart=always
User=nobody
[Install]
WantedBy=multi-user.target
UNIT
grep -q "$DOMAIN" /etc/caddy/Caddyfile 2>/dev/null || printf '\n%s {\n  reverse_proxy 127.0.0.1:3000\n}\n' "$DOMAIN" >> /etc/caddy/Caddyfile
systemctl daemon-reload && systemctl enable --now gigachat-gateway && systemctl restart gigachat-gateway && systemctl reload caddy || systemctl restart caddy
sleep 3; curl -fsS "https://$DOMAIN/health" && echo
echo "Готово. Добавьте в Cloudflare (Workers → projectforwork3 → Settings → Variables and Secrets):"
echo "  GIGACHAT_GATEWAY_URL=https://$DOMAIN"
echo "  GIGACHAT_GATEWAY_TOKEN=$TOKEN   (тип Secret)"
