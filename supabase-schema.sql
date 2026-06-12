-- Run this entire file in your Supabase project's SQL Editor
-- Dashboard → SQL Editor → New Query → paste → Run

-- Profiles (one per user, linked to auth)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null default '',
  partner_code text unique,
  partner_id uuid references public.profiles(id),
  macro_goals jsonb not null default '{"calories":1800,"protein":140,"carbs":180,"fat":60}',
  created_at timestamptz default now()
);

-- Macro log entries
create table public.macro_log (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null default current_date,
  name text not null,
  calories int not null default 0,
  protein int not null default 0,
  carbs int not null default 0,
  fat int not null default 0,
  created_at timestamptz default now()
);

-- Workout log entries
create table public.workout_log (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null default current_date,
  name text not null,
  type text not null default 'Strength',
  duration int,
  notes text,
  created_at timestamptz default now()
);

-- Weight log entries
create table public.weight_log (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null default current_date,
  weight numeric(5,1) not null,
  created_at timestamptz default now()
);

-- AI chat history per user
create table public.ai_chat (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- Row Level Security: users can only see their own data
-- AND their partner's data where relevant

alter table public.profiles enable row level security;
alter table public.macro_log enable row level security;
alter table public.workout_log enable row level security;
alter table public.weight_log enable row level security;
alter table public.ai_chat enable row level security;

-- Profiles: see own + partner
create policy "profiles_own" on public.profiles for all using (id = auth.uid());
create policy "profiles_partner" on public.profiles for select using (
  id = (select partner_id from public.profiles where id = auth.uid())
);

-- Macro log: own full access, partner read
create policy "macro_own" on public.macro_log for all using (user_id = auth.uid());
create policy "macro_partner" on public.macro_log for select using (
  user_id = (select partner_id from public.profiles where id = auth.uid())
);

-- Workout log: own full access, partner read
create policy "workout_own" on public.workout_log for all using (user_id = auth.uid());
create policy "workout_partner" on public.workout_log for select using (
  user_id = (select partner_id from public.profiles where id = auth.uid())
);

-- Weight log: own full access, partner read
create policy "weight_own" on public.weight_log for all using (user_id = auth.uid());
create policy "weight_partner" on public.weight_log for select using (
  user_id = (select partner_id from public.profiles where id = auth.uid())
);

-- AI chat: own only
create policy "aichat_own" on public.ai_chat for all using (user_id = auth.uid());

-- Auto-create profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, partner_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    upper(substring(md5(random()::text) for 6))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
