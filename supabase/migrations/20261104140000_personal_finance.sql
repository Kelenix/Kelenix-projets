-- Espace financier personnel : revenus variables, répartition (règle personnalisable), dépenses
-- ponctuelles et récurrentes, fonds d'urgence, investissements, reports, objectifs, prévisions.
-- Montants en centimes entiers (aucun arrondi flottant). Données strictement privées : chaque ligne
-- appartient à un administrateur et n'est visible que de lui (pas même des autres administrateurs).

create type public.fin_category as enum ('growth', 'stability', 'essentials', 'reward');

-- Propriétaire des données financières : l'utilisateur connecté, s'il est administrateur.
create function public.is_finance_user(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user = auth.uid() and public.is_owner();
$$;
revoke execute on function public.is_finance_user(uuid) from public, anon;

-- ─── Paramètres ─────────────────────────────────────────────────────────────
create table public.fin_settings (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  emergency_goal_cents bigint check (emergency_goal_cents between 0 and 100000000000),
  -- Seuil (en %) à partir duquel un budget est signalé « presque épuisé ».
  alert_threshold integer not null default 80 check (alert_threshold between 50 and 100),
  -- Alertes désactivées (clés : near_limit, overspent, recurring, expected_income, goal_reached, empty_month).
  disabled_alerts text[] not null default '{}',
  -- Action proposée par défaut pour le reliquat de chaque catégorie en fin de mois.
  carry_defaults jsonb not null default '{"growth": "keep", "stability": "keep", "essentials": "next_month", "reward": "next_month"}',
  updated_at timestamptz not null default now()
);

-- ─── Règles de répartition ─────────────────────────────────────────────────
-- scope « from » : règle par défaut à partir de ce mois (les mois antérieurs gardent l'ancienne) ;
-- scope « only » : répartition propre à ce seul mois.
create table public.fin_allocation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  scope text not null check (scope in ('from', 'only')),
  growth numeric(5, 2) not null check (growth between 0 and 100),
  stability numeric(5, 2) not null check (stability between 0 and 100),
  essentials numeric(5, 2) not null check (essentials between 0 and 100),
  reward numeric(5, 2) not null check (reward between 0 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, month, scope),
  constraint fin_allocation_rules_total check (growth + stability + essentials + reward = 100)
);

-- ─── Revenus ────────────────────────────────────────────────────────────────
create table public.fin_incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  amount_cents bigint not null check (amount_cents between 1 and 100000000000),
  received_on date not null,
  source text not null check (char_length(btrim(source)) between 1 and 120),
  status text not null default 'received' check (status in ('received', 'expected')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index fin_incomes_user_date_idx on public.fin_incomes (user_id, received_on);

-- Revenus prévisionnels saisis mois par mois (sinon : moyenne historique, signalée comme estimation).
create table public.fin_forecasts (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  amount_cents bigint not null check (amount_cents between 0 and 100000000000),
  primary key (user_id, month)
);

-- ─── Dépenses ───────────────────────────────────────────────────────────────
create table public.fin_recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  amount_cents bigint not null check (amount_cents between 1 and 100000000000),
  description text not null check (char_length(btrim(description)) between 1 and 200),
  category public.fin_category not null,
  subcategory text check (char_length(subcategory) <= 80),
  payment_method text check (char_length(payment_method) <= 40),
  day_of_month integer not null check (day_of_month between 1 and 28),
  start_month date not null check (extract(day from start_month) = 1),
  end_month date check (end_month is null or (extract(day from end_month) = 1 and end_month >= start_month)),
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.fin_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  amount_cents bigint not null check (amount_cents between 1 and 100000000000),
  spent_on date not null,
  description text not null check (char_length(btrim(description)) between 1 and 200),
  category public.fin_category not null,
  subcategory text check (char_length(subcategory) <= 80),
  payment_method text check (char_length(payment_method) <= 40),
  note text check (char_length(note) <= 500),
  recurring_id uuid,
  created_at timestamptz not null default now(),
  -- Une échéance récurrente appartient forcément au même utilisateur.
  foreign key (recurring_id, user_id) references public.fin_recurring_expenses (id, user_id) on delete set null (recurring_id)
);
create index fin_expenses_user_date_idx on public.fin_expenses (user_id, spent_on);

-- ─── Stabilité : fonds d'urgence ───────────────────────────────────────────
create table public.fin_savings_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('deposit', 'withdrawal')),
  amount_cents bigint not null check (amount_cents between 1 and 100000000000),
  occurred_on date not null,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index fin_savings_user_date_idx on public.fin_savings_movements (user_id, occurred_on);

-- ─── Croissance : actifs, versements / retraits, valeurs ───────────────────
create table public.fin_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  asset_type text not null check (asset_type in ('stocks', 'etf', 'business', 'real_estate', 'crypto', 'other')),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.fin_investment_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  asset_id uuid not null,
  kind text not null check (kind in ('contribution', 'withdrawal')),
  amount_cents bigint not null check (amount_cents between 1 and 100000000000),
  fees_cents bigint not null default 0 check (fees_cents between 0 and 100000000000),
  occurred_on date not null,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  foreign key (asset_id, user_id) references public.fin_assets (id, user_id) on delete cascade
);
create index fin_investments_user_date_idx on public.fin_investment_movements (user_id, occurred_on);

create table public.fin_asset_valuations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  asset_id uuid not null,
  value_cents bigint not null check (value_cents between 0 and 100000000000),
  valued_on date not null,
  unique (asset_id, valued_on),
  foreign key (asset_id, user_id) references public.fin_assets (id, user_id) on delete cascade
);

-- ─── Reports et transferts internes (jamais comptés comme revenus) ─────────
create table public.fin_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  from_category public.fin_category not null,
  action text not null check (action in ('next_month', 'growth', 'stability', 'keep')),
  amount_cents bigint not null check (amount_cents between 1 and 100000000000),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  constraint fin_transfers_distinct check (action <> from_category::text)
);
create index fin_transfers_user_month_idx on public.fin_transfers (user_id, month);

-- ─── Objectifs ──────────────────────────────────────────────────────────────
create table public.fin_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  target_cents bigint not null check (target_cents between 1 and 100000000000),
  -- Progression : saisie à la main, ou liée au fonds d'urgence / aux sommes investies.
  current_cents bigint not null default 0 check (current_cents between 0 and 100000000000),
  linked text not null default 'none' check (linked in ('none', 'stability', 'growth')),
  due_date date,
  created_at timestamptz not null default now()
);

-- ─── RLS : chaque ligne n'est accessible qu'à son propriétaire administrateur ─
do $$
declare
  t text;
begin
  foreach t in array array[
    'fin_settings', 'fin_allocation_rules', 'fin_incomes', 'fin_forecasts', 'fin_recurring_expenses',
    'fin_expenses', 'fin_savings_movements', 'fin_assets', 'fin_investment_movements',
    'fin_asset_valuations', 'fin_transfers', 'fin_goals'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_finance_user(user_id)) with check (public.is_finance_user(user_id))',
      t || '_owner', t
    );
  end loop;
end;
$$;
