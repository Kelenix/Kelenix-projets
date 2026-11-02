# Journal de décisions (DECISION_LOG)

> ADR léger. Chaque décision structurante prise en autonomie : contexte → décision →
> alternatives écartées → conséquences. Le plus récent en haut.

---

## ADR-013 — Hébergement sur VPS : Supabase auto-hébergé, déploiement continu

- **Date** : 2026-11-02
- **Statut** : Accepté (choix de l'utilisateur : tout sur le VPS Hostinger, aucune tâche manuelle après le push)
- **Décideur** : Claude (rôles : devops-engineer, security-engineer)
- **Contexte** : Le skill prévoyait Vercel + Supabase Cloud ; l'utilisateur veut un VPS Hostinger et un déploiement entièrement automatique.
- **Décision** : Docker Compose sur le VPS avec les mêmes versions que la pile locale (Postgres, GoTrue, PostgREST) + application Next.js en image autonome + Caddy (HTTPS automatique, routes `/auth/v1/admin*` bloquées en public, passerelle interne pour le serveur) + sauvegarde quotidienne. GitHub Actions : tests → image sur GHCR → déploiement SSH idempotent (installation de Docker, pare-feu, `.env` depuis les secrets, migrations suivies dans `supabase_migrations.schema_migrations`, compte propriétaire initial). Secrets générés automatiquement et stockés uniquement dans GitHub et sur le serveur (`.env` en 600).
- **Alternatives écartées** : Supabase Cloud (compte et jeton à créer à la main) ; Kong comme passerelle (inutile ici, Caddy suffit).
- **Conséquences** : Restent manuels, une fois : clé SSH dans hPanel, DNS, valeurs `DOMAIN`/`VPS_HOST`. Pile testée de bout en bout en local avant mise en ligne.
- **Impact** : technique / sécurité / financier (aucun coût en plus du VPS)

## ADR-012 — Listes longues : chargement complet paginé, affichage par paquets

- **Date** : 2026-11-02
- **Statut** : Accepté
- **Décideur** : Claude (rôles : performance-engineer, frontend-engineer)
- **Contexte** : Avec 120 projets de test (~800 tâches), l'API limite chaque requête à 1000 lignes (`max_rows`) et les listes rendaient des pages de 6 000 à 18 000 px.
- **Décision** : Projets, tâches et clients sont chargés page par page jusqu'au bout (aucune troncature silencieuse). Affichage par paquets avec « Afficher plus » (24 projets / clients, 50 tâches en liste, 25 cartes par colonne), colonnes Kanban de hauteur bornée à défilement interne, vue d'ensemble limitée aux 6 projets actifs les plus urgents.
- **Alternatives écartées** : Pagination côté serveur — les compteurs, statistiques et la recherche globale s'appuient sur la liste complète en cache ; à reconsidérer au-delà de quelques milliers de tâches.
- **Impact** : performance / UX

## ADR-011 — Temps passé par intervenant (chronomètre)

- **Date** : 2026-11-02
- **Statut** : Accepté (demande de l'utilisateur ; l'INTAKE réservait le suivi du temps à une version future)
- **Décideur** : Claude (rôles : product-owner, database-architect)
- **Contexte** : Plusieurs personnes travaillent sur un même projet ; il faut voir, sans ouvrir la carte, qui intervient sur une tâche et combien de temps chacun y passe, pauses comprises.
- **Décision** : Table `time_entries` (une session = début / fin). Chaque membre du projet démarre ou met en pause son chronomètre depuis la carte ; un seul chronomètre en cours par personne (index unique, `start_timer` met en pause le précédent). La carte affiche chaque intervenant avec son temps cumulé (en direct s'il tourne). Le « responsable » unique de la tâche est conservé ; les intervenants sont ceux qui ont chronométré. RLS : lecture par les membres du projet, écriture uniquement de ses propres sessions.
- **Alternatives écartées** : Plusieurs responsables par tâche — change la règle « responsable unique » de l'INTAKE et toutes les vues ; proposé comme évolution si besoin.
- **Conséquences** : Statistiques « Temps passé » par membre et sur la période.
- **Impact** : fonctionnel / données

## ADR-010 — Statut « Reprogrammé », colonnes colorées, nom « Kelenix Projets »

- **Date** : 2026-11-02
- **Statut** : Accepté (demandes de l'utilisateur)
- **Décideur** : Claude (rôles : product-owner, ui-ux-designer)
- **Décision** : Valeur `rescheduled` ajoutée à `task_status` (4e colonne du Kanban, tâche toujours ouverte, peut être en retard). Chaque colonne porte la couleur de son statut, identique aux statistiques (palette validée à 4 couleurs). Nom affiché centralisé dans `src/lib/brand.ts` (« Kelenix Projets »).
- **Impact** : fonctionnel (faible)

## ADR-009 — Section « Statistiques » et graphiques faits main

- **Date** : 2026-11-02
- **Statut** : Accepté (demande de l'utilisateur : « diagrammes dynamiques » et statistiques par utilisateur)
- **Décideur** : Claude (rôles : product-owner, frontend-engineer)
- **Contexte** : L'INTAKE demandait une vue d'ensemble sans surcharge de statistiques ; l'utilisateur demande ensuite des graphiques et des statistiques par membre.
- **Décision** : Nouvelle section « Statistiques » dans le dashboard (pas de nouvelle page), la vue d'ensemble reste légère. Graphiques en HTML/CSS (histogramme hebdomadaire, barres empilées par statut, tableau par membre) calculés en direct depuis le cache des tâches, filtrables par projet et période. Colonne `tasks.completed_at` posée par trigger pour situer les tâches terminées dans le temps. Palette catégorielle validée (contraste du vert compensé par chiffres et légende).
- **Alternatives écartées** : Bibliothèque de graphiques (Recharts…) — dépendance lourde pour trois graphiques simples.
- **Conséquences** : Les tâches terminées avant cette migration ont pour date de fin leur dernière modification.
- **Impact** : fonctionnel

## ADR-008 — Comptes créés par le propriétaire, sans inscription publique

- **Date** : 2026-11-02
- **Statut** : Accepté (hypothèse H1 validée par le lancement en mode AUTONOME)
- **Décideur** : Claude (rôle : security-engineer)
- **Contexte** : Deux pages seulement, pas de page d'inscription ; besoin d'ajouter des collaborateurs.
- **Décision** : Inscription publique désactivée (`[auth] enable_signup = false`). Premier propriétaire via `pnpm create-owner` ; les suivants via une Server Action (clé service, rôle propriétaire vérifié) avec mot de passe provisoire. Le rôle est porté par `app_metadata`, non modifiable par l'utilisateur.
- **Alternatives écartées** : Invitations par e-mail — nécessitent un SMTP (coût, configuration).
- **Conséquences** : Le propriétaire transmet le mot de passe provisoire ; chacun le change dans « Mon profil ».
- **Impact** : sécurité / fonctionnel

## ADR-007 — Données lues et écrites depuis le client, autorisation en base

- **Date** : 2026-11-02
- **Statut** : Accepté
- **Décideur** : Claude (rôle : solution-architect)
- **Contexte** : Dashboard très interactif sur une seule page (Kanban, panneaux, compteurs à jour).
- **Décision** : Client Supabase + TanStack Query côté navigateur ; autorisation par RLS, validation par contraintes `check` et triggers Postgres (serveur), Zod pour l'UX. Server Actions réservées aux opérations nécessitant la clé service.
- **Alternatives écartées** : Server Actions pour chaque écriture — duplique la RLS, plus de code, moins réactif.
- **Conséquences** : Toute nouvelle table doit avoir RLS + tests pgTAP.
- **Impact** : technique / sécurité

## ADR-006 — `cacheComponents` désactivé

- **Date** : 2026-11-02
- **Statut** : Accepté
- **Décideur** : Claude (rôle : solution-architect)
- **Contexte** : Le gabarit Next.js 16 active `cacheComponents` / `partialPrefetching`. Les deux pages dépendent de la session (cookies) et n'ont aucun contenu statique à mettre en cache.
- **Décision** : Options retirées de `next.config.ts` ; rendu dynamique classique.
- **Alternatives écartées** : Conserver Cache Components — impose Suspense et directives `use cache` sans gain ici.
- **Conséquences** : Configuration plus simple ; réactivable si des contenus partagés apparaissent.
- **Impact** : technique (faible)

## ADR-005 — Navigation interne reflétée dans l'URL

- **Date** : 2026-11-02
- **Statut** : Accepté
- **Décideur** : Claude (rôle : frontend-engineer)
- **Contexte** : Deux pages seulement, mais une actualisation ne doit pas perdre la section ni le projet ouvert.
- **Décision** : Section, projet et tâche ouverts dans les paramètres `?s=&p=&t=` via `history.pushState` (bouton Retour fonctionnel), sans nouvelle route.
- **Alternatives écartées** : Routes `/projects/[id]` — interdites par le cahier des charges.
- **Impact** : fonctionnel (faible)

## ADR-004 — Listes déroulantes natives, ports Supabase 553xx

- **Date** : 2026-11-02
- **Statut** : Accepté
- **Décideur** : Claude (rôles : ui-ux-designer, devops-engineer)
- **Contexte** : Sélecteurs nombreux (statut, priorité, responsable) utilisés sur mobile ; un autre projet Supabase local occupe les ports 543xx sur le poste.
- **Décision** : `<select>` natif stylé (accessible, ergonomique sur mobile) à la place du Select Radix. Ports Supabase locaux décalés en 553xx.
- **Conséquences** : Moins de code ; aucun conflit avec les autres projets locaux.
- **Impact** : technique (faible)

## ADR-003 — Archivage distinct du statut « Terminé »

- **Date** : 2026-11-02
- **Statut** : Accepté
- **Décideur** : Claude (rôle : product-owner)
- **Contexte** : L'INTAKE demande « archiver » un projet et un statut « Terminé » avec clôture manuelle.
- **Décision** : `status` (Prévu/En cours/En pause/Terminé) et `archived_at` sont indépendants. Archiver masque le projet des listes et compteurs, de façon réversible. Pas de suppression dure de projet en V1.
- **Alternatives écartées** : Archivage = statut Terminé — rejeté, mélange avancement et visibilité.
- **Conséquences** : Un filtre « Archivés » dans la liste des projets.
- **Impact** : métier (faible, réversible)

## ADR-002 — Développement local avec Supabase CLI + Docker

- **Date** : 2026-11-02
- **Statut** : Accepté
- **Décideur** : Claude (rôle : solution-architect)
- **Contexte** : Docker 29 et Supabase CLI 2.121 sont disponibles sur le poste.
- **Décision** : Base locale via `supabase start`, schéma et RLS en migrations versionnées ; le projet cloud n'est nécessaire que pour la mise en ligne.
- **Alternatives écartées** : Projet Supabase cloud dès le départ — demande un compte et des clés avant de pouvoir tester.
- **Conséquences** : Zéro tâche manuelle pour développer ; tests RLS reproductibles.
- **Impact** : technique / financier (nul)

## ADR-001 — Stack par défaut du skill

- **Date** : 2026-11-02
- **Statut** : Accepté
- **Décideur** : Claude (rôle : solution-architect)
- **Contexte** : CLAUDE.md impose Next.js + Supabase + Tailwind/shadcn + TanStack Query + Zod + Vitest/Playwright + GitHub Actions + Vercel.
- **Décision** : Stack conservée telle quelle ; ajouts : `lucide-react` (icônes), `@dnd-kit` (Kanban accessible clavier/tactile), pnpm (gestionnaire de paquets).
- **Alternatives écartées** : HTML5 drag-and-drop natif — non accessible au clavier ni fiable au tactile.
- **Conséquences** : Dépendances limitées et maintenues.
- **Impact** : technique

---

<!-- Gabarit :

## ADR-NNN — <titre court>

- **Date** :
- **Statut** : Proposé / Accepté / Remplacé par ADR-XXX
- **Décideur** : Claude (rôle : <ex. solution-architect>)
- **Contexte** :
- **Décision** :
- **Alternatives écartées** :
- **Conséquences** :
- **Impact** :

-->
