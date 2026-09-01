-- Histórico opcional das descrições feitas pela IA.
-- Cada usuário só consegue acessar o próprio histórico.

create table if not exists public.ai_food_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists ai_food_history_user_created_idx
  on public.ai_food_history (user_id, created_at desc);

alter table public.ai_food_history enable row level security;

drop policy if exists "Users can view own AI food history" on public.ai_food_history;
create policy "Users can view own AI food history"
  on public.ai_food_history for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own AI food history" on public.ai_food_history;
create policy "Users can insert own AI food history"
  on public.ai_food_history for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own AI food history" on public.ai_food_history;
create policy "Users can update own AI food history"
  on public.ai_food_history for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own AI food history" on public.ai_food_history;
create policy "Users can delete own AI food history"
  on public.ai_food_history for delete
  using (auth.uid() = user_id);
