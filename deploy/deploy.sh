#!/usr/bin/env bash
# Déploiement idempotent sur le VPS, lancé par GitHub Actions après chaque push sur main.
# Prérequis : deploy/.env (écrit par le workflow) et l'image de l'application publiée.
set -euo pipefail
cd "$(dirname "$0")"

# Accès au registre d'images : identifiant puis jeton reçus sur l'entrée standard (lus d'abord).
GHCR_USER="" GHCR_TOKEN=""
if [ ! -t 0 ]; then
  read -r GHCR_USER || true
  read -r GHCR_TOKEN || true
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Installation de Docker…"
  curl -fsSL https://get.docker.com | sh
fi

# Pare-feu : seuls SSH et le web sont ouverts.
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 443/udp >/dev/null
  ufw --force enable >/dev/null
fi

set -a
. ./.env
set +a

if [ -n "$GHCR_TOKEN" ]; then
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
  trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
fi
compose() { docker compose --env-file .env "$@"; }
mkdir -p backups

compose pull --quiet
# La base et l'authentification d'abord : les migrations dépendent du schéma « auth ».
compose up -d --wait db auth
./migrate.sh
compose up -d --wait --remove-orphans
compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  psql -h localhost -U postgres -d postgres -qc "notify pgrst, 'reload schema'"

# Compte propriétaire initial (ignoré s'il existe déjà un propriétaire).
compose exec -T -e KELENIX_OWNER_PASSWORD="$ADMIN_PASSWORD" app \
  node scripts/create-owner.mjs --if-missing "$ADMIN_EMAIL" "$ADMIN_NAME"

docker image prune -f >/dev/null
echo "Déploiement terminé : $PUBLIC_URL"
