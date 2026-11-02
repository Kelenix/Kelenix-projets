-- Durcissement (audit de sécurité) : les données d'historique ne peuvent plus être falsifiées
-- depuis le navigateur.

-- 1. Date de fin : posée uniquement par le serveur, sur toute mise à jour (plus seulement
--    quand le statut change), et conservée tant que la tâche reste terminée.
create or replace function public.set_task_completed_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status <> 'done' then
    new.completed_at = null;
  elsif tg_op = 'UPDATE' and old.status = 'done' then
    new.completed_at = old.completed_at;
  elsif tg_op = 'UPDATE' or auth.uid() is not null then
    new.completed_at = now();
  else
    -- Insertion par le serveur (données de démonstration, imports) : date fournie acceptée.
    new.completed_at = coalesce(new.completed_at, now());
  end if;
  return new;
end;
$$;

drop trigger tasks_completed_at on public.tasks;
create trigger tasks_completed_at before insert or update on public.tasks
  for each row execute function public.set_task_completed_at();

-- 2. Auteur d'une tâche : toujours l'utilisateur connecté, jamais modifiable ensuite.
create function public.set_task_created_by()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.created_by = case when tg_op = 'INSERT' then auth.uid() else old.created_by end;
  end if;
  return new;
end;
$$;

create trigger tasks_created_by before insert or update on public.tasks
  for each row execute function public.set_task_created_by();

-- 3. Temps passé : les sessions sont horodatées par le serveur uniquement, via start_timer /
--    pause_timer. Plus d'écriture directe dans la table.
drop policy "time_entries_insert" on public.time_entries;
drop policy "time_entries_update" on public.time_entries;

create or replace function public.start_timer(p_task_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.can_access_task(p_task_id) then
    raise exception 'Vous n''avez pas accès à cette tâche.' using errcode = '42501';
  end if;
  update public.time_entries set ended_at = now() where user_id = auth.uid() and ended_at is null;
  insert into public.time_entries (task_id, user_id) values (p_task_id, auth.uid());
end;
$$;

create or replace function public.pause_timer()
returns void language sql security definer set search_path = '' as $$
  update public.time_entries set ended_at = now() where user_id = auth.uid() and ended_at is null;
$$;

revoke execute on function public.start_timer(uuid) from public, anon;
revoke execute on function public.pause_timer() from public, anon;
grant execute on function public.start_timer(uuid) to authenticated;
grant execute on function public.pause_timer() to authenticated;
