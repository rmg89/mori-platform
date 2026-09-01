# Mori Platform

This loads on top of `~/.claude/CLAUDE.md` (global engineering defaults) and holds only things specific to this platform.

## What this is

A custom business-operations platform for Mori Taheripour (client: MT Global Strategies) that replaces HubSpot for managing the full lifecycle of speaking engagements — prospects → confirmed engagements → wrap-up — plus companies, contacts, invoices, and AI-assisted tools.

## Stack

- **Frontend**: Next.js 14.2.5 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend/data**: Supabase (Postgres), via `src/lib/supabase.ts` — an anon client for the browser and a service-role `supabaseAdmin()` for server routes. Base schema in `supabase/schema.sql`, incremental changes in `supabase/migrations/`. The repo is linked to the real Supabase project (ref `jwdxuorpcppsjcomvhch`) via the Supabase CLI (`npx supabase migration list` shows local-vs-remote status — this is the actual source of truth for what's live, not `schema.sql`). New schema changes: `npx supabase migration new <name>`, edit the file, `npx supabase db push --dry-run` to preview, then `npx supabase db push`.
- **Auth**: not implemented. No middleware, no Supabase Auth wiring. The Settings page's Users tab says "Team management coming soon... once auth is fully configured."
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`) via `src/lib/ai-client.ts`. Model id comes from the `ANTHROPIC_AI_MODEL` env var (currently `claude-haiku-4-5-20251001`), with a clear error if the configured model 404s. Used for:
  - Email reply drafts (`src/app/api/ai/email-reply`)
  - Instagram caption generation (`src/app/api/ai/instagram-caption`)
  - Automatic engagement scans (`src/lib/ai-scan.ts`) — triggered on prospect-decline, move-to-confirmed, and move-to-wrap-up, to flag which contract/materials/post-event items likely apply
- **MCP server**: `src/app/api/[transport]/route.ts` exposes 27 tools (via `mcp-handler`) so Claude can read and write the entire pipeline directly — list/get engagements, update any field, manage contacts/companies/calls/materials/briefing notes, generate briefing PDFs, etc.
- **Documents**: `jsPDF` (`src/lib/documents.ts`) generates contracts, advance sheets, invoices, and briefing docs.
- **Email sync (Microsoft Graph / M365)**: stubbed only, not connected. Settings page shows it as "Not connected."

## Run and test

```
npm run dev     # local dev server
npm run build
npm run start
npm run lint
```

Manual test checklist lives in [PROJECT.md](PROJECT.md).

## Data safety

**Preview, local dev and production all use the same Supabase project and credentials.** Confirmed 2026-07-10: the Vercel secrets are scoped to "Production, Preview" and were pulled as-is into `.env.local`. There is no separate dev or preview database. Every write from a preview branch lands on the client's live data, so the global rule applies at full strength here — no bulk or destructive testing on a preview, ever.

## This platform's quirks

- **The Vercel project serving production is `team-taheripour-platform`, not `mori-platform`**, despite the repo name. A second project literally named `mori-platform` was connected to the same repo, held zero env vars, and had been failing every build silently for nine days before it was deleted 2026-07-10. Target the right one for any CLI work — and never run a bare `vercel` command in a worktree just to fetch a preview URL, which auto-links to a wrong per-branch project and clobbers `.env.local` down to a single var. Restore it from `C:\Users\ryann\Desktop\mori-platform\.env.local` if that happens.
- **Multiple Claude Code sessions run against this repo as routine, not an edge case.** The shared working directory's branch changed underfoot three separate times in one session (2026-07-15). A worktree is mandatory here every time.
- **`/wrap` auto-merges to `main` on this repo once its gates pass** — see `.claude/commands/wrap.md`, which overrides the global doc-only `/wrap`. 2026-07-16, user-requested. Any failed or ambiguous gate still stops and asks, and destructive or one-way changes always stop regardless.
- **Never run `npm run build` while `next dev` is running against the same checkout.** They share `.next`, and the dev server starts serving broken output — a page loses its client bundle and elements silently stop appearing, which reads exactly like a code bug. Cost a full browser verification run 2026-08-11.
- **The MCP endpoint is `https://team-taheripour-platform.vercel.app/api/mcp`**, and it accepts its token either as `Authorization: Bearer` or as `?t=` on the URL. The URL form exists because **claude.ai custom connectors cannot send request headers** — the dialog offers only an OAuth client id and secret, so a header-gated server is unreachable from claude.ai web (Claude Code and Desktop are fine). The symptom is not a 401 but a *registration* failure, because claude.ai sees a bare 401, infers OAuth, and finds no authorization server. Sanity-check the URL and gate with a garbage-auth `curl`: 401 means the path is right, 404 means it is not.
- **`src/lib/db.ts` is server-only** (`supabaseAdmin()`, service-role) as of `secure-supabase-rls`, 2026-07-16. Its CRUD functions are not importable from a `'use client'` file. A new table's client-facing actions need a server route under `src/app/api/<table>/` plus a wrapper in `db-client.ts`.
- **New-table migrations must lock down RLS from the start**: enable RLS default-deny, `revoke ... from anon, authenticated`, `grant ... to service_role`. `contracts` (2026-07-17) and `contract_templates` (2026-07-22) both copied the pre-lockdown boilerplate and shipped anon-open until `/test` caught it 2026-07-28. The lockdown must also cover the table's **sequence** and any **`SECURITY INVOKER` RPC** that inserts into it, or the anon path can still mint rows. See `20260728000000_lock_down_contracts_rls.sql`. Verify with a direct anon-key `curl`, never the migration's success message.
- **Several tables have no `CREATE TABLE` in any tracked migration or in `schema.sql`** — `calls`, `materials` and `briefing_notes` were created out of band through the dashboard. Confirm what is actually live from the PostgREST OpenAPI spec (`GET {SUPABASE_URL}/rest/v1/?apikey=...`) rather than the migration history, and re-check after a merge: `review_items` looked the same way until a concurrent branch's real migration landed.
- **With no Docker, `supabase db pull`/`db dump` cannot compute a schema diff at all.** The Docker-free options are `migration repair` (bookkeeping only, runs no SQL) and live introspection. For arbitrary read-only introspection PostgREST does not expose (`pg_roles`, `pg_policies`, `pg_class.relrowsecurity`), a temporary `SECURITY DEFINER` function with `grant execute to anon`, called via `POST /rest/v1/rpc/<name>`, works — drop it again once done, since a grant-to-anon `SECURITY DEFINER` function left live is a real info-leak surface. When `db push` refuses because the remote ledger holds a migration whose file lives on a concurrent branch, vendor that file in byte-identical rather than reaching for `repair`, which would mark a live migration as reverted.
- **Materials exist in two stores that disagree.** A `materials` table (MCP writes only) and `outgoing_materials`/`incoming_materials` JSONB on `engagements` (UI writes only). `assembleEngagement` prefers the JSONB, so table rows are invisible wherever JSONB exists. Unresolved as of 2026-08-10 — establish which store a materials bug is actually about before fixing it.
- **`field_statuses` is a shared state bag, so adding a key changes every consumer.** Briefing-section show/hide lives there under a `_section_` prefix alongside the individual field statuses. Storing it there was right in isolation and silently broke the dashboard two pages away: `_section_venue: 'needed'` counted as a required field with no value to fill, so readiness could never reach 100%, and the raw key rendered as a UI row. Grep every reader of the bag before shipping, not just the writer. (`travel_not_needed`/`venue_not_needed` on `engagements` were built for this and never wired to anything — they appear only inside an MCP tool's description string.)
- **`.claude/` is untracked here even with nothing ignoring it**, and its `worktrees/` subdirectory holds actual nested git working trees. A blanket `git add` there can pull in another repo's working tree. `.claude/worktrees/` and `.claude/scheduled_tasks.lock` now have explicit `.gitignore` entries.
- **The Review page is UI-only.** `src/app/review/page.tsx` reads `reviewItems` from `useStore()`, but `src/lib/store.tsx` initializes it as an empty array and never populates it. The inbound-email-triage flow it is built for is not wired to a data source.
- **`src/lib/db.ts` is the real data layer**, despite the generic filename — it maps raw Supabase rows into the app's `Engagement` shape, including deriving flags and alerts from boolean columns.
- **Engagements auto-transition on read.** `fetchAllEngagements()` updates any confirmed engagement whose `event_date` has passed to `wrap-up` as a side effect of fetching, and fires an async AI scan for each one. This runs on every dashboard and pipeline load, not on a schedule.
- **`README.md` is stale.** It describes an earlier demo-mode version (mock data in `src/lib/mock-data.ts`, a `pipeline/` + `inbox/` route structure). Don't trust its architecture section.
- **`schema.sql` calls the comms table `comms`; the live table is `communications`.** Every migration after the rename matches the live name except `schema.sql`, which was never updated. Confirmed 2026-07-15 when a migration failed against the real database. `schema.sql` is a snapshot, not a source of truth — a column can sit in it and genuinely not exist in production (`confirmed_at`/`declined_at` did, and threw a 400 the first time anyone confirmed a prospect).
- **Lists here are backed by growing tables, so render them bounded.** Paginate or virtualize from the start rather than mounting every row. Don't derive permanent UI chrome — a banner, a running tally — from a list's full unbounded history unless it is genuinely meant to grow forever. And filter hidden state (archived, soft-deleted) once at the store boundary, since archive status is orthogonal to every section and status filter, so a store holding all records leaks them into any view that forgets.

## Related docs

- [PROJECT.md](PROJECT.md) — features, test checklist, decisions
- [docs/session-log.md](docs/session-log.md) — session history

## Inbox (unsorted)

`/wrap` drops lessons here tagged `[platform]` or `[craft]`. `/prune` sorts them monthly.

- (nothing yet)
