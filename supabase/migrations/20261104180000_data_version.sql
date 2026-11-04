-- Synchronisation entre navigateurs : un compteur avance à chaque modification des données
-- partagées. Les navigateurs ouverts le consultent toutes les quelques secondes (requête minime)
-- et rechargent leurs données dès qu'il change. Alternative légère au service Realtime, absent
-- du serveur. Le compteur ne révèle rien d'autre que « quelque chose a changé ».

create sequence public.data_version_seq;

create function public.bump_data_version()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform nextval('public.data_version_seq');
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'clients', 'projects', 'project_members', 'project_milestones', 'tasks', 'task_assignees',
    'task_checklist_items', 'task_comments', 'task_links', 'time_entries', 'time_entry_changes'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each statement execute function public.bump_data_version()',
      t || '_bump_version', t
    );
  end loop;
end;
$$;

-- Version courante des données (lecture seule, utilisateurs connectés).
create function public.data_version()
returns bigint language sql stable security definer set search_path = '' as $$
  select case when is_called then last_value else 0 end from public.data_version_seq;
$$;

revoke all on sequence public.data_version_seq from public, anon, authenticated;
revoke execute on function public.bump_data_version() from public, anon, authenticated;
revoke execute on function public.data_version() from public, anon;
grant execute on function public.data_version() to authenticated;
