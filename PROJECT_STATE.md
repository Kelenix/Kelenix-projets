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
| 6 — Mise en production      | 🔄 en cours | Pipeline 8 étapes prêt (préprod + prod testées en local) ; attend clé SSH dans hPanel et DNS A `@` → 69.62.116.243 |
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

- Synchronisation entre utilisateurs en 4 s au plus (pas de temps réel instantané, ADR-022).
- Pas de réinitialisation de mot de passe par e-mail (pas de SMTP) : un propriétaire peut retirer puis recréer un membre.
- Le temps de travail d'un projet est visible de tous ses membres ; seules les pauses et les rapports d'équipe sont restreints (ADR-018).
- Pas de réordonnancement des tâches à l'intérieur d'une colonne (tri par échéance puis priorité).
- Pas de suppression définitive de projet (archivage réversible seulement).

## Décisions ouvertes / questions à l'utilisateur

- (aucune — H1 et H2 appliquées)

## Blocages

- (aucun)

## Tâches manuelles utilisateur en attente

- voir `docs/manual-tasks.md`

## Journal de session

- 2026-11-05 — Calendrier des tâches, tags, absences et jours fériés, sessions oubliées, validation et facturation des heures, journal d'audit.
- 2026-11-04 — Pause en cours et son motif visibles de tous les membres du projet (historique des pauses toujours restreint).
- 2026-11-04 — Synchronisation entre navigateurs (4 s, sans actualiser) ; chronomètre des cartes : compteur du jour remis à zéro à minuit.
- 2026-11-04 — Espace financier personnel (administrateurs) : revenus variables, répartition personnalisable et historisée, dépenses ponctuelles et récurrentes, fonds d'urgence, investissements, reports, objectifs, alertes, prévisions, historique 12 mois avec exports, 7 graphiques ; mode sombre pour tout le site.
- 2026-11-04 — Rapports : heures (quotidien / hebdomadaire / mensuel), par projet, tâche, collaborateur, pauses par motif, estimé vs réel ; filtres période / collaborateur / projet / tâche / statut ; exports Excel, CSV et PDF.
- 2026-11-04 — Suivi des projets : budget d'heures avec alerte (80 % / dépassement), compteurs par statut de projet, tâches terminées / en cours / en retard par projet, jalons, charge de travail et tâches en dépassement dans les statistiques.
- 2026-11-03 — Cartes : actions directes sans ouvrir la tâche (statut, priorité, échéance, affectés, checklist, blocage, suppression), aussi en vue liste.
- 2026-11-03 — Collaborateurs : rôles administrateur / chef de projet (par projet) / collaborateur, plusieurs collaborateurs par tâche avec temps estimé, estimé vs réel, équipe en ce moment, accès aux rapports, pauses visibles selon le rôle.
- 2026-11-03 — Pauses : motif, nombre de pauses, pauses par jour, historique filtré, détection des pauses anormalement longues.
- 2026-11-03 — Temps : vues jour/semaine/mois/année, totaux tâche et projet, historique des sessions, heures oubliées, corrections justifiées et tracées, description du travail.
- 2026-11-03 — Feuille de temps quotidienne (projet, tâche, équipe) et pauses mesurées (Pause / Reprendre / Terminer) ; site en ligne sur https://kelenix.tech.
- 2026-11-03 — Pipeline en 8 étapes (préproduction temporaire testée puis production), image unique, publication via le nginx existant du VPS sans toucher aux autres services ; domaine kelenix.tech.
- 2026-11-02 — Audit de sécurité (historique non falsifiable, route admin bloquée, en-têtes, dépendances), pile Docker de production testée en local, CI/CD GitHub Actions vers VPS.
- 2026-11-02 — Jeu de démo complet (`seed-demo.sql`) et données de volume (120 projets, `seed-volume.sql`) ; listes paginées et affichées par paquets ; contenu pleine largeur.
- 2026-11-02 — Statut « Reprogrammé », colonnes colorées, nom « Kelenix Projets », chronomètre par intervenant (temps visible sur les cartes et dans les statistiques), membres affichés sur les cartes projet.
- 2026-11-02 — Évolutions demandées : logo, checklist cochable depuis les cartes, section Statistiques (graphiques dynamiques + stats par membre, migration `completed_at`).
- 2026-11-02 — Implémentation complète V1 ; parcours INTAKE §8 vérifié par Playwright (desktop + mobile) sur base réinitialisée.
- 2026-11-02 — Initialisation : lecture INTAKE, reformulation, plan de réalisation (`docs/PLAN.md`).
