-- Exécuté une seule fois, à la création de la base : mots de passe des rôles Supabase et
-- paramètres JWT (valeurs lues dans l'environnement du conteneur, jamais écrites ici).
\set pgpass `echo "$PGPASSWORD"`
\set jwt_secret `echo "$JWT_SECRET"`
\set jwt_exp `echo "$JWT_EXP"`

ALTER DATABASE postgres SET "app.settings.jwt_secret" TO :'jwt_secret';
ALTER DATABASE postgres SET "app.settings.jwt_exp" TO :'jwt_exp';

ALTER USER postgres WITH PASSWORD :'pgpass';
ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
