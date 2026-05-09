-- SatsSwap DEX — Supabase schema
-- Run this once in your Supabase SQL editor to create the orders table.

create extension if not exists "uuid-ossp";

create table if not exists orders (
  id              uuid primary key default uuid_generate_v4(),
  maker_address   text not null,
  from_token_id   text not null,
  to_token_id     text not null,
  from_amount     numeric not null,   -- display units (e.g. 1.5 DOG)
  to_amount       numeric not null,   -- satoshis (BTC asking price)
  psbt_hex        text not null,      -- maker's partially signed PSBT (hex)
  utxo_txid       text not null,      -- UTXO the maker is spending
  utxo_vout       integer not null default 0,
  status          text not null default 'open'
                    check (status in ('open', 'filled', 'cancelled', 'expired')),
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  -- Rune-specific (null for BRC-20 orders)
  rune_id         text,               -- e.g. "840000:3" — needed for Runestone encoding
  rune_amount     text                -- exact base-unit amount as string (bigint-safe)
);

-- Migration for existing tables: add columns if they don't exist yet
alter table orders add column if not exists rune_id     text;
alter table orders add column if not exists rune_amount text;

-- Index for fast order book queries (pair + open + not expired)
create index if not exists orders_pair_status
  on orders (from_token_id, to_token_id, status, expires_at);

-- Index for maker's own orders
create index if not exists orders_maker
  on orders (maker_address, created_at desc);

-- Row-level security: anyone can read open orders, only service role can write
alter table orders enable row level security;

create policy "Public can read open orders"
  on orders for select
  using (status = 'open' and expires_at > now());

-- Service role (backend) bypasses RLS — no additional policy needed.
