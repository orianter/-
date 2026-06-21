-- One free analysis per verified email
create table if not exists public.free_analysis_email_usage (
  email_hash text primary key,
  used_at timestamptz not null default now()
);

create index if not exists free_analysis_email_usage_used_at_idx
  on public.free_analysis_email_usage (used_at desc);

alter table public.free_analysis_email_usage enable row level security;

comment on table public.free_analysis_email_usage is 'Tracks free-tier analysis usage per verified email.';
