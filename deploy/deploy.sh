#!/usr/bin/env bash
# Déploie un environnement Kelenix (preprod | prod) sur le VPS. Idempotent et prudent :
# ne modifie ni les autres conteneurs, ni les autres sites nginx, ni le pare-feu.
# Lancé par GitHub Actions ; l'entrée standard fournit l'identifiant puis le jeton du registre d'images.
set -euo pipefail
cd "$(dirname "$0")"

ENV_NAME=${1:-}
case "$ENV_NAME" in
  preprod | prod) ;;
  *) echo "Usage : deploy.sh preprod|prod" >&2; exit 2 ;;
esac
export PROJECT="kelenix-$ENV_NAME" ENV_FILE=".env.$ENV_NAME"

GHCR_USER="" GHCR_TOKEN=""
if [ ! -t 0 ]; then
  read -r GHCR_USER || true
  read -r GHCR_TOKEN || true
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Installation de Docker…"
  curl -fsSL https://get.docker.com | sh
fi

set -a
. "./$ENV_FILE"
set +a
compose() { docker compose -p "$PROJECT" --env-file "$ENV_FILE" "$@"; }

# Port de la passerelle : libre, ou déjà tenu par ce même environnement. Jamais pris à un autre service.
holder=$(docker ps --filter "publish=$GATEWAY_PORT" --format '{{.Label "com.docker.compose.project"}}' | head -n1)
if ss -ltnH "( sport = :$GATEWAY_PORT )" | grep -q . && [ "$holder" != "$PROJECT" ]; then
  echo "::error::Le port $GATEWAY_PORT est déjà utilisé par un autre service du serveur : déploiement annulé, rien n'a été modifié."
  exit 1
fi

if [ -n "$GHCR_TOKEN" ]; then
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
  trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
fi

mkdir -p backups
compose pull --quiet
# La base et l'authentification d'abord : les migrations dépendent du schéma « auth ».
compose up -d --wait db auth
./migrate.sh
compose up -d --wait --remove-orphans
compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  psql -h localhost -U postgres -d postgres -qc "notify pgrst, 'reload schema'"

if [ "$ENV_NAME" = prod ]; then
  # Compte propriétaire initial (ignoré s'il existe déjà un propriétaire), puis publication HTTPS.
  compose exec -T -e KELENIX_OWNER_PASSWORD="$ADMIN_PASSWORD" app \
    node scripts/create-owner.mjs --if-missing "$ADMIN_EMAIL" "$ADMIN_NAME"
  ./nginx.sh
else
  # Compte jetable pour les tests de préproduction.
  compose exec -T -e KELENIX_OWNER_PASSWORD="$SMOKE_PASSWORD" app \
    node scripts/create-owner.mjs "$SMOKE_EMAIL" "Test préproduction"
fi

# Nettoyage limité aux anciennes images de l'application.
docker image prune -af --filter "label=app=kelenix-projets" --filter "until=168h" >/dev/null
echo "Environnement $ENV_NAME prêt (passerelle 127.0.0.1:$GATEWAY_PORT)."
