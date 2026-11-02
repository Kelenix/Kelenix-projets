-- Date de fin des tâches, pour les statistiques dans le temps.
-- Renseignée automatiquement au passage à « Terminé », effacée si la tâche est rouverte.

alter table public.tasks add column completed_at timestamptz;

update public.tasks set completed_at = updated_at where status = 'done';

create index tasks_completed_at_idx on public.tasks (completed_at) where completed_at is not null;

create function public.set_task_completed_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'done' then
    if tg_op = 'INSERT' or old.status is distinct from 'done' then
      new.completed_at = coalesce(new.completed_at, now());
    end if;
  else
    new.completed_at = null;
  end if;
  return new;
end;
$$;

create trigger tasks_completed_at before insert or update of status on public.tasks
  for each row execute function public.set_task_completed_at();
