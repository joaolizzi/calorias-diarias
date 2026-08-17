-- Plano semanal de treino por usuário.
-- Execute no Supabase SQL Editor.

create table if not exists public.workout_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  days jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.workout_plans enable row level security;

drop policy if exists "workout_plans_select_own" on public.workout_plans;
drop policy if exists "workout_plans_insert_own" on public.workout_plans;
drop policy if exists "workout_plans_update_own" on public.workout_plans;
drop policy if exists "workout_plans_delete_own" on public.workout_plans;

create policy "workout_plans_select_own"
  on public.workout_plans for select
  using (auth.uid() = user_id);

create policy "workout_plans_insert_own"
  on public.workout_plans for insert
  with check (auth.uid() = user_id);

create policy "workout_plans_update_own"
  on public.workout_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "workout_plans_delete_own"
  on public.workout_plans for delete
  using (auth.uid() = user_id);

create or replace function public.touch_workout_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workout_plans_updated_at on public.workout_plans;
create trigger workout_plans_updated_at
before update on public.workout_plans
for each row execute function public.touch_workout_plans_updated_at();
