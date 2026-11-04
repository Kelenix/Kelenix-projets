-- La pause en cours (et son motif) est visible de tous les membres du projet : chacun sait qui
-- est en pause et pour quoi. L'historique des pauses terminées reste réservé à son auteur, aux
-- chefs du projet et aux administrateurs.
drop policy "time_entries_select" on public.time_entries;
create policy "time_entries_select" on public.time_entries for select to authenticated
  using (
    public.can_access_task(task_id)
    and (kind = 'work' or ended_at is null or user_id = auth.uid() or public.can_manage_task(task_id))
  );
