-- Retire les données de volume (projets « (test NNN) » et leurs tâches, clients « (test) »).
delete from public.projects where name ~ '\(test \d{3}\)$';
delete from public.clients where name like '% (test)';
