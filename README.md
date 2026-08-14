# 🍽️ Calorias & Água

App web para registrar calorias diárias e consumo de água, com login, sincronização na nuvem (Supabase), metas personalizadas e painel administrativo.

## ✨ Recursos

- 🔐 Login e cadastro com Supabase Auth
- 🎯 Goal / onboarding profissional com peso, altura, idade, sexo, atividade e objetivo
- 🧮 Estimativa automática de calorias usando Mifflin-St Jeor + nível de atividade
- 💧 Meta de água estimada a partir do peso
- ✏️ Ajuste manual das metas de kcal e água
- 🍽️ Registro de refeições e alimentos
- 📊 Histórico com gráfico de 7 ou 30 dias
- 🧠 Insights via Gemini
- 🛡️ Painel `/admin` protegido por e-mail e service role no servidor
- 🌙 Interface dark responsiva
- ☁️ Dados sincronizados em qualquer dispositivo

## 🚀 Como rodar

### 1. Instalar dependências

```bash
npm install
npm run dev
```

### 2. Supabase

Configure no `.env` do front:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
VITE_ADMIN_EMAIL=seu_email_admin
```

Para as funções serverless:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
ADMIN_EMAIL=seu_email_admin
GEMINI_API_KEY=sua_chave
GEMINI_MODEL=gemini-1.5-flash
```

**Nunca use `SUPABASE_SERVICE_ROLE_KEY` com prefixo `VITE_`.** Ela deve existir somente no ambiente server-side (ex.: Vercel).

### 3. Banco de dados

Rode primeiro o SQL original do projeto para criar `profiles`, `water_entries` e `food_entries`. Depois execute:

```text
supabase/migrations/20260814_goals_admin.sql
```

Essa migração adiciona os campos do Goal, a flag de onboarding e índices usados no painel administrativo.

### 4. Vercel

Cadastre no projeto da Vercel as mesmas variáveis de ambiente do `.env`, incluindo obrigatoriamente `SUPABASE_SERVICE_ROLE_KEY` e `ADMIN_EMAIL` para o painel administrativo.

## 🎯 Fluxo do Goal

Ao entrar pela primeira vez, o usuário vai para `/goal` e informa seus dados básicos. O app calcula uma meta inicial de calorias e água, mostra o resultado e permite substituir os valores manualmente.

Depois do onboarding, o menu principal apresenta:

- Dashboard
- Meu Goal
- Admin (somente para o e-mail configurado como administrador)

## 🔐 Segurança do Admin

O menu do admin é exibido no front apenas para `VITE_ADMIN_EMAIL`, mas a proteção real acontece em `api/admin.js`: o servidor valida o JWT do Supabase, compara o e-mail com `ADMIN_EMAIL` e só então usa `SUPABASE_SERVICE_ROLE_KEY` para ler a visão agregada dos usuários.

Assim, um usuário comum não consegue obter os dados administrativos apenas alterando a interface do navegador.

## 🧮 Cálculo das metas

O cálculo inicial usa a equação de Mifflin-St Jeor para estimar o gasto basal, multiplica pelo nível de atividade e aplica um ajuste moderado de acordo com o objetivo:

- Perder peso: -400 kcal/dia
- Manter peso: 0 kcal/dia
- Ganhar massa: +300 kcal/dia

A hidratação inicial usa aproximadamente 35 ml/kg/dia, arredondada para uma meta prática.

Essas estimativas são um ponto de partida e não substituem avaliação profissional individual.

## 📁 Estrutura principal

```text
calorias-diarias/
├── api/
│   ├── admin.js
│   └── gemini.js
├── supabase/
│   └── migrations/
│       └── 20260814_goals_admin.sql
├── src/
│   ├── components/
│   │   ├── GoalSetup.jsx
│   │   └── ...
│   ├── contexts/
│   │   └── AuthContext.jsx
│   ├── lib/
│   │   ├── calculations.js
│   │   └── supabase.js
│   ├── pages/
│   │   ├── AdminPage.jsx
│   │   ├── GoalPage.jsx
│   │   └── Dashboard.jsx
│   ├── professional.css
│   └── styles.css
└── ...
```

## 🛠 Stack

- React 18 + Vite 5
- React Router 6
- Supabase JS 2
- Gemini via SDK oficial
- Open Food Facts / TBCA
- Chart.js

## 📜 Licença

Uso pessoal.
