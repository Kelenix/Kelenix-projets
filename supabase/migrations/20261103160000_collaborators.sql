-- Gestion des collaborateurs : chef de projet (rôle par projet), plusieurs collaborateurs
-- affectés à une tâche avec leur temps estimé, accès aux rapports d'équipe, pauses visibles
-- selon le rôle. Le rôle « owner » est présenté comme « Administrateur ».

-- ─── Rôles ──────────────────────────────────────────────────────────────────
alter table public.project_members
  add column role text not null default 'member' check (role in ('member', 'manager'));

-- Accès aux rapports d'équipe (statistiques de tous les membres), accordé par un administrateur.
alter table public.profiles add column can_view_reports boolean not null default false;

-- Administrateur, ou chef du projet.
create function public.can_manage_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_owner() or exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid() and role = 'manager'
  );
$$;

create function public.can_manage_task(p_task_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks t where t.id = p_task_id and public.can_manage_project(t.project_id)
  );
$$;

revoke execute on function public.can_manage_project(uuid) from public, anon;
revoke execute on function public.can_manage_task(uuid) from public, anon;

-- Rôle et accès aux rapports : modifiables uniquement par un administrateur, jamais pour soi.
create or replace function public.guard_profile_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.email is distinct from old.email then
    raise exception 'L''e-mail ne peut pas être modifié ici.';
  end if;
  if new.role is distinct from old.role or new.can_view_reports is distinct from old.can_view_reports then
    if not public.is_owner() then
      raise exception 'Seul un administrateur peut modifier un rôle ou un accès.';
    end if;
    if new.id = auth.uid() then
      raise exception 'Vous ne pouvez pas modifier votre propre rôle.';
    end if;
  end if;
  return new;
end;
$$;

-- ─── Projets : le chef de projet modifie le projet et gère ses collaborateurs ────────────
drop policy "projects_update" on public.projects;
create policy "projects_update" on public.projects for update to authenticated
  using (public.can_manage_project(id)) with check (public.can_manage_project(id));

-- Un chef de projet ajoute ou retire des collaborateurs ; seul un administrateur nomme un chef.
drop policy "project_members_insert" on public.project_members;
drop policy "project_members_delete" on public.project_members;
create policy "project_members_insert" on public.project_members for insert to authenticated
  with check (public.is_owner() or (role = 'member' and public.can_manage_project(project_id)));
create policy "project_members_delete" on public.project_members for delete to authenticated
  using (public.is_owner() or (role = 'member' and public.can_manage_project(project_id)));
create policy "project_members_update" on public.project_members for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ─── Collaborateurs affectés à une tâche ───────────────────────────────────────
create table public.task_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  estimated_minutes integer check (estimated_minutes between 0 and 100000),
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index task_assignees_user_id_idx on public.task_assignees (user_id);

alter table public.task_assignees enable row level security;
create policy "task_assignees_select" on public.task_assignees for select to authenticated
  using (public.can_access_task(task_id));
create policy "task_assignees_insert" on public.task_assignees for insert to authenticated
  with check (public.can_access_task(task_id));
create policy "task_assignees_update" on public.task_assignees for update to authenticated
  using (public.can_access_task(task_id)) with check (public.can_access_task(task_id));
create policy "task_assignees_delete" on public.task_assignees for delete to authenticated
  using (public.can_access_task(task_id));

-- Un collaborateur affecté doit être membre du projet.
create function public.check_task_assignees_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.tasks t join public.project_members m on m.project_id = t.project_id
    where t.id = new.task_id and m.user_id = new.user_id
  ) then
    raise exception 'Le collaborateur doit être membre du projet.';
  end if;
  return new;
end;
$$;
create trigger task_assignees_check_member before insert or update of user_id, task_id on public.task_assignees
  for each row execute function public.check_task_assignees_member();

-- Le responsable principal fait toujours partie des collaborateurs affectés…
create function public.sync_primary_assignee()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assignee_id is not null then
    insert into public.task_assignees (task_id, user_id) values (new.id, new.assignee_id) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger tasks_sync_primary_assignee after insert or update of assignee_id on public.tasks
  for each row execute function public.sync_primary_assignee();

