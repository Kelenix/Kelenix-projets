-- Jeu de DÉMONSTRATION complet, fictif — base locale uniquement. Ne jamais appliquer en production.
-- Couvre toutes les situations de l'application : statuts de projet (prévu, en cours, en pause,
-- terminé, archivé, en retard, sans tâche), statuts de tâche (À faire, En cours, Reprogrammé,
-- Terminé), priorités, retards, blocages, tâches à assigner, checklists partielles / complètes,
-- commentaires, liens, temps passé par plusieurs intervenants (dont un chronomètre en cours),
-- tâches terminées réparties sur 12 semaines, client sans projet, projet sans client.
--
-- Chargé par `supabase db reset` après seed.sql ; peut aussi être appliqué seul sur une base
-- existante (sans rien effacer) : il ne fait rien si les données sont déjà présentes.
-- Comptes ajoutés (mot de passe : KelenixDemo2026!) : demo.ines@kelenix.test, demo.karim@kelenix.test

do $$
declare
  alex constant uuid := '11111111-1111-1111-1111-111111111111';
  sam constant uuid := '22222222-2222-2222-2222-222222222222';
  ines constant uuid := '33333333-3333-3333-3333-333333333333';
  karim constant uuid := '44444444-4444-4444-4444-444444444444';
  today constant timestamptz := date_trunc('day', now());
