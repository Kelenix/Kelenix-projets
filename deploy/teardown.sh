#!/usr/bin/env bash
# Supprime entièrement la préproduction temporaire (conteneurs, base, configuration).
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env.preprod ] || exit 0
docker compose -p kelenix-preprod --env-file .env.preprod down -v --remove-orphans
rm -f .env.preprod
echo "Préproduction supprimée."
