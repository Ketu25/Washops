-- =====================================================================
-- 002 — Drop-offs become admin-scheduled and linked to their pickup
-- ---------------------------------------------------------------------
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- Before: the customer booked both halves independently.
-- After:  the customer books a pickup; once the admin completes it, the
--         admin schedules the return. A drop-off now belongs to exactly
--         one pickup.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Link a drop-off to the pickup it returns.
--    ON DELETE CASCADE: deleting a pickup removes its return, because a
--    return with nothing to return is meaningless.
-- ---------------------------------------------------------------------
alter table public.requests
  add column if not exists parent_pickup_id uuid
    references public.requests(id) on delete cascade;

create index if not exists requests_parent_pickup_id_idx
  on public.requests (parent_pickup_id)
  where parent_pickup_id is not null;

-- A pickup can never point at a parent; only a drop-off can.
alter table public.requests
  drop constraint if exists requests_only_dropoffs_have_parent;
alter table public.requests
  add constraint requests_only_dropoffs_have_parent
  check (parent_pickup_id is null or type = 'dropoff');

-- ---------------------------------------------------------------------
-- 2. One live drop-off per pickup.
--    'cancelled' is excluded so that cancelling a return frees the
--    pickup to have another scheduled; 'completed' is included so a
--    finished return cannot be silently duplicated.
-- ---------------------------------------------------------------------
create unique index if not exists requests_one_dropoff_per_pickup
  on public.requests (parent_pickup_id)
  where parent_pickup_id is not null
    and status in ('pending', 'planned', 'completed');

-- ---------------------------------------------------------------------
-- 3. Narrow the per-day guard to pickups.
--
--    The old index covered (user_id, type, scheduled_date) for every
--    type. That is still right for pickups — a customer should not hold
--    two open pickups on one day. It is wrong for drop-offs now that the
--    admin owns them: two pickups completed in the same week may
--    legitimately be returned on the same day, and the old index would
--    have blocked the second with a duplicate-key error.
-- ---------------------------------------------------------------------
drop index if exists requests_one_open_per_day_per_type;

create unique index if not exists requests_one_open_pickup_per_day
  on public.requests (user_id, scheduled_date)
  where type = 'pickup' and status in ('pending', 'planned');

-- ---------------------------------------------------------------------
-- 4. Drop-offs created before this change have no parent. They are left
--    alone: they are historical records, they still display, and the
--    admin can still close them out. The constraint above permits a null
--    parent precisely so this data stays valid.
-- ---------------------------------------------------------------------
