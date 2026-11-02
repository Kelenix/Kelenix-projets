-- Kelenix — schéma initial : profils, clients, projets, membres, tâches et sous-éléments.
-- Toutes les tables ont la RLS activée ; l'autorisation est garantie ici, pas dans l'UI.

-- ─── Types ──────────────────────────────────────────────────────────────────
create type public.app_role as enum ('owner', 'collaborator');
create type public.project_status as enum ('planned', 'in_progress', 'paused', 'done');
create type public.task_status as enum ('todo', 'in_progress', 'done');
create type public.task_priority as enum ('low', 'normal', 'high');

-- ─── Tables ─────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text not null,
  role public.app_role not null default 'collaborator',
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  company text check (char_length(company) <= 120),
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notes text check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (char_length(description) <= 5000),
  client_id uuid references public.clients (id) on delete set null,
  due_date date,
  status public.project_status not null default 'planned',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_client_id_idx on public.projects (client_id);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_id_idx on public.project_members (user_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (char_length(description) <= 10000),
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'normal',
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date date,
  is_blocked boolean not null default false,
  blocked_reason text check (char_length(blocked_reason) <= 1000),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_blocked_reason_required
    check (not is_blocked or char_length(btrim(coalesce(blocked_reason, ''))) > 0)
);
create index tasks_project_id_idx on public.tasks (project_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 200),
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index task_checklist_items_task_id_idx on public.task_checklist_items (task_id);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index task_comments_task_id_idx on public.task_comments (task_id);

create table public.task_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  label text check (char_length(label) <= 120),
  url text not null check (url ~* '^https?://[^\s]+$' and char_length(url) <= 2000),
  created_at timestamptz not null default now()
);
create index task_links_task_id_idx on public.task_links (task_id);

-- ─── Fonctions d'autorisation ──────────────────────────────────────────────
-- security definer : lisent les tables sans repasser par la RLS (évite la récursion).
create function public.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'owner'
  );
$$;

create function public.can_access_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_owner() or exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid()
  );
$$;

create function public.can_access_task(p_task_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id and public.can_access_project(t.project_id)
  );
$$;

-- ─── Triggers ───────────────────────────────────────────────────────────────
create function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- Profil créé à la création d'un compte. Le rôle vient de app_metadata, que seul le
-- serveur (clé service) peut écrire.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_app_meta_data ->> 'role')::public.app_role, 'collaborator')
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Seul un propriétaire change un rôle, jamais le sien ; l'e-mail suit auth.users.
create function public.guard_profile_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.email is distinct from old.email and auth.uid() is not null then
    raise exception 'L''e-mail ne peut pas être modifié ici.';
  end if;
  if new.role is distinct from old.role then
    if not public.is_owner() then
      raise exception 'Seul un propriétaire peut modifier un rôle.';
    end if;
    if new.id = auth.uid() then
      raise exception 'Vous ne pouvez pas modifier votre propre rôle.';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Le créateur d'un projet en devient membre.
create function public.add_creator_as_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    insert into public.project_members (project_id, user_id)
    values (new.id, auth.uid()) on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger projects_add_creator after insert on public.projects
  for each row execute function public.add_creator_as_member();

-- Le responsable d'une tâche doit être membre du projet.
create function public.check_task_assignee()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assignee_id is not null and not exists (
    select 1 from public.project_members
    where project_id = new.project_id and user_id = new.assignee_id
  ) then
    raise exception 'Le responsable doit être membre du projet.';
  end if;
  return new;
end;
$$;

create trigger tasks_check_assignee before insert or update of assignee_id, project_id on public.tasks
  for each row execute function public.check_task_assignee();

-- Retirer un membre d'un projet libère ses tâches sur ce projet.
create function public.unassign_removed_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.tasks set assignee_id = null
  where project_id = old.project_id and assignee_id = old.user_id;
  return old;
end;
$$;

create trigger project_members_unassign after delete on public.project_members
  for each row execute function public.unassign_removed_member();

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_links enable row level security;

-- profiles : l'équipe est visible par ses membres ; création/suppression via la clé service.
create policy "profiles_select" on public.profiles for select to authenticated using (true);
create policy "profiles_update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_owner())
  with check (id = auth.uid() or public.is_owner());

-- clients : gérés par le propriétaire ; un collaborateur voit ceux de ses projets.
create policy "clients_select" on public.clients for select to authenticated using (
  public.is_owner() or exists (
    select 1 from public.projects p
    where p.client_id = clients.id and public.can_access_project(p.id)
  )
);
create policy "clients_insert" on public.clients for insert to authenticated with check (public.is_owner());
create policy "clients_update" on public.clients for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy "clients_delete" on public.clients for delete to authenticated using (public.is_owner());

-- projects
create policy "projects_select" on public.projects for select to authenticated
  using (public.can_access_project(id));
create policy "projects_insert" on public.projects for insert to authenticated with check (public.is_owner());
create policy "projects_update" on public.projects for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy "projects_delete" on public.projects for delete to authenticated using (public.is_owner());

-- project_members
create policy "project_members_select" on public.project_members for select to authenticated
  using (public.can_access_project(project_id));
create policy "project_members_insert" on public.project_members for insert to authenticated
  with check (public.is_owner());
create policy "project_members_delete" on public.project_members for delete to authenticated
  using (public.is_owner());

-- tasks : tout membre du projet consulte et modifie les tâches.
create policy "tasks_select" on public.tasks for select to authenticated
  using (public.can_access_project(project_id));
create policy "tasks_insert" on public.tasks for insert to authenticated
  with check (public.can_access_project(project_id));
create policy "tasks_update" on public.tasks for update to authenticated
  using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));
create policy "tasks_delete" on public.tasks for delete to authenticated
  using (public.can_access_project(project_id));

-- checklist & liens : mêmes droits que la tâche.
create policy "checklist_all" on public.task_checklist_items for all to authenticated
  using (public.can_access_task(task_id)) with check (public.can_access_task(task_id));
create policy "links_all" on public.task_links for all to authenticated
  using (public.can_access_task(task_id)) with check (public.can_access_task(task_id));

-- commentaires : lecture par les membres, écriture en son nom, suppression par l'auteur ou le propriétaire.
create policy "comments_select" on public.task_comments for select to authenticated
  using (public.can_access_task(task_id));
create policy "comments_insert" on public.task_comments for insert to authenticated
  with check (author_id = auth.uid() and public.can_access_task(task_id));
create policy "comments_delete" on public.task_comments for delete to authenticated
  using ((author_id = auth.uid() or public.is_owner()) and public.can_access_task(task_id));

-- Les fonctions d'autorisation ne sont appelables que par les utilisateurs connectés.
revoke execute on function public.is_owner() from public, anon;
revoke execute on function public.can_access_project(uuid) from public, anon;
revoke execute on function public.can_access_task(uuid) from public, anon;
