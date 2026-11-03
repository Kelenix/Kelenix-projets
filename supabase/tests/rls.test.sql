-- Tests RLS (pgTAP) : `pnpm test:db`. S'appuie sur les comptes de démo de seed.sql.
begin;
select plan(39);

create temp table projects_all_for_test on commit drop as select id from public.projects;
grant select on projects_all_for_test to authenticated;
create temp table foreign_task_for_test on commit drop as
  select id from public.tasks where project_id = 'a0000000-0000-0000-0000-000000000002' limit 1;
grant select on foreign_task_for_test to authenticated;

-- Projet a0…02 : réservé au propriétaire (le collaborateur n'en est pas membre).
-- Collaborateur : demo.collab, membre du seul projet a0…01.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is(
  (select count(*) from public.projects where id in ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'))::int, 1,
  'collaborateur : ne voit que ses projets'
);
select is_empty(
  $$select id from public.tasks where project_id = 'a0000000-0000-0000-0000-000000000002'$$,
  'collaborateur : ne voit pas les tâches des autres projets'
);
select is_empty(
  $$select id from public.clients where id = 'c0000000-0000-0000-0000-000000000002'$$,
  'collaborateur : ne voit pas les clients des autres projets'
);
select throws_ok(
  $$insert into public.clients (name) values ('Intrus')$$,
  '42501', null, 'collaborateur : ne peut pas créer de client'
);
select throws_ok(
  $$insert into public.projects (name) values ('Intrus')$$,
  '42501', null, 'collaborateur : ne peut pas créer de projet'
);
select is_empty(
  $$update public.projects set name = 'Renommé' where id = 'a0000000-0000-0000-0000-000000000001' returning id$$,
  'collaborateur : ne peut pas modifier un projet'
);
select lives_ok(
  $$insert into public.tasks (project_id, title, assignee_id, created_by)
    values ('a0000000-0000-0000-0000-000000000001', 'Tâche collab', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')$$,
  'collaborateur : crée une tâche sur son projet'
);
select throws_ok(
  $$insert into public.tasks (project_id, title) values ('a0000000-0000-0000-0000-000000000002', 'Intrus')$$,
  '42501', null, 'collaborateur : ne peut pas créer de tâche hors de ses projets'
);
select is_empty(
  $$update public.tasks set title = 'x' where project_id = 'a0000000-0000-0000-0000-000000000002' returning id$$,
  'collaborateur : ne peut pas modifier une tâche hors de ses projets'
);
select throws_ok(
  $$update public.profiles set role = 'owner' where id = '22222222-2222-2222-2222-222222222222'$$,
  'P0001', null, 'collaborateur : ne peut pas s''attribuer le rôle propriétaire'
);
select throws_ok(
  $$insert into public.project_members (project_id, user_id)
    values ('a0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222')$$,
  '42501', null, 'collaborateur : ne peut pas s''ajouter à un projet'
);

-- Temps passé : chronomètre sur ses projets uniquement, un seul en cours à la fois.
select lives_ok(
  $$select public.start_timer((select id from public.tasks where project_id = 'a0000000-0000-0000-0000-000000000001' order by created_at limit 1))$$,
  'collaborateur : démarre un chronomètre sur son projet'
);
select lives_ok(
  $$select public.start_timer((select id from public.tasks where project_id = 'a0000000-0000-0000-0000-000000000001' order by created_at desc limit 1))$$,
  'collaborateur : démarrer ailleurs met en pause le chronomètre précédent'
);
select is(
  (select count(*)::int from public.time_entries where user_id = auth.uid() and ended_at is null), 1,
  'un seul chronomètre en cours par personne'
);
select public.pause_timer();
select is(
  (select kind from public.time_entries where user_id = auth.uid() and ended_at is null), 'pause',
  'pause : le travail s''arrête et une pause est comptée à part'
);
select public.resume_timer();
select is(
  (select kind from public.time_entries where user_id = auth.uid() and ended_at is null), 'work',
  'reprise : la pause se termine et le travail reprend sur la même tâche'
);
select public.stop_timer();
select is(
  (select count(*)::int from public.time_entries where user_id = auth.uid() and ended_at is null), 0,
  'fin : plus aucune session ouverte'
);

-- Heures oubliées, modification justifiée, description.
create temp table own_task_for_test on commit drop as
  select id from public.tasks where project_id = 'a0000000-0000-0000-0000-000000000001' order by created_at limit 1;
select lives_ok(
  $$select public.log_time((select id from own_task_for_test), date_trunc('day', now()) - interval '400 days' + interval '3 hours',
    date_trunc('day', now()) - interval '400 days' + interval '5 hours', 'Intégration du menu')$$,
  'saisie manuelle : heures oubliées enregistrées'
);
select is(
  (select source || '/' || description from public.time_entries where user_id = auth.uid() and source = 'manual'),
  'manual/Intégration du menu', 'saisie manuelle : marquée « manuelle » avec sa description'
);
select throws_ok(
  $$select public.log_time((select id from own_task_for_test), now() + interval '1 hour', now() + interval '2 hours', null)$$,
  'P0001', null, 'saisie manuelle : pas de temps dans le futur'
);
select throws_ok(
  $$select public.log_time((select id from own_task_for_test), date_trunc('day', now()) - interval '400 days' + interval '4 hours',
    date_trunc('day', now()) - interval '400 days' + interval '6 hours', null)$$,
  'P0001', null, 'saisie manuelle : pas de chevauchement avec une autre session'
);
select throws_ok(
  $$select public.log_time((select id from foreign_task_for_test), now() - interval '3 hours', now() - interval '2 hours', null)$$,
  '42501', null, 'saisie manuelle : uniquement sur ses projets'
);
select throws_ok(
  $$select public.edit_time_entry((select id from public.time_entries where user_id = auth.uid() and source = 'manual'),
    date_trunc('day', now()) - interval '400 days' + interval '3 hours', date_trunc('day', now()) - interval '400 days' + interval '6 hours', '')$$,
  'P0001', null, 'modification : justification obligatoire'
);
select lives_ok(
  $$select public.edit_time_entry((select id from public.time_entries where user_id = auth.uid() and source = 'manual'),
    date_trunc('day', now()) - interval '400 days' + interval '3 hours', date_trunc('day', now()) - interval '400 days' + interval '6 hours', 'Oubli de la dernière heure')$$,
  'modification : acceptée avec justification'
);
select is(
  (select reason from public.time_entry_changes where changed_by = auth.uid()), 'Oubli de la dernière heure',
  'modification : ancienne plage et justification conservées'
);
select throws_ok(
  $$select public.edit_time_entry((select id from public.time_entries where user_id <> auth.uid() limit 1), now() - interval '2 hours', now() - interval '1 hour', 'Tentative')$$,
  '42501', null, 'modification : impossible sur la session d''une autre personne'
);
select lives_ok(
  $$select public.set_time_entry_description((select id from public.time_entries where user_id = auth.uid() and source = 'manual'), 'Menu et pied de page')$$,
  'description : modifiable par l''auteur de la session'
);
select throws_ok(
  $$select public.start_timer((select id from foreign_task_for_test))$$,
  '42501', null, 'collaborateur : ne chronomètre pas une tâche hors de ses projets'
);
select throws_ok(
  $$insert into public.time_entries (task_id) select id from public.tasks where project_id = 'a0000000-0000-0000-0000-000000000001' limit 1$$,
  '42501', null, 'temps passé : aucune insertion directe (horodatage serveur uniquement)'
);
select is_empty(
  $$update public.time_entries set started_at = started_at - interval '10 hours' where user_id = auth.uid() returning id$$,
  'temps passé : impossible de gonfler une session'
);
select is(
  (select created_by from public.tasks where title = 'Tâche collab' limit 1), auth.uid(),
  'auteur d''une tâche : toujours l''utilisateur connecté'
);
update public.tasks set completed_at = now() - interval '1 year' where title = 'Tâche collab';
select is(
  (select completed_at from public.tasks where title = 'Tâche collab' limit 1), null,
  'date de fin : non falsifiable depuis le navigateur'
);

-- Propriétaire : voit et gère tout.
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(
  (select count(*) from public.projects)::int, (select count(*)::int from projects_all_for_test),
  'propriétaire : voit tous les projets'
);
select lives_ok(
  $$insert into public.clients (name) values ('Nouveau client')$$,
  'propriétaire : crée un client'
);
select throws_ok(
  $$insert into public.tasks (project_id, title, assignee_id)
    values ('a0000000-0000-0000-0000-000000000002', 'Assignation invalide', '22222222-2222-2222-2222-222222222222')$$,
  'P0001', null, 'le responsable doit être membre du projet'
);
select throws_ok(
  $$insert into public.tasks (project_id, title, is_blocked) values ('a0000000-0000-0000-0000-000000000001', 'Bloquée', true)$$,
  '23514', null, 'une tâche bloquée exige une explication'
);

-- Date de fin : posée au passage à « Terminé », effacée à la réouverture.
update public.tasks set status = 'done' where title = 'Rédiger les mentions légales';
select isnt((select completed_at from public.tasks where title = 'Rédiger les mentions légales'), null, 'terminer une tâche renseigne sa date de fin');
update public.tasks set status = 'todo' where title = 'Rédiger les mentions légales';
select is((select completed_at from public.tasks where title = 'Rédiger les mentions légales'), null, 'rouvrir une tâche efface sa date de fin');

-- Anonyme : aucun accès.
reset role;
set local role anon;
select is_empty($$select id from public.projects$$, 'anonyme : aucun projet visible');

select * from finish();
rollback;
