-- Suivi des projets : budget d'heures et jalons.

-- Budget d'heures (en minutes) ; modifiable par qui peut modifier le projet (administrateur, chef de projet).
alter table public.projects
  add column budget_minutes integer check (budget_minutes between 1 and 6000000);

-- Jalons d'un projet : visibles par ses membres, gérés par ses chefs et les administrateurs.
create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  due_date date not null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index project_milestones_project_id_idx on public.project_milestones (project_id);

alter table public.project_milestones enable row level security;
create policy "project_milestones_select" on public.project_milestones for select to authenticated
  using (public.can_access_project(project_id));
create policy "project_milestones_insert" on public.project_milestones for insert to authenticated
  with check (public.can_manage_project(project_id));
create policy "project_milestones_update" on public.project_milestones for update to authenticated
  using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));
create policy "project_milestones_delete" on public.project_milestones for delete to authenticated
  using (public.can_manage_project(project_id));
