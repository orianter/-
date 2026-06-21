-- One free analysis per device fingerprint + IP (server-side enforcement)
create table if not exists public.free_analysis_usage (
  identity_hash text primary key,
  fingerprint text not null,
  ip_hash text not null,
  used_at timestamptz not null default now()
);

create index if not exists free_analysis_usage_ip_hash_idx on public.free_analysis_usage (ip_hash);
create index if not exists free_analysis_usage_used_at_idx on public.free_analysis_usage (used_at desc);

alter table public.free_analysis_usage enable row level security;

comment on table public.free_analysis_usage is 'Tracks anonymous free-tier analysis usage (fingerprint + IP hash).';
