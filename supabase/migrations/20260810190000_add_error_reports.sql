-- Error reporting: every crash, failed request and user-filed report lands here
-- so the operator can see what the two live users hit, without them having to
-- describe it. Written only by the service-role gateway (/api/errors).

create table if not exists error_reports (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- what kind of failure this is
  kind          text not null,                    -- render | promise | window | api | server | user_report
  severity      text not null default 'error',    -- error | warning
  message       text not null,
  stack         text,
  fingerprint   text not null,                    -- groups repeats of the same failure

  -- where it happened
  url           text,
  route         text,
  action        text,                             -- e.g. "PATCH /api/engagements/:id"
  method        text,
  http_status   int,

  -- who hit it
  user_label    text,                             -- self-identified name (no auth on this app)
  session_id    text,                             -- stable per browser, for grouping one person's run
  user_agent    text,

  -- extra
  context       jsonb,                            -- arbitrary structured detail
  breadcrumbs   jsonb,                            -- recent user actions leading up to it
  user_note     text,                             -- what the user typed, for kind = 'user_report'

  -- triage
  resolved_at   timestamptz,
  resolved_note text
);

create index if not exists error_reports_created_at_idx  on error_reports (created_at desc);
create index if not exists error_reports_fingerprint_idx on error_reports (fingerprint);
create index if not exists error_reports_resolved_idx    on error_reports (resolved_at);

-- Same lockdown as every table added after 2026-07-16: default-deny RLS, no
-- anon/authenticated grants, service_role only. The app reaches this table
-- exclusively through /api/errors using supabaseAdmin(), which bypasses RLS.
alter table error_reports enable row level security;
revoke all on error_reports from anon, authenticated;
grant all on error_reports to service_role;
