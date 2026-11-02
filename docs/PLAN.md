# Plan de réalisation — Kelenix

> Phase 0 (Cadrage). Rôle : AI Project Director. Date : 2026-11-02.
> Source : `INTAKE.md`. Statut : **en attente de validation**.

## 1. Compréhension du besoin

**Objectif** — Une application de gestion de projets pour un freelance (seul ou en petite
équipe) qui répond en un coup d'œil à : *où en est chaque projet, quoi faire ensuite, qui est
responsable, qu'est-ce qui est en retard ou bloqué.*

**Périmètre (V1)**
- **2 pages exactement** : `/login` et `/` (dashboard). Tout le reste = sections internes,
  onglets, modales, panneaux latéraux (état piloté côté client, pas de route supplémentaire).
- **Auth** e-mail + mot de passe, redirection, déconnexion, accès protégé (middleware + RLS).
- **Vue d'ensemble** : 3 compteurs (projets actifs, tâches en cours, tâches en retard),
  projets actifs + progression, mes prochaines tâches triées par échéance.
- **Projets** : CRUD + archivage ; statut Prévu / En cours / En pause / Terminé ; client,
  échéance, membres ; liste avec recherche + filtres statut/client ; espace de travail
  (résumé, membres, avancement « 8 tâches terminées sur 12 », tâches) ; clôture manuelle avec
  alerte sur les tâches ouvertes.
- **Tâches** : Kanban 3 colonnes (glisser-déposer + changement de statut dans le détail) et
  vue liste ; titre, description, responsable unique ou « À assigner », priorité, échéance,
  checklist, commentaires, liens ; drapeau « Bloquée » + explication ; retard calculé ;
  suppression confirmée ; panneau latéral de détail ; section « Mes tâches ».
- **Clients** : nom, entreprise, e-mail, notes, projets associés ; création/modif en modale.
- **Équipe & paramètres** (modale) : rôles Propriétaire / Collaborateur, gestion des membres
  et de leurs accès aux projets — **appliqués en base (RLS)**, pas seulement à l'affichage.
- **Recherche** globale (projets + tâches) et bouton « Créer » contextuel dans la barre haute.
- **Design** : fond clair, surfaces blanches, texte anthracite, accent bleu, FR, responsive
  (desktop / tablette / mobile), états vides/chargement/erreur, accessibilité clavier.

**Hors périmètre (V1)** — facturation, suivi du temps, portail client, automatisations,
notifications e-mail, inscription publique, site vitrine, pièces jointes (fichiers).

## 2. Trous du cahier des charges → hypothèses retenues

| # | Trou | Hypothèse (décision par défaut) |
|---|------|--------------------------------|
| H1 | Comment un compte est-il créé, sans page d'inscription ? | Le **1er propriétaire** est créé par un script de seed / la CLI. Le propriétaire **crée les collaborateurs** depuis la modale Équipe (e-mail + mot de passe provisoire), via une Server Action utilisant la clé service côté serveur uniquement. Pas d'e-mail envoyé (aucun service SMTP payant requis). → **Q1** |
| H2 | Une instance = un seul espace de travail ? | Oui : **un espace unique** (un propriétaire, ses collaborateurs). Pas de multi-tenant. → **Q2** |
| H3 | « Archiver » vs statut « Terminé » | Deux notions distinctes : *Terminé* = statut (clôture manuelle, alerte tâches ouvertes) ; *Archivé* = masqué des listes par défaut (filtre « Archivés »), réversible. |
| H4 | « Projets actifs » | Statut **En cours** (Prévu/En pause exclus), non archivés. |
| H5 | « Tâches en cours » (compteur) | Statut En cours, projets non archivés, visibles par l'utilisateur. |
| H6 | Un collaborateur peut-il créer / supprimer des tâches ? | Oui, sur les projets auxquels il a accès (« consulte et modifie les tâches »). Il ne gère ni projets, ni clients, ni membres. |
| H7 | Qui voit les clients ? | Propriétaire : CRUD. Collaborateur : lecture du nom du client des projets accessibles uniquement. |
| H8 | « En solo » | S'il n'y a qu'un membre sur le projet → la nouvelle tâche est assignée à l'utilisateur connecté ; sinon sélecteur parmi les membres du projet (défaut : utilisateur connecté). |
| H9 | Liens utiles | Liste de (libellé facultatif, URL validée http/https). |
| H10 | Données de démo | Seed **local uniquement**, fictives, clairement marquées, jamais appliquées en production. |
| H11 | Suppression de projet / client | Projet : archivage seulement (pas de suppression dure en V1). Client : suppression possible si confirmée ; les projets liés passent à « sans client ». |

## 3. Architecture cible (résumé)

