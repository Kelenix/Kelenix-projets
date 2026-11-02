-- Données de DÉMONSTRATION fictives — base locale uniquement (`supabase db reset`).
-- Ne jamais appliquer en production. Comptes de démo :
--   propriétaire   : demo.owner@kelenix.test  / KelenixDemo2026!
--   collaborateur  : demo.collab@kelenix.test / KelenixDemo2026!

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'demo.owner@kelenix.test', extensions.crypt('KelenixDemo2026!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"role":"owner"}', '{"full_name":"Alex Martin (démo)"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'demo.collab@kelenix.test', extensions.crypt('KelenixDemo2026!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"role":"collaborator"}', '{"full_name":"Sam Leroy (démo)"}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
select gen_random_uuid(), id, id::text,
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users
where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

insert into public.clients (id, name, company, email, notes) values
  ('c0000000-0000-0000-0000-000000000001', 'Julie Bernard (démo)', 'Atelier Fictif', 'julie@exemple.test', 'Client de démonstration.'),
  ('c0000000-0000-0000-0000-000000000002', 'Marc Petit (démo)', null, null, null);

insert into public.projects (id, name, description, client_id, due_date, status) values
  ('a0000000-0000-0000-0000-000000000001', 'Site e-commerce (démo)', 'Boutique en ligne de démonstration.',
   'c0000000-0000-0000-0000-000000000001', current_date + 30, 'in_progress'),
  ('a0000000-0000-0000-0000-000000000002', 'Application mobile (démo)', null,
   'c0000000-0000-0000-0000-000000000002', current_date + 60, 'planned');

insert into public.project_members (project_id, user_id) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111');

insert into public.tasks (project_id, title, status, priority, assignee_id, due_date, is_blocked, blocked_reason, created_by, completed_at) values
  ('a0000000-0000-0000-0000-000000000001', 'Maquettes des pages produit', 'done', 'normal', '11111111-1111-1111-1111-111111111111', current_date - 5, false, null, '11111111-1111-1111-1111-111111111111', now() - interval '12 days'),
  ('a0000000-0000-0000-0000-000000000001', 'Intégration du paiement', 'in_progress', 'high', '22222222-2222-2222-2222-222222222222', current_date + 3, true, 'En attente des accès du client.', '11111111-1111-1111-1111-111111111111', null),
  ('a0000000-0000-0000-0000-000000000001', 'Rédiger les mentions légales', 'todo', 'low', null, current_date - 1, false, null, '11111111-1111-1111-1111-111111111111', null),
  ('a0000000-0000-0000-0000-000000000002', 'Atelier de cadrage', 'todo', 'normal', '11111111-1111-1111-1111-111111111111', current_date + 7, false, null, '11111111-1111-1111-1111-111111111111', null);

insert into public.task_checklist_items (task_id, label, done)
select id, item.label, item.done
from public.tasks,
     (values ('Créer le compte marchand', true), ('Configurer les clés de test', false), ('Tester un paiement complet', false))
       as item (label, done)
where title = 'Intégration du paiement';

