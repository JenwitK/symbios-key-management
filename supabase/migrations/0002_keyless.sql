-- Run in the Supabase SQL Editor (or `supabase db push`).
alter table scripts add column keyless boolean not null default false;