- **Next.js 15 (App Router, TypeScript strict)** — 2 routes : `app/login/page.tsx`,
  `app/(dashboard)/page.tsx`. Navigation interne par état client (+ paramètre d'URL `?s=`
  pour conserver la section à l'actualisation, sans créer de page).
- **Supabase** : Postgres + Auth (+ `@supabase/ssr` pour les cookies). **RLS sur toutes les
  tables.** Développement local via **Supabase CLI + Docker** (déjà installés), migrations
  versionnées dans `supabase/migrations/`.
- **Écritures** : Server Actions validées par **Zod**, autorisation garantie par RLS
  (+ vérification de rôle côté serveur pour les actions sensibles). Lectures : TanStack Query
  côté client via le client Supabase (RLS filtre), mutations optimistes pour le Kanban.
- **UI** : Tailwind CSS + shadcn/ui (Radix → accessibilité clavier), icônes **lucide-react**,
  glisser-déposer **@dnd-kit** (support clavier + tactile).
- **Tests** : Vitest (règles métier : retard, progression, validation Zod) + tests SQL RLS ;
  Playwright pour le parcours complet demandé.
- **CI** : GitHub Actions (lint, typecheck, tests). **Déploiement** : Vercel + projet Supabase
  cloud (tâches manuelles documentées).

**Modèle de données** (détaillé en phase 3) : `profiles` (rôle owner/collaborator),
`clients`, `projects` (status, archived_at), `project_members`, `tasks` (status, priority,
assignee_id, due_date, is_blocked, blocked_reason, position), `task_checklist_items`,
`task_comments`, `task_links`. Fonctions SQL `is_owner()` / `is_project_member(project_id)`
utilisées par les politiques RLS.

## 4. Incréments verticaux (ordonnés)

| ID | Incrément | Critères d'acceptation clés |
|----|-----------|----------------------------|
| Inc-0 | Socle : Next.js, Tailwind/shadcn, Supabase local, migrations + RLS, CI | `pnpm dev` démarre ; lint/types/tests verts ; tests RLS passent |
| Inc-1 | Connexion / déconnexion + shell du dashboard (sidebar, topbar, sections vides, responsive) | Accès sans session → `/login` ; erreurs claires ; afficher/masquer mot de passe |
| Inc-2 | Clients (liste + modale CRUD + projets associés) | Persistance ; validation ; owner seul en écriture |
| Inc-3 | Projets (liste, recherche, filtres, modale, membres, archivage, clôture) | Collaborateur ne voit que ses projets (RLS) ; alerte tâches ouvertes |
| Inc-4 | Tâches : espace projet, Kanban + liste, panneau détail (checklist, commentaires, liens, bloquée), suppression confirmée | Glisser-déposer + clavier ; statut modifiable dans le détail ; progression à jour |
| Inc-5 | Vue d'ensemble, Mes tâches, recherche globale, bouton « Créer » contextuel | Compteurs et listes mis à jour sans actualisation |
| Inc-6 | Équipe & paramètres (création collaborateur, rôles, accès projets), profil | Permissions effectives en base |
| Inc-7 | Qualité : e2e Playwright du parcours complet, a11y, perf, revue de code | Parcours INTAKE §8 vert |
| Inc-8 | Livraison : README, `.env.example`, `docs/manual-tasks.md`, guide déploiement Vercel/Supabase | L'app démarre avec la commande documentée |

## 5. Séquence des phases et rôles

Phase 0 Cadrage (Director) → 1 Produit (Product Owner) → 2 Plan (Project Manager) →
3 Archi/Design (Solution Architect, System Design, Database Architect, UI/UX) →
4 Implémentation Inc-0…6 (Backend ⇄ Frontend, Security en continu) →
5 Qualité (QA + Code Reviewer, en continu + Inc-7) → 6 Prod (DevOps + Release) →
7 Documentation → 8 Maintenance (passation).

## 6. Risques & parades

| Risque | Parade |
|--------|--------|
| Permissions contournables côté client | RLS sur toutes les tables + tests SQL dédiés par rôle |
| Clé service Supabase exposée | Utilisée uniquement dans une Server Action (`server-only`), jamais préfixée `NEXT_PUBLIC_` |
| Glisser-déposer inutilisable au clavier / mobile | @dnd-kit (capteurs clavier + tactile) + changement de statut dans le panneau |
| « 2 pages seulement » vs liens partageables | État de section dans l'URL (query), pas de nouvelle route |
| Dates et fuseaux (retard) | Échéance stockée en `date` ; retard = `due_date < aujourd'hui` (fuseau local) et statut ≠ Terminé |

## 7. Tâches manuelles utilisateur prévues

- Aucune pour développer et tester **en local** (Docker + Supabase CLI déjà présents).
- Pour la mise en ligne : créer un projet Supabase (offre gratuite), un projet Vercel, un
  dépôt GitHub, renseigner les variables d'environnement. Détail dans `docs/manual-tasks.md`.

## 8. Questions ouvertes

Voir le message de présentation du plan (Q1–Q2). Sans réponse, les hypothèses H1 et H2
s'appliquent.
