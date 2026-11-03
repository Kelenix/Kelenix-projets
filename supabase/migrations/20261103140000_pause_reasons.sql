-- Motif des pauses (repas, repos, réunion, personnel, autre).

alter table public.time_entries
  add column pause_reason text check (pause_reason in ('meal', 'rest', 'meeting', 'personal', 'other')),
  add constraint time_entries_pause_reason_only_for_pauses check (pause_reason is null or kind = 'pause');

-- La pause prend désormais un motif (par défaut « autre »).
drop function public.pause_timer();
create function public.pause_timer(p_reason text default 'other')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_task uuid;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  if coalesce(p_reason, 'other') not in ('meal', 'rest', 'meeting', 'personal', 'other') then
    raise exception 'Motif de pause inconnu.';
  end if;
  update public.time_entries set ended_at = now()
  where user_id = auth.uid() and ended_at is null and kind = 'work'
  returning task_id into v_task;
  if v_task is not null then
    insert into public.time_entries (task_id, user_id, kind, pause_reason)
    values (v_task, auth.uid(), 'pause', coalesce(p_reason, 'other'));
  end if;
end;
$$;

-- Motif d'une pause existante (corrigeable par son auteur ou le propriétaire).
create function public.set_pause_reason(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.time_entries;
begin
  select * into v from public.time_entries where id = p_id;
  if v.id is null or not public.can_access_task(v.task_id) or (v.user_id <> auth.uid() and not public.is_owner()) then
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

-- Pauses déjà enregistrées : motif « autre ».
update public.time_entries set pause_reason = 'other' where kind = 'pause' and pause_reason is null;

revoke execute on function public.pause_timer(text) from public, anon;
revoke execute on function public.set_pause_reason(uuid, text) from public, anon;
grant execute on function public.pause_timer(text) to authenticated;
grant execute on function public.set_pause_reason(uuid, text) to authenticated;
