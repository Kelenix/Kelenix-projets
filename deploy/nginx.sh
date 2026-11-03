#!/usr/bin/env bash
# Publie la production en HTTPS via le nginx déjà présent sur le serveur.
# Ajoute un seul fichier de site (kelenix-projets.conf) ; les autres sites ne sont jamais modifiés.
# Toute configuration refusée par « nginx -t » est annulée et l'ancienne est restaurée.
set -euo pipefail
cd "$(dirname "$0")"
: "${DOMAIN:?}" "${GATEWAY_PORT:?}" "${SERVER_IP:?}" "${ADMIN_EMAIL:?}"

SITE=/etc/nginx/sites-available/kelenix-projets.conf
LINK=/etc/nginx/sites-enabled/kelenix-projets.conf
WEBROOT=/var/www/kelenix-acme
CERT=/etc/letsencrypt/live/$DOMAIN/fullchain.pem

if ! command -v nginx >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq nginx
fi

# Ne jamais prendre un domaine déjà déclaré par un autre site du serveur.
pattern="server_name[^;]*[[:space:]](www\.)?${DOMAIN//./\\.}[[:space:];]"
if conflict=$(grep -rlsE "$pattern" /etc/nginx/sites-enabled /etc/nginx/conf.d | grep -v "kelenix-projets.conf"); then
  echo "::error::$DOMAIN est déjà déclaré dans : $conflict. Rien n'a été modifié."
  exit 1
fi

# Noms servis : le domaine, et www s'il pointe aussi vers ce serveur.
resolves_here() { [ "$(getent ahostsv4 "$1" | awk 'NR==1 {print $1}')" = "$SERVER_IP" ]; }
names=$DOMAIN
resolves_here "www.$DOMAIN" && names="$DOMAIN www.$DOMAIN"
ipv6=$([ -f /proc/net/if_inet6 ] && echo yes || true)
# « http2 on; » n'existe qu'à partir de nginx 1.25.1 (Ubuntu 24.04 fournit 1.24).
version=$(nginx -v 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
modern=$([ "$(printf '%s\n%s\n' "$version" 1.25.1 | sort -V | head -n1)" = 1.25.1 ] && echo yes || true)

listen() { echo "    listen $1;"; [ -n "$ipv6" ] && echo "    listen [::]:$1;"; true; }

proxy_block() {
  cat <<EOF
    client_max_body_size 10m;
    location / {
        proxy_pass http://127.0.0.1:$GATEWAY_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$kelenix_connection_upgrade;
        proxy_read_timeout 60s;
    }
EOF
}

render() {
  echo "# Géré automatiquement par le déploiement Kelenix Projets (GitHub Actions). Ne pas modifier."
  echo "map \$http_upgrade \$kelenix_connection_upgrade { default upgrade; '' close; }"
  echo "server {"
  listen 80
  echo "    server_name $names;"
  echo "    location ^~ /.well-known/acme-challenge/ { root $WEBROOT; }"
  if [ "$1" = https ]; then
    echo "    location / { return 301 https://\$host\$request_uri; }"
    echo "}"
    echo "server {"
    if [ -n "$modern" ]; then listen "443 ssl"; echo "    http2 on;"; else listen "443 ssl http2"; fi
    echo "    server_name $names;"
    echo "    ssl_certificate $CERT;"
    echo "    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;"
    echo "    ssl_protocols TLSv1.2 TLSv1.3;"
  fi
  proxy_block
  echo "}"
}

apply() {
  local previous
  previous=$(mktemp)
  [ -f "$SITE" ] && cp "$SITE" "$previous" || : > "$previous"
  render "$1" > "$SITE"
  ln -sf "$SITE" "$LINK"
  if ! nginx -t >/dev/null 2>&1; then
    nginx -t || true
    if [ -s "$previous" ]; then cp "$previous" "$SITE"; else rm -f "$SITE" "$LINK"; fi
    echo "::error::Configuration nginx refusée : l'ancienne configuration a été restaurée."
    exit 1
  fi
  systemctl reload nginx
}

mkdir -p "$WEBROOT"
if [ ! -f "$CERT" ]; then
  apply http
  if ! resolves_here "$DOMAIN"; then
    echo "::warning::$DOMAIN ne pointe pas encore vers $SERVER_IP : site publié en HTTP seulement. Le certificat HTTPS sera obtenu au prochain déploiement."
    exit 0
  fi
  command -v certbot >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq certbot; }
  domains=()
  for n in $names; do domains+=(-d "$n"); done
  certbot certonly --webroot -w "$WEBROOT" "${domains[@]}" --cert-name "$DOMAIN" \
    --non-interactive --agree-tos -m "$ADMIN_EMAIL" --keep-until-expiring \
    --deploy-hook "systemctl reload nginx"
fi
apply https
echo "Publié : https://$DOMAIN"
