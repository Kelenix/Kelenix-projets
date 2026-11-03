-- Pauses : une session est soit du travail, soit une pause (temps de pause mesuré à part).
-- Toujours une seule session ouverte par personne ; horodatage serveur uniquement.

alter table public.time_entries
  add column kind text not null default 'work' check (kind in ('work', 'pause'));

-- Pause : termine la session de travail en cours et ouvre une pause sur la même tâche.
create or replace function public.pause_timer()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_task uuid;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  update public.time_entries set ended_at = now()
  where user_id = auth.uid() and ended_at is null and kind = 'work'
  returning task_id into v_task;
  if v_task is not null then
    insert into public.time_entries (task_id, user_id, kind) values (v_task, auth.uid(), 'pause');
  end if;
end;
$$;

-- Reprise : termine la pause en cours et reprend le travail sur la même tâche.
create function public.resume_timer()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_task uuid;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  update public.time_entries set ended_at = now()
  where user_id = auth.uid() and ended_at is null and kind = 'pause'
  returning task_id into v_task;
  if v_task is not null and public.can_access_task(v_task) then
    insert into public.time_entries (task_id, user_id, kind) values (v_task, auth.uid(), 'work');
  end if;
end;
$$;

-- Fin : termine la session ouverte (travail ou pause).
create function public.stop_timer()
returns void language sql security definer set search_path = '' as $$
  update public.time_entries set ended_at = now() where user_id = auth.uid() and ended_at is null;
$$;

revoke execute on function public.resume_timer() from public, anon;
revoke execute on function public.stop_timer() from public, anon;
grant execute on function public.resume_timer() to authenticated;
grant execute on function public.stop_timer() to authenticated;
