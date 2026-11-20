-- Run once in Supabase > SQL Editor
create table if not exists public.kv (
  k text primary key,
  v jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.kv enable row level security;   -- no policies: only the server (service role) can read/write
revoke all on public.kv from anon, authenticated;
