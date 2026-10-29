-- Track every login attempt (success and failure) for security monitoring.
-- Written to by the service-role API route so it always succeeds regardless
-- of whether the caller is authenticated.

create table if not exists public.login_attempts (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  ip_address    text,
  user_agent    text,
  success       boolean not null,
  failure_reason text,          -- 'invalid_credentials' | 'rate_limited' | 'timeout' | 'unknown'
  created_at    timestamptz not null default now()
);

-- Index for the monitor query: recent attempts by email or IP
create index if not exists login_attempts_email_idx      on public.login_attempts (email, created_at desc);
create index if not exists login_attempts_ip_idx         on public.login_attempts (ip_address, created_at desc);
create index if not exists login_attempts_created_at_idx on public.login_attempts (created_at desc);

-- RLS: only service role can insert/read (enforced by the API route)
alter table public.login_attempts enable row level security;

-- No policies for anon/authenticated — only service role bypasses RLS
-- This means the table is only readable via the monitor script (service role key)
