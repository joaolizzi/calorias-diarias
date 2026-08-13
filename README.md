# 🍽️ Calorias & Água

App web para registrar calorias diárias e consumo de água, com login e
sincronização na nuvem (Supabase) e busca automática de calorias via
**Open Food Facts**.

## ✨ Recursos

- 🔐 Login e cadastro (Supabase Auth)
- 💧 Registro rápido de água (botões 100/200/250/500/700/1000 ml + custom)
- 🍽️ Busca de alimentos via Open Food Facts (kcal/100g) com fallback manual
- 🍳 Refeições separadas: café / almoço / jantar / lanche
- 🎯 Metas diárias configuráveis (kcal e ml)
- 📊 Histórico com gráfico de barras (kcal vs água) — 7 ou 30 dias
- 🌙 Tema escuro inspirado em `agua-diaria/`
- ☁️ Dados sincronizados em qualquer dispositivo (Postgres no Supabase)

## 🚀 Como rodar

### 1. Instalar dependências

```bash
cd calorias-diarias
npm install
```

### 2. Criar projeto no Supabase

1. Vá em https://supabase.com e crie um projeto gratuito (plano Free)
2. Em **Settings → API**, copie:
   - **Project URL** (algo como `https://xxxxx.supabase.co`)
   - **anon public key** (a chave JWT `eyJ...`)
3. Renomeie `.env.example` para `.env` e preencha:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 3. Criar tabelas no banco

1. No Supabase, vá em **SQL Editor → New query**
2. Cole e rode o SQL abaixo:

```sql
-- Tabela de perfil do usuário (1:1 com auth.users)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  daily_kcal_goal int default 2000,
  daily_water_goal_ml int default 2000,
  created_at timestamptz default now()
);

-- Entradas de água
create table public.water_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  day date not null,
  ml int not null check (ml > 0 and ml <= 5000),
  consumed_at timestamptz default now()
);
create index on water_entries (user_id, day);

-- Entradas de comida
create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  day date not null,
  meal text not null check (meal in ('breakfast','lunch','dinner','snack')),
  name text not null,
  kcal int not null check (kcal >= 0),
  grams int,
  consumed_at timestamptz default now()
);
create index on food_entries (user_id, day);

-- Segurança: cada usuário só vê/edita os próprios dados
alter table profiles enable row level security;
alter table water_entries enable row level security;
alter table food_entries enable row level security;

create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own water" on water_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own food" on food_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

3. (Opcional) **Authentication → Providers**: confirme que **Email** está
   habilitado. Para testar localmente, **desative** "Confirm email" em
   Authentication → Sign In/Up → Email.

### 4. Rodar

```bash
npm run dev
```

Abra http://localhost:5173

## 🧪 Fluxo de teste

1. Criar conta (email + senha)
2. Adicionar 3 copos d'água — barra de água sobe
3. Buscar "banana" — ver resultados da Open Food Facts
4. Adicionar "banana 100g café da manhã" — kcal somam
5. Trocar meta para 1500 kcal — pill de status muda
6. Recarregar página — dados persistem (vindos do Supabase)
7. Abrir em outro navegador — login traz os mesmos dados

## 📁 Estrutura

```
calorias-diarias/
├── index.html              # Entry (Chart.js via CDN)
├── vite.config.js
├── package.json
├── .env.example
├── src/
│   ├── main.jsx
│   ├── App.jsx             # Router + AuthProvider
│   ├── styles.css          # Tema dark + tokens
│   ├── lib/
│   │   ├── supabase.js     # Cliente + queries
│   │   ├── foods.js        # Open Food Facts wrapper
│   │   └── dates.js        # Helpers de data
│   ├── contexts/
│   │   └── AuthContext.jsx
│   ├── components/
│   │   ├── AuthGate.jsx
│   │   ├── Header.jsx
│   │   ├── ProgressCard.jsx
│   │   ├── WaterTracker.jsx
│   │   ├── FoodSearch.jsx
│   │   ├── AddFoodModal.jsx
│   │   ├── FoodSection.jsx
│   │   ├── GoalsSettings.jsx
│   │   ├── HistoryChart.jsx
│   │   ├── StatTile.jsx
│   │   └── Toast.jsx
│   └── pages/
│       └── Dashboard.jsx
```

## 🛠 Stack

- **React 18** + **Vite 5**
- **React Router 6**
- **Supabase JS 2** (Auth + Postgres)
- **Open Food Facts** (busca de kcal, gratuita, sem chave)
- **Chart.js 4** (via CDN)
- Sem outras dependências externas

## 🔒 Segurança

A `anon key` do Supabase é pública por design (vai pro bundle JS). A segurança
real vem do **Row Level Security (RLS)** que configuramos acima — cada query
no Postgres verifica `auth.uid() = user_id`, então mesmo com a chave pública
um usuário só consegue ler/escrever os próprios dados.

## ⚠️ Limitações conhecidas

- Open Food Facts cobre bem produtos industrializados, mas pode falhar em
  pratos caseiros. Por isso o app sempre oferece o botão
  **"Não achei — adicionar manualmente"**.
- Gráfico depende do Chart.js via CDN — sem internet, o app continua
  funcional, só não mostra o histórico visual.
- Não há recuperação de senha configurada (Supabase suporta, mas exige
  template de email — fora do MVP).

## 📜 Licença

Uso pessoal.
