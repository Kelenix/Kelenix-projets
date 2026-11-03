# Tâches manuelles

> Actions que seul le propriétaire du projet peut réaliser. Tout le reste est automatique
> (voir [deployment.md](deployment.md)).

## Développement local

- [x] Docker et Supabase CLI installés. Garder Docker Desktop démarré avant `pnpm db:start`.

## Mise en ligne (une seule fois)

- [x] Dépôt GitHub créé et code poussé ; secrets et variables enregistrés (`DOMAIN=kelenix.tech`, `VPS_HOST=69.62.116.243`).
- [ ] **Clé SSH de déploiement** : hPanel → VPS → *Impostazioni / Paramètres* → *Chiavi SSH / Clés SSH* → ajouter :

  ```
  ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBnX6JFj00uGbGXHtikWEFnexICcVgIFvSjvfbeTLQmp github-actions@kelenix-projets
  ```

- [ ] **DNS de kelenix.tech** : hPanel → Domaines → kelenix.tech → DNS, modifier l'enregistrement
  **A `@`** : contenu `69.62.116.243` (au lieu de `2.57.91.91`). Le `CNAME www` existant suit
  automatiquement. Le site actuellement servi sur kelenix.tech ne sera plus accessible.
- [ ] Relancer le pipeline (*Actions → CI / CD → Run workflow*) ou pousser un commit.
- [ ] Première connexion avec le compte propriétaire, puis changement du mot de passe dans « Mon profil ».
