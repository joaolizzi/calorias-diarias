alter table public.profiles
  add column if not exists daily_protein_goal_g numeric(8,2) not null default 150,
  add column if not exists daily_carbs_goal_g numeric(8,2) not null default 200,
  add column if not exists daily_fat_goal_g numeric(8,2) not null default 65;

alter table public.food_entries
  add column if not exists protein_g numeric(8,2) not null default 0,
  add column if not exists carbs_g numeric(8,2) not null default 0,
  add column if not exists fat_g numeric(8,2) not null default 0,
  add column if not exists source text,
  add column if not exists confidence text;

update public.profiles
set daily_protein_goal_g = greatest(60, round((coalesce(weight_kg, 70) * 2.0)::numeric, 1)),
    daily_fat_goal_g = greatest(40, round((coalesce(weight_kg, 70) * 0.8)::numeric, 1));

update public.profiles
set daily_carbs_goal_g = greatest(
  0,
  round(((coalesce(daily_kcal_goal, 2000) - daily_protein_goal_g * 4 - daily_fat_goal_g * 9) / 4.0)::numeric, 1)
);

comment on column public.food_entries.protein_g is 'Proteína total da porção registrada, em gramas';
comment on column public.food_entries.carbs_g is 'Carboidratos totais da porção registrada, em gramas';
comment on column public.food_entries.fat_g is 'Gordura total da porção registrada, em gramas';
comment on column public.food_entries.source is 'Origem nutricional: tbca, openfoodfacts, gemini, gemini-vision ou manual';
comment on column public.food_entries.confidence is 'Confiança da estimativa quando aplicável';
