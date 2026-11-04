-- Tags (tâches et projets), jours fériés et absences, validation des heures par le chef de projet,
-- heures facturables, arrêt d'une session oubliée à l'heure réelle, journal d'audit des heures.

-- ─── Tags ───────────────────────────────────────────────────────────────────
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null default 'slate' check (color in ('slate', 'blue', 'green', 'amber', 'red', 'teal', 'orange', 'pink')),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index tags_name_unique on public.tags (lower(btrim(name)));

create table public.task_tags (
  task_id uuid not null references public.tasks (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (task_id, tag_id)
);
create index task_tags_tag_id_idx on public.task_tags (tag_id);

create table public.project_tags (
  project_id uuid not null references public.projects (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (project_id, tag_id)
);
create index project_tags_tag_id_idx on public.project_tags (tag_id);

alter table public.tags enable row level security;
alter table public.task_tags enable row level security;
alter table public.project_tags enable row level security;
-- Le vocabulaire des tags est commun à l'équipe : tout membre en crée ; seul un administrateur en supprime.
create policy "tags_select" on public.tags for select to authenticated using (true);
create policy "tags_insert" on public.tags for insert to authenticated with check (created_by = auth.uid());
create policy "tags_update" on public.tags for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "tags_delete" on public.tags for delete to authenticated using (public.is_owner());
create policy "task_tags_all" on public.task_tags for all to authenticated
  using (public.can_access_task(task_id)) with check (public.can_access_task(task_id));
create policy "project_tags_select" on public.project_tags for select to authenticated using (public.can_access_project(project_id));
create policy "project_tags_write" on public.project_tags for insert to authenticated with check (public.can_manage_project(project_id));
create policy "project_tags_delete" on public.project_tags for delete to authenticated using (public.can_manage_project(project_id));

-- ─── Jours fériés et absences ──────────────────────────────────────────────
create table public.holidays (
  day date primary key,
  name text not null check (char_length(btrim(name)) between 1 and 80)
);
alter table public.holidays enable row level security;
create policy "holidays_select" on public.holidays for select to authenticated using (true);
create policy "holidays_write" on public.holidays for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- Absences : visibles de l'équipe (planification) ; chacun gère les siennes, un administrateur toutes.
create table public.absences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('leave', 'sick', 'training', 'other')),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  constraint absences_range check (end_date >= start_date and end_date - start_date <= 366)
);
create index absences_user_idx on public.absences (user_id, start_date);
alter table public.absences enable row level security;
create policy "absences_select" on public.absences for select to authenticated using (true);
create policy "absences_write" on public.absences for all to authenticated
  using (user_id = auth.uid() or public.is_owner()) with check (user_id = auth.uid() or public.is_owner());

-- ─── Heures : facturable, validation ───────────────────────────────────────
alter table public.projects add column billable_default boolean not null default true;
alter table public.time_entries
  add column billable boolean not null default true,
  add column approved_at timestamptz,
  add column approved_by uuid references public.profiles (id) on delete set null;

-- Une nouvelle session prend le réglage « facturable » de son projet.
create function public.set_time_entry_billable_default()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select p.billable_default into new.billable
  from public.tasks t join public.projects p on p.id = t.project_id
  where t.id = new.task_id;
  new.billable := coalesce(new.billable, true);
  new.approved_at := null;
  new.approved_by := null;
  return new;
end;
$$;
create trigger time_entries_billable_default before insert on public.time_entries
  for each row execute function public.set_time_entry_billable_default();

-- Validation (ou retrait de validation) de sessions terminées, par un chef du projet ou un administrateur.
create function public.approve_time_entries(p_ids uuid[], p_approved boolean)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if exists (
    select 1 from public.time_entries e
    where e.id = any (p_ids) and not public.can_manage_task(e.task_id)
  ) then
    raise exception 'Seul un chef de projet ou un administrateur valide les heures.' using errcode = '42501';
  end if;
  update public.time_entries
  set approved_at = case when p_approved then now() end,
      approved_by = case when p_approved then auth.uid() end
  where id = any (p_ids) and ended_at is not null and kind = 'work'
    and (approved_at is null) = p_approved;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Facturable ou non : auteur de la session (tant qu'elle n'est pas validée), chef du projet ou administrateur.
