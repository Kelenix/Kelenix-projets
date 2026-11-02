# Mise en ligne sur un VPS (Hostinger)

Tout est automatique : chaque `git push` sur `main` lance GitHub Actions, qui teste, construit
l'image, puis installe ou met à jour l'application sur le VPS. Aucune commande à taper sur le serveur.

## Ce qui tourne sur le VPS

`/opt/kelenix`, avec Docker Compose ([deploy/docker-compose.yml](../deploy/docker-compose.yml)) :

| Service | Rôle |
|---------|------|
| `db` | Postgres Supabase (données, règles RLS) |
| `auth` | Connexion (GoTrue) — inscription publique désactivée |
| `rest` | API des données (PostgREST), schéma non exposé |
| `app` | Application Next.js (utilisateur non root) |
| `gateway` | Caddy : HTTPS automatique (Let's Encrypt), administration des comptes bloquée en public |
| `backup` | Sauvegarde complète chaque nuit dans `/opt/kelenix/backups` (14 jours conservés) |

Pare-feu : seuls SSH (22), HTTP (80) et HTTPS (443) sont ouverts.

## Ce que fait le pipeline ([.github/workflows/ci.yml](../.github/workflows/ci.yml))

1. Lint, types, tests unitaires, audit des dépendances.
2. Tests de sécurité de la base (RLS) et parcours complets dans un navigateur.
3. Image Docker publiée sur `ghcr.io` (registre GitHub).
4. Sur le VPS : installation de Docker si besoin, pare-feu, écriture de la configuration à
   partir des secrets GitHub, migrations de base non encore appliquées, redémarrage sans
   perte de données, création du compte propriétaire au premier déploiement.
5. Vérification que `https://<domaine>/login` répond.

Le déploiement (étapes 3 à 5) est ignoré tant que les variables `DOMAIN` et `VPS_HOST` ne sont
pas renseignées : les tests tournent quand même.

## Configuration du dépôt GitHub (déjà faite)

| Type | Nom | Contenu |
|------|-----|---------|
| Secret | `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` | Générés par `scripts/generate-secrets.mjs` |
| Secret | `ADMIN_PASSWORD` | Mot de passe initial du propriétaire |
| Secret | `VPS_SSH_KEY` | Clé privée de déploiement (dédiée à GitHub Actions) |
| Variable | `ADMIN_EMAIL`, `ADMIN_NAME` | Compte propriétaire créé au premier déploiement |
| Variable | `DOMAIN` | Ex. `projets.kelenix.com` — **à renseigner** |
| Variable | `VPS_HOST` | Adresse IP du VPS — **à renseigner** |
| Variable | `VPS_USER` | Facultatif (défaut `root`) |

## Les seules actions humaines (une fois)

Elles ne peuvent pas être automatisées : elles donnent l'accès à votre serveur et à votre domaine.

1. **Clé SSH** : dans hPanel → VPS → *Paramètres* → *Clés SSH*, ajoutez la clé publique
   de déploiement (indiquée dans `docs/manual-tasks.md`).
2. **DNS** : un enregistrement de type **A** pour le domaine choisi, pointant vers l'IP du VPS.
3. **Variables** `DOMAIN` et `VPS_HOST` dans GitHub (*Settings → Secrets and variables →
   Actions → Variables*), ou communiquez-les pour qu'elles soient enregistrées.

Ensuite, relancez le dernier workflow (*Actions → CI / CD → Re-run*) ou poussez un commit.

## Exploitation

- **Mettre à jour** : `git push` sur `main`.
- **Journaux** : `ssh root@<IP> 'cd /opt/kelenix && docker compose logs -f app'`.
- **Restaurer une sauvegarde** :
  `docker compose exec -T db pg_restore -U supabase_admin -d postgres --clean < backups/kelenix-AAAA-MM-JJ.dump`.
- **Changer de domaine** : modifier la variable `DOMAIN` et relancer le workflow (certificat
  HTTPS obtenu automatiquement).
- Les données de démonstration et de volume ne sont **jamais** chargées en production.
