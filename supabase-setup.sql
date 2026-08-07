-- PlayVerse: выполни в Supabase → SQL Editor → Run (можно повторно)

create table if not exists profiles (
  username text primary key,
  pass_hash text not null,
  display_name text default '',
  coins int default 0,
  avatar_type text default 'initials',
  avatar_shop_id text default '',
  avatar_emoji text default '',
  avatar_image text default '',
  owned_avatars jsonb default '[]',
  favorites jsonb default '[]',
  history jsonb default '[]',
  friends jsonb default '[]',
  favorite_friends jsonb default '[]',
  incoming_requests jsonb default '[]',
  outgoing_requests jsonb default '[]',
  role text default '',
  created_at timestamptz default now()
);

-- если таблица уже была без history — добавить колонку
alter table profiles add column if not exists history jsonb default '[]';

alter table profiles enable row level security;

drop policy if exists "profiles read all" on profiles;
drop policy if exists "profiles insert" on profiles;
drop policy if exists "profiles update" on profiles;

create policy "profiles read all" on profiles for select using (true);
create policy "profiles insert" on profiles for insert with check (true);
create policy "profiles update" on profiles for update using (true);

-- ВАЖНО: без этого сайт не может писать в таблицу
grant usage on schema public to anon, authenticated;
grant select, insert, update on table public.profiles to anon, authenticated;

-- Игры из Фабрики (v1 и v2): заявки игроков → админ PlayVerse
create table if not exists factory_submissions (
  id text primary key,
  author text not null default '',
  status text not null default 'pending',
  source text default 'v1',
  game_data jsonb not null default '{}',
  submitted_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists factory_submissions_status_idx on factory_submissions (status);
create index if not exists factory_submissions_submitted_idx on factory_submissions (submitted_at desc);

alter table factory_submissions enable row level security;

drop policy if exists "factory read all" on factory_submissions;
drop policy if exists "factory insert" on factory_submissions;
drop policy if exists "factory update" on factory_submissions;

create policy "factory read all" on factory_submissions for select using (true);
create policy "factory insert" on factory_submissions for insert with check (true);
create policy "factory update" on factory_submissions for update using (true);

grant select, insert, update on table public.factory_submissions to anon, authenticated;

-- Уникальные коды Premium (один код — один игрок)
create table if not exists premium_codes (
  code text primary key,
  telegram_id bigint,
  days int not null default 30,
  source text default 'manual',
  created_at timestamptz default now(),
  used_at timestamptz,
  used_by text default ''
);

create index if not exists premium_codes_telegram_idx on premium_codes (telegram_id);
create index if not exists premium_codes_unused_idx on premium_codes (used_at);

alter table premium_codes enable row level security;

drop policy if exists "premium_codes read" on premium_codes;
drop policy if exists "premium_codes insert" on premium_codes;
drop policy if exists "premium_codes update" on premium_codes;

create policy "premium_codes read" on premium_codes for select using (true);
create policy "premium_codes insert" on premium_codes for insert with check (true);
create policy "premium_codes update" on premium_codes for update using (true);

grant select, insert, update on table public.premium_codes to anon, authenticated;
