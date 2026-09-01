create table if not exists public.finance_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_balance numeric(14,2) not null default 0 check (current_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense')),
  description text not null,
  category text not null default 'Outros',
  amount numeric(14,2) not null check (amount > 0),
  transaction_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists finance_transactions_user_date_idx on public.finance_transactions(user_id, transaction_date desc);

alter table public.finance_settings enable row level security;
alter table public.finance_transactions enable row level security;

drop policy if exists "Users can read own finance settings" on public.finance_settings;
drop policy if exists "Users can insert own finance settings" on public.finance_settings;
drop policy if exists "Users can update own finance settings" on public.finance_settings;
drop policy if exists "Users can read own finance transactions" on public.finance_transactions;
drop policy if exists "Users can insert own finance transactions" on public.finance_transactions;
drop policy if exists "Users can delete own finance transactions" on public.finance_transactions;

create policy "Users can read own finance settings" on public.finance_settings for select using (auth.uid() = user_id);
create policy "Users can insert own finance settings" on public.finance_settings for insert with check (auth.uid() = user_id);
create policy "Users can update own finance settings" on public.finance_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can read own finance transactions" on public.finance_transactions for select using (auth.uid() = user_id);
create policy "Users can insert own finance transactions" on public.finance_transactions for insert with check (auth.uid() = user_id);
create policy "Users can delete own finance transactions" on public.finance_transactions for delete using (auth.uid() = user_id);