begin
  if exists (select 1 from public.projects where id = 'a0000000-0000-0000-0000-000000000010') then
    raise notice 'Données de démonstration déjà présentes : rien à faire.';
    return;
  end if;

  -- ─── Comptes collaborateurs ───────────────────────────────────────────────
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values
    ('00000000-0000-0000-0000-000000000000', ines, 'authenticated', 'authenticated', 'demo.ines@kelenix.test',
     extensions.crypt('KelenixDemo2026!', extensions.gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"],"role":"collaborator"}', '{"full_name":"Inès Moreau (démo)"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', karim, 'authenticated', 'authenticated', 'demo.karim@kelenix.test',
     extensions.crypt('KelenixDemo2026!', extensions.gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"],"role":"collaborator"}', '{"full_name":"Karim Diallo (démo)"}', now(), now(), '', '', '', '')
  on conflict (id) do nothing;

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  select gen_random_uuid(), u.id, u.id::text,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
  from auth.users u
  where u.id in (ines, karim)
    and not exists (select 1 from auth.identities i where i.user_id = u.id);

  -- ─── Clients (dont un sans projet) ────────────────────────────────────────
  insert into public.clients (id, name, company, email, notes) values
    ('c0000000-0000-0000-0000-000000000010', 'Claire Fontaine (démo)', 'Studio Lumière', 'claire@studio-lumiere.test',
     'Agence photo. Préfère les points hebdomadaires le lundi matin.'),
    ('c0000000-0000-0000-0000-000000000011', 'Paul Martin (démo)', 'Boulangerie Martin', null, 'Joignable surtout par téléphone.'),
    ('c0000000-0000-0000-0000-000000000012', 'Nadia Benali (démo)', null, 'nadia.benali@exemple.test', null),
    ('c0000000-0000-0000-0000-000000000013', 'Association Vélo Vert (démo)', 'Vélo Vert', 'contact@velovert.test',
     'Prospect : devis envoyé, pas encore de projet.');

  -- ─── Projets : tous les statuts, en retard, archivé, sans client, sans tâche ──
  insert into public.projects (id, name, description, client_id, due_date, status, archived_at) values
    ('a0000000-0000-0000-0000-000000000010', 'Refonte site vitrine (démo)', 'Nouveau site du studio : 6 pages, blog et formulaire de contact.',
     'c0000000-0000-0000-0000-000000000010', current_date + 20, 'in_progress', null),
    ('a0000000-0000-0000-0000-000000000011', 'App de réservation (démo)', 'Application mobile de prise de rendez-vous. Échéance dépassée.',
     'c0000000-0000-0000-0000-000000000012', current_date - 3, 'in_progress', null),
    ('a0000000-0000-0000-0000-000000000012', 'Dashboard SaaS (démo)', 'Projet interne, sans client.',
     null, current_date + 60, 'planned', null),
    ('a0000000-0000-0000-0000-000000000013', 'Audit SEO (démo)', 'En pause le temps que le client valide le budget.',
     'c0000000-0000-0000-0000-000000000011', null, 'paused', null),
    ('a0000000-0000-0000-0000-000000000014', 'Boutique en ligne (démo)', 'Livrée et clôturée.',
     'c0000000-0000-0000-0000-000000000011', current_date - 50, 'done', null),
    ('a0000000-0000-0000-0000-000000000015', 'Prototype IA (démo)', 'Idée à explorer : aucune tâche pour l''instant.',
     null, null, 'planned', null),
    ('a0000000-0000-0000-0000-000000000016', 'Ancien site (démo)', 'Projet terminé l''an dernier, archivé.',
     'c0000000-0000-0000-0000-000000000010', current_date - 120, 'done', now() - interval '60 days');

  insert into public.project_members (project_id, user_id) values
    ('a0000000-0000-0000-0000-000000000010', alex), ('a0000000-0000-0000-0000-000000000010', sam), ('a0000000-0000-0000-0000-000000000010', ines),
    ('a0000000-0000-0000-0000-000000000011', alex), ('a0000000-0000-0000-0000-000000000011', karim),
    ('a0000000-0000-0000-0000-000000000012', alex), ('a0000000-0000-0000-0000-000000000012', ines),
    ('a0000000-0000-0000-0000-000000000013', alex), ('a0000000-0000-0000-0000-000000000013', sam),
    ('a0000000-0000-0000-0000-000000000014', alex), ('a0000000-0000-0000-0000-000000000014', ines),
    ('a0000000-0000-0000-0000-000000000015', alex),
    ('a0000000-0000-0000-0000-000000000016', alex)
  on conflict do nothing;

  -- ─── Tâches ───────────────────────────────────────────────────────────────
  insert into public.tasks (id, project_id, title, description, status, priority, assignee_id, due_date, is_blocked, blocked_reason, created_by, completed_at) values
    -- Refonte site vitrine : tous les statuts, retard, blocage, à assigner
    ('b0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000010', 'Ateliers de cadrage avec le client', null, 'done', 'high', alex, current_date - 42, false, null, alex, today - interval '40 days' + interval '17 hours'),
    ('b0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000010', 'Arborescence et parcours', null, 'done', 'normal', ines, current_date - 31, false, null, alex, today - interval '30 days' + interval '16 hours'),
    ('b0000000-0000-0000-0000-000000000103', 'a0000000-0000-0000-0000-000000000010', 'Maquettes desktop', 'Accueil, services, portfolio, blog, contact.', 'done', 'high', ines, current_date - 19, false, null, alex, today - interval '18 days' + interval '18 hours'),
    ('b0000000-0000-0000-0000-000000000104', 'a0000000-0000-0000-0000-000000000010', 'Maquettes mobile', null, 'done', 'normal', ines, current_date - 10, false, null, alex, today - interval '9 days' + interval '15 hours'),
    ('b0000000-0000-0000-0000-000000000105', 'a0000000-0000-0000-0000-000000000010', 'Intégration de la page d''accueil', null, 'in_progress', 'high', sam, current_date + 4, false, null, alex, null),
    ('b0000000-0000-0000-0000-000000000106', 'a0000000-0000-0000-0000-000000000010', 'Formulaire de contact', 'Envoi par e-mail + protection anti-spam.', 'in_progress', 'normal', sam, current_date - 2, false, null, alex, null),
    ('b0000000-0000-0000-0000-000000000107', 'a0000000-0000-0000-0000-000000000010', 'Rédaction des contenus', 'Reprogrammée : le client revoit son offre de services.', 'rescheduled', 'normal', null, current_date + 10, false, null, alex, null),
    ('b0000000-0000-0000-0000-000000000108', 'a0000000-0000-0000-0000-000000000010', 'Optimisation des images', null, 'todo', 'low', ines, current_date + 12, false, null, alex, null),
    ('b0000000-0000-0000-0000-000000000109', 'a0000000-0000-0000-0000-000000000010', 'Mise en place de l''hébergement', null, 'todo', 'high', alex, current_date - 1, true, 'En attente des accès DNS du client.', alex, null),
    ('b0000000-0000-0000-0000-000000000110', 'a0000000-0000-0000-0000-000000000010', 'Recette finale', null, 'todo', 'normal', null, null, false, null, alex, null),
    ('b0000000-0000-0000-0000-000000000111', 'a0000000-0000-0000-0000-000000000010', 'Mentions légales et RGPD', null, 'todo', 'normal', alex, current_date + 15, false, null, alex, null),
    -- App de réservation : projet en retard
    ('b0000000-0000-0000-0000-000000000120', 'a0000000-0000-0000-0000-000000000011', 'Modèle de données', null, 'done', 'high', karim, current_date - 27, false, null, alex, today - interval '25 days' + interval '12 hours'),
    ('b0000000-0000-0000-0000-000000000121', 'a0000000-0000-0000-0000-000000000011', 'Authentification des utilisateurs', null, 'done', 'high', karim, current_date - 15, false, null, alex, today - interval '14 days' + interval '17 hours'),
    ('b0000000-0000-0000-0000-000000000122', 'a0000000-0000-0000-0000-000000000011', 'Calendrier des créneaux', null, 'in_progress', 'high', karim, current_date - 5, false, null, alex, null),
    ('b0000000-0000-0000-0000-000000000123', 'a0000000-0000-0000-0000-000000000011', 'Paiement en ligne', 'Reprogrammé : choix du prestataire de paiement en attente.', 'rescheduled', 'high', alex, current_date + 7, false, null, alex, null),
    ('b0000000-0000-0000-0000-000000000124', 'a0000000-0000-0000-0000-000000000011', 'Notifications par e-mail', null, 'todo', 'normal', karim, current_date + 3, false, null, alex, null),
    ('b0000000-0000-0000-0000-000000000125', 'a0000000-0000-0000-0000-000000000011', 'Tests sur mobile', null, 'todo', 'low', null, current_date + 8, false, null, alex, null),
    -- Dashboard SaaS : projet prévu
    ('b0000000-0000-0000-0000-000000000130', 'a0000000-0000-0000-0000-000000000012', 'Choix de la stack', null, 'todo', 'normal', alex, current_date + 30, false, null, alex, null),
    ('b0000000-0000-0000-0000-000000000131', 'a0000000-0000-0000-0000-000000000012', 'Maquette du tableau de bord', null, 'todo', 'low', ines, current_date + 40, false, null, alex, null),
    -- Audit SEO : projet en pause, tâche bloquée et en retard
    ('b0000000-0000-0000-0000-000000000140', 'a0000000-0000-0000-0000-000000000013', 'Analyse des mots-clés', null, 'done', 'normal', sam, current_date - 72, false, null, alex, today - interval '70 days' + interval '11 hours'),
    ('b0000000-0000-0000-0000-000000000141', 'a0000000-0000-0000-0000-000000000013', 'Audit technique', null, 'in_progress', 'normal', sam, current_date - 10, true, 'Projet en pause : budget à valider par le client.', alex, null),
    ('b0000000-0000-0000-0000-000000000142', 'a0000000-0000-0000-0000-000000000013', 'Plan de contenus', null, 'todo', 'low', null, null, false, null, alex, null),
    -- Boutique en ligne : projet clôturé, toutes les tâches terminées
    ('b0000000-0000-0000-0000-000000000150', 'a0000000-0000-0000-0000-000000000014', 'Configuration de la boutique', null, 'done', 'high', ines, current_date - 78, false, null, alex, today - interval '76 days' + interval '16 hours'),
    ('b0000000-0000-0000-0000-000000000151', 'a0000000-0000-0000-0000-000000000014', 'Import du catalogue', null, 'done', 'normal', ines, current_date - 63, false, null, alex, today - interval '62 days' + interval '14 hours'),
    ('b0000000-0000-0000-0000-000000000152', 'a0000000-0000-0000-0000-000000000014', 'Formation du client', null, 'done', 'normal', alex, current_date - 52, false, null, alex, today - interval '55 days' + interval '10 hours'),
    -- Ancien site : archivé
    ('b0000000-0000-0000-0000-000000000160', 'a0000000-0000-0000-0000-000000000016', 'Maintenance annuelle', null, 'done', 'low', alex, current_date - 125, false, null, alex, today - interval '124 days');

  -- ─── Checklists : partielles, complète, vide ──────────────────────────────
  insert into public.task_checklist_items (task_id, label, done) values
    ('b0000000-0000-0000-0000-000000000104', 'Accueil mobile', true),
    ('b0000000-0000-0000-0000-000000000104', 'Menu et navigation', true),
    ('b0000000-0000-0000-0000-000000000105', 'En-tête et menu', true),
    ('b0000000-0000-0000-0000-000000000105', 'Section services', true),
    ('b0000000-0000-0000-0000-000000000105', 'Section témoignages', false),
    ('b0000000-0000-0000-0000-000000000105', 'Pied de page', false),
    ('b0000000-0000-0000-0000-000000000111', 'Mentions légales', false),
    ('b0000000-0000-0000-0000-000000000111', 'Politique de confidentialité', false),
    ('b0000000-0000-0000-0000-000000000111', 'Bandeau cookies', false),
    ('b0000000-0000-0000-0000-000000000122', 'Vue semaine', true),
    ('b0000000-0000-0000-0000-000000000122', 'Vue jour', true),
    ('b0000000-0000-0000-0000-000000000122', 'Créneaux récurrents', true),
    ('b0000000-0000-0000-0000-000000000122', 'Gestion des fuseaux horaires', false),
    ('b0000000-0000-0000-0000-000000000122', 'Annulation par le client', false);

  -- ─── Commentaires et liens ────────────────────────────────────────────────
  insert into public.task_comments (task_id, author_id, body, created_at) values
    ('b0000000-0000-0000-0000-000000000105', sam, 'La section services est prête, je passe aux témoignages.', now() - interval '1 day 3 hours'),
    ('b0000000-0000-0000-0000-000000000105', alex, 'Parfait. Pense à vérifier le contraste des boutons.', now() - interval '1 day 1 hour'),
    ('b0000000-0000-0000-0000-000000000109', alex, 'Client relancé par e-mail ce matin pour les accès DNS.', now() - interval '5 hours'),
    ('b0000000-0000-0000-0000-000000000123', karim, 'Le client hésite entre deux prestataires, on décale d''une semaine.', now() - interval '2 days'),
    ('b0000000-0000-0000-0000-000000000141', sam, 'J''ai mis l''audit en pause en attendant le feu vert.', now() - interval '9 days');

  insert into public.task_links (task_id, label, url) values
    ('b0000000-0000-0000-0000-000000000103', 'Maquettes', 'https://example.com/maquettes/site-vitrine'),
    ('b0000000-0000-0000-0000-000000000105', 'Page en préproduction', 'https://example.com/preprod'),
    ('b0000000-0000-0000-0000-000000000122', 'Spécification du calendrier', 'https://example.com/specs/calendrier');

  -- ─── Temps passé : plusieurs intervenants sur une même tâche ──────────────
  insert into public.time_entries (task_id, user_id, started_at, ended_at) values
    ('b0000000-0000-0000-0000-000000000101', alex, today - interval '41 days' + interval '9 hours', today - interval '41 days' + interval '10 hours 30 minutes'),
    ('b0000000-0000-0000-0000-000000000102', ines, today - interval '31 days' + interval '14 hours', today - interval '31 days' + interval '17 hours'),
    ('b0000000-0000-0000-0000-000000000103', ines, today - interval '20 days' + interval '9 hours', today - interval '20 days' + interval '11 hours'),
    ('b0000000-0000-0000-0000-000000000103', ines, today - interval '19 days' + interval '14 hours', today - interval '19 days' + interval '17 hours'),
    ('b0000000-0000-0000-0000-000000000103', alex, today - interval '19 days' + interval '16 hours', today - interval '19 days' + interval '16 hours 45 minutes'),
    ('b0000000-0000-0000-0000-000000000104', ines, today - interval '10 days' + interval '9 hours', today - interval '10 days' + interval '11 hours 30 minutes'),
    ('b0000000-0000-0000-0000-000000000105', sam, today - interval '2 days' + interval '9 hours', today - interval '2 days' + interval '11 hours 30 minutes'),
    ('b0000000-0000-0000-0000-000000000105', sam, today - interval '1 day' + interval '14 hours', today - interval '1 day' + interval '16 hours'),
    ('b0000000-0000-0000-0000-000000000105', alex, today - interval '1 day' + interval '10 hours', today - interval '1 day' + interval '11 hours'),
    ('b0000000-0000-0000-0000-000000000105', ines, today - interval '1 day' + interval '11 hours', today - interval '1 day' + interval '11 hours 40 minutes'),
    ('b0000000-0000-0000-0000-000000000106', sam, today - interval '3 days' + interval '15 hours', today - interval '3 days' + interval '16 hours 20 minutes'),
    ('b0000000-0000-0000-0000-000000000109', alex, today - interval '1 day' + interval '17 hours', today - interval '1 day' + interval '17 hours 30 minutes'),
    ('b0000000-0000-0000-0000-000000000120', karim, today - interval '26 days' + interval '9 hours', today - interval '26 days' + interval '15 hours'),
    ('b0000000-0000-0000-0000-000000000121', karim, today - interval '15 days' + interval '9 hours', today - interval '15 days' + interval '13 hours'),
    ('b0000000-0000-0000-0000-000000000122', karim, today - interval '3 days' + interval '9 hours', today - interval '3 days' + interval '12 hours'),
    ('b0000000-0000-0000-0000-000000000122', karim, today - interval '2 days' + interval '14 hours', today - interval '2 days' + interval '16 hours'),
    ('b0000000-0000-0000-0000-000000000122', alex, today - interval '2 days' + interval '16 hours', today - interval '2 days' + interval '16 hours 50 minutes'),
    ('b0000000-0000-0000-0000-000000000140', sam, today - interval '71 days' + interval '9 hours', today - interval '71 days' + interval '12 hours'),
    ('b0000000-0000-0000-0000-000000000150', ines, today - interval '77 days' + interval '9 hours', today - interval '77 days' + interval '16 hours'),
    ('b0000000-0000-0000-0000-000000000151', ines, today - interval '63 days' + interval '10 hours', today - interval '63 days' + interval '13 hours');

  -- Pauses (comptées à part du temps de travail).
  insert into public.time_entries (task_id, user_id, started_at, ended_at, kind) values
    ('b0000000-0000-0000-0000-000000000105', sam, today - interval '2 days' + interval '11 hours 30 minutes', today - interval '2 days' + interval '11 hours 50 minutes', 'pause'),
    ('b0000000-0000-0000-0000-000000000105', sam, today - interval '1 day' + interval '16 hours', today - interval '1 day' + interval '16 hours 10 minutes', 'pause'),
    ('b0000000-0000-0000-0000-000000000122', karim, today - interval '3 days' + interval '12 hours', today - interval '3 days' + interval '13 hours', 'pause');

  -- Chef de projet : Inès pilote la refonte du site vitrine.
  update public.project_members set role = 'manager'
  where project_id = 'a0000000-0000-0000-0000-000000000010' and user_id = ines;

  -- Plusieurs collaborateurs par tâche, avec le temps estimé de chacun.
  insert into public.task_assignees (task_id, user_id, estimated_minutes) values
    ('b0000000-0000-0000-0000-000000000105', sam, 360),
    ('b0000000-0000-0000-0000-000000000105', alex, 60),
    ('b0000000-0000-0000-0000-000000000105', ines, 30),
    ('b0000000-0000-0000-0000-000000000106', sam, 60),
    ('b0000000-0000-0000-0000-000000000122', karim, 240),
    ('b0000000-0000-0000-0000-000000000122', alex, 60)
  on conflict (task_id, user_id) do update set estimated_minutes = excluded.estimated_minutes;

  -- Budgets d'heures (la refonte dépasse le sien) et jalons.
  update public.projects set budget_minutes = 15 * 60 where id = 'a0000000-0000-0000-0000-000000000010';
  update public.projects set budget_minutes = 60 * 60 where id = 'a0000000-0000-0000-0000-000000000011';
  insert into public.project_milestones (project_id, title, due_date, done_at) values
    ('a0000000-0000-0000-0000-000000000010', 'Cadrage terminé', current_date - 40, today - interval '40 days'),
    ('a0000000-0000-0000-0000-000000000010', 'Maquettes validées', current_date - 9, today - interval '9 days'),
    ('a0000000-0000-0000-0000-000000000010', 'Recette client', current_date - 1, null),
    ('a0000000-0000-0000-0000-000000000010', 'Mise en ligne', current_date + 14, null);

  -- Un chronomètre en cours (Inès sur « Optimisation des images »), si elle n'en a pas déjà un.
  insert into public.time_entries (task_id, user_id, started_at)
  select 'b0000000-0000-0000-0000-000000000108', ines, now() - interval '25 minutes'
  where not exists (select 1 from public.time_entries where user_id = ines and ended_at is null);
end;
$$;