create function public.set_time_entry_billable(p_id uuid, p_billable boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.time_entries;
begin
  select * into v from public.time_entries where id = p_id;
  if v.id is null or not public.can_access_task(v.task_id)
     or not (public.can_manage_task(v.task_id) or (v.user_id = auth.uid() and v.approved_at is null)) then
    raise exception 'Vous ne pouvez pas modifier cette session.' using errcode = '42501';
  end if;
  update public.time_entries set billable = p_billable where id = v.id;
end;
$$;

-- Des heures validées ne se corrigent plus que par un chef du projet ou un administrateur.
create or replace function public.edit_time_entry(p_id uuid, p_started_at timestamptz, p_ended_at timestamptz, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.time_entries;
begin
  select * into v from public.time_entries where id = p_id;
  if v.id is null or not public.can_access_task(v.task_id) or (v.user_id <> auth.uid() and not public.can_manage_task(v.task_id)) then
    raise exception 'Vous ne pouvez pas modifier cette session.' using errcode = '42501';
  end if;
  if v.approved_at is not null and not public.can_manage_task(v.task_id) then
    raise exception 'Ces heures sont validées : seul un chef de projet peut les corriger.';
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

-- Session oubliée : terminer son chronomètre à l'heure où l'on a réellement arrêté.
create function public.stop_timer_at(p_ended_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.time_entries;
begin
  select * into v from public.time_entries where user_id = auth.uid() and ended_at is null;
  if v.id is null then
    raise exception 'Aucune session en cours.';
  end if;
  if p_ended_at is null or p_ended_at <= v.started_at or p_ended_at > now() then
    raise exception 'L''heure de fin doit être entre le début de la session et maintenant.';
  end if;
  update public.time_entries set ended_at = p_ended_at, edited_at = now() where id = v.id;
end;
$$;

-- ─── Journal d'audit des heures ────────────────────────────────────────────
create table public.time_entry_audit (
  id bigint generated always as identity primary key,
  entry_id uuid not null,
  task_id uuid not null references public.tasks (id) on delete cascade,
  entry_user_id uuid references public.profiles (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('manual_add', 'edit', 'stop_at', 'delete', 'approve', 'unapprove', 'billable', 'not_billable')),
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index time_entry_audit_task_idx on public.time_entry_audit (task_id, created_at desc);
alter table public.time_entry_audit enable row level security;
-- Lecture : l'auteur des heures concernées, les chefs du projet, les administrateurs. Aucune écriture directe.
create policy "time_entry_audit_select" on public.time_entry_audit for select to authenticated
  using (public.can_access_task(task_id) and (entry_user_id = auth.uid() or public.can_manage_task(task_id)));

create function public.audit_time_entry()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  snapshot_old jsonb := case when tg_op <> 'INSERT' then jsonb_build_object('started_at', old.started_at, 'ended_at', old.ended_at, 'billable', old.billable, 'approved_at', old.approved_at) end;
  snapshot_new jsonb := case when tg_op <> 'DELETE' then jsonb_build_object('started_at', new.started_at, 'ended_at', new.ended_at, 'billable', new.billable, 'approved_at', new.approved_at) end;
  log record;
begin
  if tg_op = 'INSERT' then
    if new.source = 'manual' then
      insert into public.time_entry_audit (entry_id, task_id, entry_user_id, actor_id, action, new_value)
      values (new.id, new.task_id, new.user_id, auth.uid(), 'manual_add', snapshot_new);
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    -- Suppression en cascade d'une tâche : la tâche n'existe déjà plus, rien à journaliser.
    if old.kind = 'work' and exists (select 1 from public.tasks where id = old.task_id) then
      insert into public.time_entry_audit (entry_id, task_id, entry_user_id, actor_id, action, old_value)
      values (old.id, old.task_id, old.user_id, auth.uid(), 'delete', snapshot_old);
    end if;
    return old;
  end if;
  -- Mises à jour : uniquement les changements d'heures, de validation ou de facturation (pas le simple arrêt du chrono).
  for log in
    select a from (values
      (case when old.ended_at is not null and (new.started_at, new.ended_at) is distinct from (old.started_at, old.ended_at) then 'edit' end),
      (case when old.ended_at is null and new.ended_at is not null and new.edited_at is distinct from old.edited_at then 'stop_at' end),
      (case when new.approved_at is not null and old.approved_at is null then 'approve' when new.approved_at is null and old.approved_at is not null then 'unapprove' end),
      (case when new.billable <> old.billable then case when new.billable then 'billable' else 'not_billable' end end)
    ) as t(a) where a is not null
  loop
    insert into public.time_entry_audit (entry_id, task_id, entry_user_id, actor_id, action, old_value, new_value)
    values (new.id, new.task_id, new.user_id, auth.uid(), log.a, snapshot_old, snapshot_new);
  end loop;
  return new;
end;
$$;
create trigger time_entries_audit after insert or update or delete on public.time_entries
  for each row execute function public.audit_time_entry();

-- Synchronisation entre navigateurs : les nouvelles tables font aussi avancer la version.
do $$
declare
  t text;
begin
  foreach t in array array['tags', 'task_tags', 'project_tags', 'holidays', 'absences'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each statement execute function public.bump_data_version()',
      t || '_bump_version', t
    );
  end loop;
end;
$$;

revoke execute on function public.approve_time_entries(uuid[], boolean) from public, anon;
revoke execute on function public.set_time_entry_billable(uuid, boolean) from public, anon;
revoke execute on function public.stop_timer_at(timestamptz) from public, anon;
grant execute on function public.approve_time_entries(uuid[], boolean) to authenticated;
grant execute on function public.set_time_entry_billable(uuid, boolean) to authenticated;
grant execute on function public.stop_timer_at(timestamptz) to authenticated;
