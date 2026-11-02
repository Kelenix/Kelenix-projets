-- Nouveau statut de tâche « Reprogrammé » (tâche décalée, toujours ouverte).
alter type public.task_status add value if not exists 'rescheduled' before 'done';
