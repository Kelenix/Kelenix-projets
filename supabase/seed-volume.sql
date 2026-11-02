-- Données de VOLUME fictives (base locale uniquement) : 120 projets « (test NNN) » et 25 clients,
-- pour voir l'affichage avec beaucoup d'éléments. Tirage pseudo-aléatoire reproductible.
-- Appliquer : pnpm db:seed-volume (sans rien effacer ; ne fait rien si déjà présent).
-- Retirer : pnpm db:unseed-volume

do $$
declare
  kinds constant text[] := array['Site vitrine', 'Application mobile', 'Boutique en ligne', 'Dashboard SaaS', 'API',
    'Intranet', 'Landing page', 'Refonte', 'Portail client', 'Application de réservation', 'Blog', 'Back-office'];
  companies constant text[] := array['Atelier Nova', 'Café Central', 'Garage Dupont', 'Studio Pixel', 'Cabinet Lefèvre',
    'Ferme des Lilas', 'Clinique Horizon', 'Agence Sillage', 'Librairie Page 9', 'Salle Olympe', 'Domaine Belair',
    'École Arpège', 'Fleurs & Co', 'Optique Vue', 'Transports Rapides', 'Hôtel du Lac', 'Brasserie Lune',
    'Cabinet Avocat Roy', 'Pressing Éclat', 'Immo Plus', 'Yoga Zen', 'Mécanique Pro', 'Pâtisserie Dorée',
    'Coworking Ruche', 'Studio Danse'];
  task_titles constant text[] := array['Cadrage avec le client', 'Maquettes', 'Intégration front', 'API et base de données',
    'Authentification', 'Formulaire de contact', 'Paiement en ligne', 'Tests et recette', 'Rédaction des contenus',
    'Optimisation SEO', 'Mise en ligne', 'Formation du client', 'Corrections après retours', 'Tableau de bord',
    'Notifications', 'Accessibilité', 'Performance', 'Sauvegardes', 'Nom de domaine et DNS', 'Documentation'];
  open_statuses constant public.task_status[] := array['todo', 'todo', 'in_progress', 'in_progress', 'rescheduled', 'done', 'done'];
  people uuid[] := array(select id from public.profiles order by created_at);
  owner_id uuid := (select id from public.profiles where role = 'owner' order by created_at limit 1);
  client_ids uuid[];
  members uuid[];
  project_id uuid;
  task_id uuid;
  roll float;
  p_status public.project_status;
  t_status public.task_status;
  task_count int;
  blocked boolean;
begin
  if exists (select 1 from public.projects where name like '%(test 001)') then
    raise notice 'Données de volume déjà présentes : rien à faire.';
    return;
  end if;
  perform setseed(0.42);

  insert into public.clients (name, company, email, notes)
  select format('Contact %s (test)', c), c,
         case when random() < 0.7 then format('contact@%s.test', lower(regexp_replace(c, '[^A-Za-z]', '', 'g'))) end,
         case when random() < 0.4 then 'Client fictif généré pour les tests de volume.' end
  from unnest(companies) c;
  client_ids := array(select id from public.clients where name like '% (test)' order by name);

  for i in 1..120 loop
    roll := random();
    p_status := case when roll < 0.4 then 'in_progress' when roll < 0.6 then 'planned'
                     when roll < 0.7 then 'paused' else 'done' end;

    insert into public.projects (name, description, client_id, due_date, status, archived_at)
    values (
      format('%s %s (test %s)', kinds[1 + (i % array_length(kinds, 1))], companies[1 + ((i * 7) % array_length(companies, 1))], lpad(i::text, 3, '0')),
      case when random() < 0.6 then 'Projet fictif généré pour vérifier l''affichage avec beaucoup de données.' end,
      case when random() < 0.85 then client_ids[1 + ((i * 7) % array_length(client_ids, 1))] end,
      case when random() < 0.8 then current_date + (floor(random() * 120) - 40)::int end,
      p_status,
      case when roll >= 0.9 then now() - (floor(random() * 90) || ' days')::interval end
    )
    returning id into project_id;

    -- Membres : le propriétaire, plus chaque autre personne avec une chance sur deux.
    members := array(select p from unnest(people) p where p = owner_id or random() < 0.5);
    insert into public.project_members (project_id, user_id)
    select project_id, m from unnest(members) m
    on conflict do nothing;

    task_count := case when random() < 0.08 then 0 else 1 + floor(random() * 14)::int end;
    for j in 1..task_count loop
      t_status := case when p_status = 'done' then 'done' else open_statuses[1 + floor(random() * 7)::int] end;
      blocked := t_status <> 'done' and random() < 0.08;
      insert into public.tasks (project_id, title, status, priority, assignee_id, due_date, is_blocked, blocked_reason, created_by, completed_at)
      values (
        project_id,
        task_titles[1 + ((i + j * 3) % array_length(task_titles, 1))],
        t_status,
        (array['low', 'normal', 'normal', 'high'])[1 + floor(random() * 4)::int]::public.task_priority,
        case when random() < 0.85 then members[1 + floor(random() * array_length(members, 1))::int] end,
        case when random() < 0.8 then current_date + (floor(random() * 60) - 20)::int end,
        blocked,
        case when blocked then 'En attente d''un retour du client.' end,
        owner_id,
        case when t_status = 'done' then now() - (floor(random() * 84) || ' days')::interval end
      )
      returning id into task_id;

      if random() < 0.35 then
        insert into public.task_checklist_items (task_id, label, done)
        select task_id, format('Étape %s', k), t_status = 'done' or random() < 0.5
        from generate_series(1, 1 + floor(random() * 6)::int) k;
      end if;

      if random() < 0.4 then
        insert into public.time_entries (task_id, user_id, started_at, ended_at)
        select task_id, s.who, s.start, s.start + ((15 + floor(random() * 225)) || ' minutes')::interval
        from (
          select members[1 + floor(random() * array_length(members, 1))::int] as who,
                 date_trunc('day', now()) - (floor(random() * 84) || ' days')::interval + interval '9 hours' as start
          from generate_series(1, 1 + floor(random() * 4)::int)
        ) s;
      end if;
    end loop;
  end loop;
end;
$$;
