-- Only the server function may read these tables. No browser/anonymous policies.
create table if not exists public.eod_dropbox_connection (
  id integer primary key check (id = 1),
  account_id text not null,
  refresh_encrypted text not null,
  file_id text not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.eod_dropbox_sessions (
  session_hash text primary key,
  account_id text not null,
  expires_at timestamptz not null
);
alter table public.eod_dropbox_connection enable row level security;
alter table public.eod_dropbox_sessions enable row level security;
revoke all on public.eod_dropbox_connection, public.eod_dropbox_sessions from public, anon, authenticated;
grant select,insert,update,delete on public.eod_dropbox_connection, public.eod_dropbox_sessions to service_role;
