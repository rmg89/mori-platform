-- Discovered live (2026-07-16), after enabling RLS in 20260716204556: 7 of
-- the 10 tables already had leftover, fully-permissive policies (qual: true)
-- from an earlier, abandoned attempt at RLS — dormant while RLS was
-- disabled, reactivated the instant RLS was turned back on, completely
-- undermining default-deny. invoices/business_profile/review_items had zero
-- policies and were already correctly locked down; this brings the other 7
-- in line with them. Dropping every policy on these tables, not just the
-- ones seen live, in case others exist that this session's diagnostic pass
-- didn't turn up.

drop policy if exists "allow all" on briefing_notes;
drop policy if exists "anon read briefing_notes" on briefing_notes;

drop policy if exists "allow all" on calls;
drop policy if exists "anon read calls" on calls;

drop policy if exists "allow all" on communications;
drop policy if exists "anon read communications" on communications;

drop policy if exists "allow all" on companies;

drop policy if exists "allow all" on contacts;
drop policy if exists "anon read contacts" on contacts;

drop policy if exists "allow all" on engagements;
drop policy if exists "allow all engagements update" on engagements;
drop policy if exists "anon read engagements" on engagements;

drop policy if exists "allow all" on materials;
drop policy if exists "anon read materials" on materials;
