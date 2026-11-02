-- Le serveur (clé service, sans utilisateur connecté) peut fixer le rôle d'un profil :
-- l'API d'administration enregistre app_metadata après la création du compte, le trigger
-- d'insertion ne voit donc pas toujours le rôle demandé.
create or replace function public.guard_profile_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.email is distinct from old.email then
    raise exception 'L''e-mail ne peut pas être modifié ici.';
  end if;
  if new.role is distinct from old.role then
    if not public.is_owner() then
      raise exception 'Seul un propriétaire peut modifier un rôle.';
    end if;
    if new.id = auth.uid() then
      raise exception 'Vous ne pouvez pas modifier votre propre rôle.';
    end if;
  end if;
  return new;
end;
$$;
