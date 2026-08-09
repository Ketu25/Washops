-- =====================================================================
-- Laundromat Pickup & Drop-off Portal — full schema
-- Run this ONCE in your Supabase project: SQL Editor -> New query -> Run
-- Safe to re-run: everything is idempotent.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------
-- users
-- Auth is handled by the Next.js server (bcrypt + signed JWT cookie),
-- so password_hash lives here. These tables are NEVER exposed to the
-- browser: all access goes through the server using the service_role
-- key. RLS is enabled with zero policies, which hard-denies the anon
-- and authenticated roles while service_role bypasses RLS by design.
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  email           citext not null unique,
  password_hash   text   not null,
  full_name       text   not null,
  phone           text,
  role            text   not null default 'customer'
                    check (role in ('customer', 'admin')),

  -- Home address (customers). Admins may leave this null.
  address_line1   text,
  address_line2   text,
  city            text,
  state           text,
  postal_code     text,
  formatted_address text,
  latitude        double precision,
  longitude       double precision,
  -- Distance from the laundromat at the moment the address was saved.
  distance_miles  double precision,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- A customer must always carry a geocoded address; an admin need not.
  constraint users_customer_needs_address check (
    role <> 'customer'
    or (address_line1 is not null and latitude is not null and longitude is not null)
  )
);

-- ---------------------------------------------------------------------
-- laundromat_settings — single-row config table.
-- The `id boolean primary key default true check (id)` trick makes it
-- physically impossible to insert a second settings row.
-- ---------------------------------------------------------------------
create table if not exists public.laundromat_settings (
  id                    boolean primary key default true check (id),
  name                  text not null,
  address               text not null,
  formatted_address     text,
  latitude              double precision not null,
  longitude             double precision not null,
  service_radius_miles  numeric(6,2) not null
                          check (service_radius_miles > 0 and service_radius_miles <= 500),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- requests — one pickup or drop-off request.
-- The customer's address is SNAPSHOT onto the row at creation time, so
-- an address change (or a radius change) never rewrites history for a
-- request the driver has already been dispatched on.
-- ---------------------------------------------------------------------
create table if not exists public.requests (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,

  type              text not null check (type in ('pickup', 'dropoff')),

  -- A drop-off returns exactly one pickup. Customers book pickups; the
  -- admin schedules the return once the pickup is completed. Null on
  -- pickups, and on drop-offs predating that change.
  parent_pickup_id  uuid references public.requests(id) on delete cascade,
  status            text not null default 'pending'
                      check (status in ('pending', 'planned', 'completed', 'cancelled')),

  scheduled_date    date not null,
  time_window       text not null,
  notes             text,
  admin_notes       text,

  -- Address snapshot at time of request.
  address_line1     text not null,
  address_line2     text,
  city              text,
  state             text,
  postal_code       text,
  formatted_address text,
  latitude          double precision not null,
  longitude         double precision not null,
  distance_miles    double precision not null,

  planned_at        timestamptz,
  completed_at      timestamptz,
  cancelled_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint requests_only_dropoffs_have_parent
    check (parent_pickup_id is null or type = 'dropoff')
);

create index if not exists requests_user_id_idx        on public.requests (user_id);
create index if not exists requests_status_idx         on public.requests (status);
create index if not exists requests_scheduled_date_idx on public.requests (scheduled_date);
create index if not exists requests_type_idx           on public.requests (type);
create index if not exists requests_dashboard_idx      on public.requests (status, scheduled_date desc);

-- One OPEN pickup per customer per day. A cancelled or completed pickup
-- does not occupy the slot, so the customer can re-book the same day
-- after cancelling. Enforced in the database so a double-submit or a race
-- between two tabs cannot slip through.
--
-- Deliberately pickups only: the admin owns drop-offs now, and two
-- pickups completed in the same week may legitimately be returned on the
-- same day.
create unique index if not exists requests_one_open_pickup_per_day
  on public.requests (user_id, scheduled_date)
  where type = 'pickup' and status in ('pending', 'planned');

-- One live drop-off per pickup. 'cancelled' is excluded so cancelling a
-- return frees the pickup to have another scheduled; 'completed' is
-- included so a finished return cannot be duplicated.
create unique index if not exists requests_one_dropoff_per_pickup
  on public.requests (parent_pickup_id)
  where parent_pickup_id is not null
    and status in ('pending', 'planned', 'completed');

create index if not exists requests_parent_pickup_id_idx
  on public.requests (parent_pickup_id)
  where parent_pickup_id is not null;

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists requests_set_updated_at on public.requests;
create trigger requests_set_updated_at
  before update on public.requests
  for each row execute function public.set_updated_at();

drop trigger if exists settings_set_updated_at on public.laundromat_settings;
create trigger settings_set_updated_at
  before update on public.laundromat_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security: enabled, with NO policies.
-- Effect: the anon and authenticated roles (i.e. anyone holding the
-- publishable key) can read and write NOTHING. The server's
-- service_role key bypasses RLS, and every query in this app runs
-- through the server after an explicit ownership/role check.
-- ---------------------------------------------------------------------
alter table public.users                enable row level security;
alter table public.laundromat_settings  enable row level security;
alter table public.requests             enable row level security;

-- Revoke the default PostgREST grants as a second layer of defence.
revoke all on public.users               from anon, authenticated;
revoke all on public.laundromat_settings from anon, authenticated;
revoke all on public.requests            from anon, authenticated;
