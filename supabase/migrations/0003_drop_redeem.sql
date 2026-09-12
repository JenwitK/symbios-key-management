-- Run in the Supabase SQL Editor (or `supabase db push`).
-- Phase 11: keys are sold via Discord now — drop the Linkvertise redeem flow.
drop table if exists redeem_sessions;
drop table if exists redeem_codes;
alter table settings drop column if exists providers;
