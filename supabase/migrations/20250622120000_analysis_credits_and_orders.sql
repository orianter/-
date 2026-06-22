-- Paid analysis credits + payment orders (Cardcom)

create table if not exists public.analysis_credits (
  email_hash text primary key,
  credits_balance integer not null default 0 check (credits_balance >= 0),
  plan_id text,
  updated_at timestamptz not null default now()
);

create index if not exists analysis_credits_updated_at_idx
  on public.analysis_credits (updated_at desc);

alter table public.analysis_credits enable row level security;

comment on table public.analysis_credits is 'Remaining full-analysis credits per verified email hash.';

create table if not exists public.payment_orders (
  id text primary key,
  email_hash text not null,
  plan_id text not null,
  amount_ils numeric(10, 2) not null,
  status text not null default 'pending',
  low_profile_id text,
  transaction_id text,
  credits_granted integer,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists payment_orders_email_hash_idx
  on public.payment_orders (email_hash, created_at desc);

create index if not exists payment_orders_status_idx
  on public.payment_orders (status, created_at desc);

alter table public.payment_orders enable row level security;

comment on table public.payment_orders is 'Cardcom checkout orders and fulfillment status.';
