-- `EngagementCall` has carried `format` and `details` since calls were built, the UI
-- reads and writes both, but neither column ever existed on the table. Every call
-- schedule/edit PATCH therefore 400'd on the whole payload — taking scheduled_at and
-- status down with it — so scheduling a call never persisted at all. Found 2026-08-10
-- once the uuid fix let call writes reach Postgres in the first place.
--
-- Additive: two nullable columns, no constraint, no existing row affected.
alter table calls add column if not exists format text;
alter table calls add column if not exists details text;

-- Matches CallFormat in src/types/index.ts. Allows null for the rows that predate this.
alter table calls drop constraint if exists calls_format_check;
alter table calls add constraint calls_format_check
  check (format is null or format in ('phone','video','in_person'));