-- … et le retirer des affectés libère la responsabilité.
create function public.release_primary_assignee()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.tasks set assignee_id = null where id = old.task_id and assignee_id = old.user_id;
  return old;
end;
$$;
create trigger task_assignees_release_primary after delete on public.task_assignees
  for each row execute function public.release_primary_assignee();

-- Retirer un membre d'un projet le désaffecte de toutes les tâches du projet.
create or replace function public.unassign_removed_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.task_assignees a using public.tasks t
  where a.task_id = t.id and t.project_id = old.project_id and a.user_id = old.user_id;
  update public.tasks set assignee_id = null
  where project_id = old.project_id and assignee_id = old.user_id;
  return old;
end;
$$;

insert into public.task_assignees (task_id, user_id)
select id, assignee_id from public.tasks where assignee_id is not null on conflict do nothing;

-- ─── Pauses : visibles par leur auteur, les chefs du projet et les administrateurs ──────
drop policy "time_entries_select" on public.time_entries;
create policy "time_entries_select" on public.time_entries for select to authenticated
  using (public.can_access_task(task_id) and (kind = 'work' or user_id = auth.uid() or public.can_manage_task(task_id)));

-- Le journal suit la visibilité de la session concernée.
drop policy "time_entry_changes_select" on public.time_entry_changes;
create policy "time_entry_changes_select" on public.time_entry_changes for select to authenticated
  using (exists (select 1 from public.time_entries e where e.id = entry_id));

drop policy "time_entries_delete" on public.time_entries;
create policy "time_entries_delete" on public.time_entries for delete to authenticated
  using ((user_id = auth.uid() or public.can_manage_task(task_id)) and public.can_access_task(task_id));

drop policy "comments_delete" on public.task_comments;
create policy "comments_delete" on public.task_comments for delete to authenticated
  using ((author_id = auth.uid() or public.can_manage_task(task_id)) and public.can_access_task(task_id));

-- ─── Corrections de sessions : auteur, chef du projet ou administrateur ─────────────────
create or replace function public.edit_time_entry(p_id uuid, p_started_at timestamptz, p_ended_at timestamptz, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.time_entries;
begin
  select * into v from public.time_entries where id = p_id;
  if v.id is null or not public.can_access_task(v.task_id) or (v.user_id <> auth.uid() and not public.can_manage_task(v.task_id)) then
    raise exception 'Vous ne pouvez pas modifier cette session.' using errcode = '42501';
  end if;
  if v.ended_at is null then
    raise exception 'Terminez la session avant de la modifier.';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Indiquez la raison de la modification.';
  end if;
  perform public.check_time_range(v.user_id, p_started_at, p_ended_at, v.id);
  insert into public.time_entry_changes
    (entry_id, task_id, changed_by, old_started_at, old_ended_at, new_started_at, new_ended_at, reason)
  values (v.id, v.task_id, auth.uid(), v.started_at, v.ended_at, p_started_at, p_ended_at, btrim(p_reason));
  update public.time_entries set started_at = p_started_at, ended_at = p_ended_at, edited_at = now() where id = v.id;
end;
$$;

create or replace function public.set_time_entry_description(p_id uuid, p_description text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.time_entries;
begin
  select * into v from public.time_entries where id = p_id;
  if v.id is null or not public.can_access_task(v.task_id) or (v.user_id <> auth.uid() and not public.can_manage_task(v.task_id)) then
    raise exception 'Vous ne pouvez pas modifier cette session.' using errcode = '42501';
  end if;
  update public.time_entries set description = nullif(btrim(p_description), '') where id = v.id;
end;
$$;

create or replace function public.set_pause_reason(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.time_entries;
begin
  select * into v from public.time_entries where id = p_id;
  if v.id is null or not public.can_access_task(v.task_id) or (v.user_id <> auth.uid() and not public.can_manage_task(v.task_id)) then
    raise exception 'Vous ne pouvez pas modifier cette pause.' using errcode = '42501';
  end if;
  if v.kind <> 'pause' then
    raise exception 'Cette session n''est pas une pause.';
  end if;
  if p_reason not in ('meal', 'rest', 'meeting', 'personal', 'other') then
    raise exception 'Motif de pause inconnu.';
  end if;
  update public.time_entries set pause_reason = p_reason where id = v.id;
end;
$$;
