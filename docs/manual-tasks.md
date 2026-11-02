# Tâches manuelles

> Actions que seul le propriétaire du projet peut réaliser. Tout le reste est automatique
> (voir [deployment.md](deployment.md)).

## Développement local

- [x] Docker et Supabase CLI installés. Garder Docker Desktop démarré avant `pnpm db:start`.

## Mise en ligne (une seule fois)

- [x] Dépôt GitHub créé et code poussé ; secrets et variables enregistrés.
- [ ] **Clé SSH de déploiement** à ajouter dans hPanel → VPS → Paramètres → Clés SSH :

  ```
  ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBnX6JFj00uGbGXHtikWEFnexICcVgIFvSjvfbeTLQmp github-actions@kelenix-projets
  ```

- [ ] **Enregistrement DNS** de type A : votre domaine → IP du VPS.
- [ ] **Variables GitHub** `DOMAIN` et `VPS_HOST` (ou les communiquer pour qu'elles soient enregistrées).
- [ ] Première connexion avec le compte propriétaire, puis changement du mot de passe dans « Mon profil ».
