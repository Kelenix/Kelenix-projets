# Mise en ligne sur le VPS Hostinger (kelenix.tech)

Chaque `git push` sur `main` lance le pipeline GitHub Actions
([.github/workflows/ci.yml](../.github/workflows/ci.yml)), en 8 étapes :

| # | Étape | Ce qui se passe |
|---|-------|-----------------|
| 1 | Déclenchement | Push sur `main` (déploiement), pull request (vérification seule) ou lancement manuel |
| 2 | Préparation | Code récupéré, dépendances installées et mises en cache, accès SSH et DNS vérifiés |
| 3 | Vérification du code | Lint, types, tests unitaires, audit des dépendances ; en parallèle, tests de sécurité de la base (RLS) et parcours complets dans un navigateur |
| 4 | Build | **Une seule** image Docker, sans configuration d'environnement, publiée sur `ghcr.io` |
| 5 | Conservation | Image étiquetée par commit + paquet de déploiement (scripts, migrations) conservé 30 jours |
| 6 | Préproduction et tests | Copie complète et temporaire sur le VPS (base vierge, migrations, compte jetable), tests de fumée dans un navigateur via un tunnel SSH, puis suppression |
| 7 | Production | La même image, validée en préproduction, est déployée ; migrations ; HTTPS via nginx |
| 8 | Vérification | HTTPS valide, redirection HTTP, en-têtes de sécurité, administration bloquée, inscription fermée |

Si la clé SSH n'est pas installée, les étapes 4 à 8 sont ignorées (avertissement, pas d'échec).
Si `kelenix.tech` ne pointe pas encore vers le VPS, la préproduction est testée mais la
production attend.

## Sur le VPS : cohabitation avec l'existant

Le serveur héberge déjà d'autres services (nginx, ports 3000, 3001, 3002…). Le déploiement :

- n'ouvre **aucun port public** : la passerelle Kelenix écoute sur `127.0.0.1:18080`
  (production) et `127.0.0.1:18081` (préproduction temporaire) ; il s'arrête si l'un de ces
  ports est déjà pris par un autre service ;
- ajoute **un seul fichier nginx** (`/etc/nginx/sites-available/kelenix-projets.conf`) ; refuse
  de continuer si un autre site déclare déjà `kelenix.tech` ; si `nginx -t` refuse la nouvelle
  configuration, l'ancienne est restaurée et nginx n'est pas rechargé ;
- obtient le certificat HTTPS avec certbot (mode webroot, renouvellement automatique) ;
- ne modifie **ni le pare-feu**, ni les autres conteneurs (projets Docker `kelenix-prod` et
  `kelenix-preprod` uniquement) ;
- n'efface que les anciennes images de l'application.

Fichiers dans `/opt/kelenix` : `docker-compose.yml`, `Caddyfile`, scripts, migrations,
`.env.prod` (secrets, droits 600), `backups/` (sauvegarde chaque nuit, 14 jours).

## Configuration GitHub

| Type | Nom | Valeur |
|------|-----|--------|
| Variable | `DOMAIN` | `kelenix.tech` |
| Variable | `VPS_HOST` / `VPS_USER` | `69.62.116.243` / `root` |
| Variable | `ADMIN_EMAIL`, `ADMIN_NAME` | Compte propriétaire créé au premier déploiement |
| Secret | `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` | Générés automatiquement |
| Secret | `VPS_SSH_KEY` | Clé privée de déploiement (dédiée à GitHub Actions) |

## Exploitation

- **Mettre à jour** : `git push` sur `main`.
- **Inspecter le serveur** (lecture seule) : *Actions → Inspection du VPS → Run workflow*.
- **Journaux** : `ssh root@69.62.116.243 'cd /opt/kelenix && docker compose -p kelenix-prod --env-file .env.prod logs -f app'`.
- **Restaurer une sauvegarde** : `docker compose -p kelenix-prod --env-file .env.prod exec -T db pg_restore -U supabase_admin -d postgres --clean < backups/kelenix-AAAA-MM-JJ.dump`.
- Les données de démonstration et de volume ne sont **jamais** chargées en production.
