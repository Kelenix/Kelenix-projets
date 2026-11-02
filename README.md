# Kelenix — Gérez vos projets, simplement.

Gestion de projets pour un freelance (seul ou en petite équipe) : où en est chaque projet,
quoi faire ensuite, qui est responsable, ce qui est en retard ou bloqué.

- **Deux pages** : connexion (`/login`) et dashboard (`/`). Tout le reste vit dans le dashboard
  (sections, modales, panneau latéral).
- **Fonctions** : vue d'ensemble, projets (création, membres, clôture, archivage), tâches
  (Kanban glisser-déposer, liste, checklist, commentaires, liens, blocage), « Mes tâches »,
  clients, statistiques (graphiques dynamiques, stats par membre), équipe (rôles Propriétaire /
  Collaborateur), recherche globale.
- **Sécurité** : les permissions sont appliquées en base par la RLS Postgres (voir
  [docs/architecture.md](docs/architecture.md)), pas seulement dans l'interface.

Stack : Next.js 16 (App Router) · Supabase (Postgres, Auth, RLS) · Tailwind CSS 4 + shadcn/ui ·
TanStack Query · Zod · dnd-kit · Vitest · Playwright.

## Prérequis

- Node.js 24 et pnpm 10
- Docker Desktop **démarré** (pour Supabase en local)

## Démarrer en local

```bash
pnpm install
```

```bash
pnpm db:start
```

`db:start` lance Supabase en local (ports `553xx`), applique les migrations et charge les
données de démonstration. Créez ensuite `.env.local` à partir de `.env.example` avec les
valeurs affichées par `pnpm supabase status` (`API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`).

```bash
pnpm dev
```

Ouvrez <http://localhost:3000>. Données de démonstration **fictives** (base locale uniquement) :

- [supabase/seed.sql](supabase/seed.sql) : comptes de base (un propriétaire, un collaborateur) ;
- [supabase/seed-demo.sql](supabase/seed-demo.sql) : jeu complet couvrant toutes les situations
  (statuts de projet et de tâche, retards, blocages, checklists, commentaires, liens, temps passé
  par plusieurs personnes, historique sur 12 semaines) et deux collaborateurs de plus.

Les identifiants sont indiqués en tête de ces fichiers. `pnpm db:reset` recharge les deux ;
pour ajouter le jeu complet à une base existante sans rien effacer :

```bash
docker exec -i supabase_db_kelenix psql -U postgres -d postgres < supabase/seed-demo.sql
```

## Commandes

| Commande | Rôle |
|----------|------|
| `pnpm dev` | Serveur de développement |
| `pnpm build` / `pnpm start` | Build et serveur de production |
| `pnpm check` | Lint + types + tests unitaires |
| `pnpm test:db` | Tests des règles RLS (pgTAP) |
| `pnpm test:e2e` | Parcours complets Playwright (base locale démarrée) |
| `pnpm db:reset` | Réinitialise la base locale (migrations + démo) |
| `pnpm db:types` | Régénère les types TypeScript du schéma |
| `pnpm db:seed-volume` / `pnpm db:unseed-volume` | Ajoute / retire 120 projets de test (« (test NNN) ») pour voir l'affichage à grande échelle |
| `pnpm create-owner <email> "<Nom>"` | Crée un compte propriétaire (mot de passe provisoire affiché une fois) |

## Comptes et équipe

Il n'y a pas d'inscription publique. Le premier propriétaire est créé avec `pnpm create-owner`.
Il ajoute ensuite les membres depuis **Équipe et paramètres** (e-mail + mot de passe provisoire),
choisit leur rôle et les projets auxquels ils ont accès. Chacun change son mot de passe dans
**Mon profil**.

## Mise en ligne

Déploiement automatique sur un VPS (Docker, Supabase auto-hébergé, HTTPS) par GitHub Actions
à chaque push sur `main` : voir [docs/deployment.md](docs/deployment.md). Les seules actions
humaines (clé SSH, DNS) sont listées dans [docs/manual-tasks.md](docs/manual-tasks.md).

## Documentation projet

- [docs/PLAN.md](docs/PLAN.md) — plan de réalisation et hypothèses
- [docs/architecture.md](docs/architecture.md) — architecture, données, permissions
- [DECISION_LOG.md](DECISION_LOG.md) — décisions techniques
- [PROJECT_STATE.md](PROJECT_STATE.md) — avancement
