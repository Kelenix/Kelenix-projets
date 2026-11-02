# État du projet — PROJECT_STATE

> Mis à jour par Claude à la fin de chaque phase / incrément. Toujours lire ce fichier avant d'agir.

## Snapshot

- **Phase courante** : 6 — Mise en production (en attente des tâches manuelles)
- **Dernière mise à jour** : 2026-11-02
- **Santé** : 🟢 OK — V1 fonctionnelle en local, tous les tests verts
- **Prochaine action** : premier commit, puis mise en ligne (`docs/deployment.md`) quand les comptes GitHub / Supabase / Vercel sont prêts.

## Avancement par phase

| Phase | État | Notes |
|-------|------|-------|
| 0 — Cadrage & intake        | ✅ fait | `docs/PLAN.md`, lancement AUTONOME |
| 1 — Définition produit      | ✅ fait | Hypothèses H1–H11 du plan |
| 2 — Planification           | ✅ fait | Incréments Inc-0 à Inc-8 |
| 3 — Architecture & design   | ✅ fait | `docs/architecture.md`, ADR-001 à 008 |
| 4 — Implémentation          | ✅ fait | Toutes les exigences de l'INTAKE |
| 5 — Qualité                 | ✅ fait | Lint, types, 25 tests unitaires, 22 tests RLS, 8 tests e2e, build prod |
| 6 — Mise en production      | 🔄 en cours | Pipeline VPS prêt et testé en local ; attend clé SSH, DNS, `DOMAIN`/`VPS_HOST` (`docs/manual-tasks.md`) |
| 7 — Documentation           | ✅ fait | README, architecture, déploiement, tâches manuelles |
| 8 — Maintenance             | ⬜ à faire | |

## Backlog incréments

| ID | Incrément | Exigence liée | Priorité | État |
|----|-----------|---------------|----------|------|
| Inc-0 | Socle Next.js + Supabase local + RLS + CI | §8 | P0 | ✅ |
| Inc-1 | Connexion / déconnexion + shell dashboard | §1, §2, §3 | P0 | ✅ |
| Inc-2 | Clients | §6 | P0 | ✅ |
| Inc-3 | Projets | §4 | P0 | ✅ |
| Inc-4 | Tâches (Kanban, liste, détail) | §5 | P0 | ✅ |
| Inc-5 | Vue d'ensemble, Mes tâches, recherche, création contextuelle | §3, §5 | P0 | ✅ |
| Inc-6 | Équipe & paramètres, rôles, profil | §6 | P0 | ✅ |
| Inc-7 | Qualité : e2e parcours complet, a11y, revue | §7, §8 | P0 | ✅ |
| Inc-8 | Livraison : README, env, docs, déploiement | §8 | P1 | ✅ (déploiement réel : tâche manuelle) |

## Limites connues (V1)

- Pas de mise à jour en temps réel entre utilisateurs : les données d'un collègue apparaissent au rechargement des listes (retour sur l'onglet, actualisation, ou après 30 s lors d'une action).
- Pas de réinitialisation de mot de passe par e-mail (pas de SMTP) : un propriétaire peut retirer puis recréer un membre.
- Un seul « responsable » par tâche ; les autres personnes apparaissent comme intervenants via le chronomètre.
- Pas de réordonnancement des tâches à l'intérieur d'une colonne (tri par échéance puis priorité).
- Pas de suppression définitive de projet (archivage réversible seulement).

## Décisions ouvertes / questions à l'utilisateur

- (aucune — H1 et H2 appliquées)

## Blocages

- (aucun)

## Tâches manuelles utilisateur en attente

- voir `docs/manual-tasks.md`

## Journal de session

- 2026-11-02 — Audit de sécurité (historique non falsifiable, route admin bloquée, en-têtes, dépendances), pile Docker de production testée en local, CI/CD GitHub Actions vers VPS.
- 2026-11-02 — Jeu de démo complet (`seed-demo.sql`) et données de volume (120 projets, `seed-volume.sql`) ; listes paginées et affichées par paquets ; contenu pleine largeur.
- 2026-11-02 — Statut « Reprogrammé », colonnes colorées, nom « Kelenix Projets », chronomètre par intervenant (temps visible sur les cartes et dans les statistiques), membres affichés sur les cartes projet.
- 2026-11-02 — Évolutions demandées : logo, checklist cochable depuis les cartes, section Statistiques (graphiques dynamiques + stats par membre, migration `completed_at`).
- 2026-11-02 — Implémentation complète V1 ; parcours INTAKE §8 vérifié par Playwright (desktop + mobile) sur base réinitialisée.
- 2026-11-02 — Initialisation : lecture INTAKE, reformulation, plan de réalisation (`docs/PLAN.md`).
