-- Execute no Supabase SQL Editor.
-- Mantém os dados existentes e adiciona as informações necessárias para o Goal.

alter table public.profiles
  add column if not exists weight_kg numeric(6,2),
  add column if not exists height_cm integer,
  add column if not exists age integer,
  add column if not exists sex text,
  add column if not exists activity_level text,
  add column if not exists goal text,
  add column if not exists onboarding_complete boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_sex_check;
alter table public.profiles
  add constraint profiles_sex_check
  check (sex is null or sex in ('male', 'female'));

alter table public.profiles
  drop constraint if exists profiles_activity_level_check;
alter table public.profiles
  add constraint profiles_activity_level_check
  check (activity_level is null or activity_level in ('sedentary', 'light', 'moderate', 'high'));

alter table public.profiles
  drop constraint if exists profiles_goal_check;
alter table public.profiles
  add constraint profiles_goal_check
  check (goal is null or goal in ('lose', 'maintain', 'gain'));

-- Índice útil para o painel administrativo.
create index if not exists profiles_goal_idx on public.profiles (goal);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

-- Proteção: o usuário continua podendo alterar apenas o próprio perfil.
-- O endpoint /api/admin usa a service role exclusivamente no servidor.
