-- Temps passé : chaque membre d'un projet peut chronométrer son travail sur une tâche
-- (démarrer / mettre en pause). Plusieurs personnes peuvent intervenir sur la même tâche.

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint time_entries_valid_range check (ended_at is null or ended_at >= started_at)
);
create index time_entries_task_id_idx on public.time_entries (task_id);
-- Un seul chronomètre en cours par personne.
create unique index time_entries_one_running_per_user on public.time_entries (user_id) where ended_at is null;

alter table public.time_entries enable row level security;

create policy "time_entries_select" on public.time_entries for select to authenticated
  using (public.can_access_task(task_id));
create policy "time_entries_insert" on public.time_entries for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_task(task_id));
create policy "time_entries_update" on public.time_entries for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.can_access_task(task_id));
create policy "time_entries_delete" on public.time_entries for delete to authenticated
  using ((user_id = auth.uid() or public.is_owner()) and public.can_access_task(task_id));

-- Démarre le chronomètre de l'utilisateur sur une tâche (met en pause celui en cours ailleurs).
create function public.start_timer(p_task_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.time_entries set ended_at = now() where user_id = auth.uid() and ended_at is null;
  insert into public.time_entries (task_id, user_id) values (p_task_id, auth.uid());
end;
$$;

-- Met en pause le chronomètre en cours de l'utilisateur.
create function public.pause_timer()
returns void language sql security invoker set search_path = '' as $$
  update public.time_entries set ended_at = now() where user_id = auth.uid() and ended_at is null;
$$;

revoke execute on function public.start_timer(uuid) from public, anon;
revoke execute on function public.pause_timer() from public, anon;
