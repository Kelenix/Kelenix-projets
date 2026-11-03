-- Gestion des sessions de temps : description du travail réalisé, saisie manuelle d'heures
-- oubliées, modification justifiée et tracée. Toutes les écritures passent par des fonctions
-- serveur (aucune écriture directe dans les tables).

alter table public.time_entries
  add column description text check (char_length(description) <= 1000),
  add column source text not null default 'timer' check (source in ('timer', 'manual')),
  add column edited_at timestamptz;

-- Journal des modifications (ancienne et nouvelle plage, auteur, justification).
create table public.time_entry_changes (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.time_entries (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now(),
  old_started_at timestamptz not null,
  old_ended_at timestamptz not null,
  new_started_at timestamptz not null,
  new_ended_at timestamptz not null,
  reason text not null check (char_length(btrim(reason)) between 3 and 1000)
);
create index time_entry_changes_entry_id_idx on public.time_entry_changes (entry_id);
create index time_entry_changes_task_id_idx on public.time_entry_changes (task_id);

alter table public.time_entry_changes enable row level security;
create policy "time_entry_changes_select" on public.time_entry_changes for select to authenticated
  using (public.can_access_task(task_id));

-- Contrôles communs d'une plage de travail saisie à la main.
create function public.check_time_range(p_user uuid, p_started_at timestamptz, p_ended_at timestamptz, p_ignore uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_started_at is null or p_ended_at is null or p_ended_at <= p_started_at then
    raise exception 'La fin doit être après le début.';
  end if;
  if p_ended_at > now() + interval '1 minute' then
    raise exception 'Impossible d''enregistrer du temps dans le futur.';
  end if;
  if p_ended_at - p_started_at > interval '16 hours' then
    raise exception 'Une session ne peut pas dépasser 16 heures.';
  end if;
  if exists (
    select 1 from public.time_entries
    where user_id = p_user and id is distinct from p_ignore
      and started_at < p_ended_at and coalesce(ended_at, now()) > p_started_at
  ) then
    raise exception 'Cette plage chevauche une autre session de la même personne.';
  end if;
end;
$$;

-- Ajout manuel d'heures oubliées (toujours au nom de l'utilisateur connecté).
create function public.log_time(p_task_id uuid, p_started_at timestamptz, p_ended_at timestamptz, p_description text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.can_access_task(p_task_id) then
    raise exception 'Vous n''avez pas accès à cette tâche.' using errcode = '42501';
  end if;
  perform public.check_time_range(auth.uid(), p_started_at, p_ended_at, null);
  insert into public.time_entries (task_id, user_id, started_at, ended_at, kind, source, description)
  values (p_task_id, auth.uid(), p_started_at, p_ended_at, 'work', 'manual', nullif(btrim(p_description), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- Modification d'une session terminée : justification obligatoire, ancienne plage conservée.
-- Autorisée à l'auteur de la session et au propriétaire.
create function public.edit_time_entry(p_id uuid, p_started_at timestamptz, p_ended_at timestamptz, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.time_entries;
begin
  select * into v from public.time_entries where id = p_id;
  if v.id is null or not public.can_access_task(v.task_id) or (v.user_id <> auth.uid() and not public.is_owner()) then
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

-- Description du travail réalisé (auteur de la session ou propriétaire ; pas de justification).
create function public.set_time_entry_description(p_id uuid, p_description text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.time_entries;
begin
  select * into v from public.time_entries where id = p_id;
  if v.id is null or not public.can_access_task(v.task_id) or (v.user_id <> auth.uid() and not public.is_owner()) then
    raise exception 'Vous ne pouvez pas modifier cette session.' using errcode = '42501';
  end if;
  update public.time_entries set description = nullif(btrim(p_description), '') where id = v.id;
end;
$$;

revoke execute on function public.check_time_range(uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke execute on function public.log_time(uuid, timestamptz, timestamptz, text) from public, anon;
revoke execute on function public.edit_time_entry(uuid, timestamptz, timestamptz, text) from public, anon;
revoke execute on function public.set_time_entry_description(uuid, text) from public, anon;
grant execute on function public.log_time(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.edit_time_entry(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.set_time_entry_description(uuid, text) to authenticated;
