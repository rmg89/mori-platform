# Mori Platform

This loads on top of `~/.claude/CLAUDE.md` (global engineering defaults) and holds only things specific to this platform.

## What this is

A custom business-operations platform for Mori Taheripour (client: MT Global Strategies) that replaces HubSpot for managing the full lifecycle of speaking engagements — prospects → confirmed engagements → wrap-up — plus companies, contacts, invoices, and AI-assisted tools.

## Stack

- **Frontend**: Next.js 14.2.5 (App Router), React 18, TypeScript, Tailwind CSS
- **Hosting**: Vercel, project `team-taheripour-platform`, **not** `mori-platform` despite the repo name. A second project literally named `mori-platform` was also connected to this repo, had zero env vars, and failed every build silently for 9+ days before being deleted 2026-07-10. Any Vercel CLI work targets `team-taheripour-platform`.
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

**Local dev, Preview and Production all use the same Supabase project and credentials.** Confirmed 2026-07-10: the Vercel secrets are scoped to "Production, Preview" and were pulled as-is into `.env.local`. There is no separate dev or preview database, so avoid destructive or bulk write testing on a preview.

## Data layer

- **`src/lib/db.ts` is the real data layer**, despite the filename suggesting something generic — it maps raw Supabase rows into the app's `Engagement` shape, including deriving flags/alerts from boolean columns (e.g. `engagement_flags`, `post_event_flags`, overdue-invoice and event-approaching alerts).
- **`db.ts` is server-only** as of `secure-supabase-rls` (2026-07-16). It uses `supabaseAdmin()` with the service-role key, so its CRUD functions are not importable from a `'use client'` file. A new table's client-facing actions need a server route under `src/app/api/<table>/` plus a matching wrapper in `db-client.ts`, never a direct `db.ts` import from `store.tsx`.
- **Engagements auto-transition on read.** `fetchAllEngagements()` updates any confirmed engagement whose `event_date` has passed to `wrap-up` as a side effect of fetching, and fires an async AI scan for each one. This runs on every dashboard/pipeline load, not on a schedule.
- **A generic entity patch can silently drop a normalized field.** `updateEngagement(id, patch)` strips fields backed by their own table before writing, while still applying them to local optimistic state — the UI looks correct and nothing reached the database. Any array-shaped field backed by its own table needs dedicated add/update/delete actions.
- **Denormalized array fields are not populated.** `Company.engagement_ids` / `contact_ids` were hardcoded to `[]` by `fetchCompanies()`/`insertCompanyRow()`. Fixed at the store level 2026-07-11 via a `useMemo` deriving from `engagements.company_id`. One page had independently worked around it inline, which masked the bug elsewhere — grep every read site of a denormalized field before trusting the object shape.
- **Generate real UUIDs client-side.** A placeholder id like `bn_${Date.now()}` lets the database assign its own, so any "add then immediately mutate" action before the next refetch targets an id that does not exist. Use `crypto.randomUUID()` and send it explicitly on insert. `addComm`/`addCall` use the placeholder pattern and have not been individually checked.
- **Derive "did this record pass through stage X" from current status columns**, not from a side-channel snapshot field. `StageHistoryNav.tsx` inferred it from `engagement_snapshot`, which is only written by the rarely-used manual transition, so it silently broke for the automatic path most records take.

## Schema and migrations

- **`schema.sql` is a snapshot, not the source of truth.** It calls the comms table `comms`; the live table is `communications`, renamed everywhere except that file. Confirmed 2026-07-15 when a migration failed against the real database. A column can also be in `schema.sql` and genuinely absent live — `confirmed_at`/`declined_at` were written by `confirmProspect`/`declineProspect` and missing in production, producing a 400 the first time anyone confirmed a prospect. Only a migration plus confirmation proves a column is live.
- **`calls`, `materials` and `briefing_notes` have no `CREATE TABLE` anywhere** — not in a migration, not in `schema.sql`. Created out-of-band via the dashboard, confirmed live through the PostgREST OpenAPI spec (`GET {url}/rest/v1/?apikey=...`). Any table missing from `supabase/migrations` is a candidate for the same gap, including the RLS one below.
- **A table created after the 2026-07-16 RLS lockdown can silently regress it** by copying pre-lockdown boilerplate (`disable row level security` + `grant all to anon, authenticated`). `contracts` (2026-07-17) and `contract_templates` (2026-07-22) both did, and shipped anon-open until `/test` caught it 2026-07-28. New tables must enable RLS default-deny, `revoke ... from anon, authenticated`, and `grant ... to service_role` from the start (see `20260728000000_lock_down_contracts_rls.sql`). The lockdown must also cover the table's **sequence** and any **`SECURITY INVOKER` RPC** that inserts into it. Verify with a direct anon-key `curl`, never the migration's success message.
- **A migration can be applied out-of-band** through the Supabase dashboard by a person or another agent. `supabase migration list` then shows a `remote` timestamp with no local file. That is a real gap — nothing in the repo records what it did — even though the tracking itself is not wrong. Worth a recurring audit.
- **`supabase db pull`/`db dump` need Docker** for a shadow database. Without it there is no way to retrieve the SQL of a remote-only migration. The Docker-free options are `migration repair` (bookkeeping only, runs no SQL) and live introspection via the PostgREST OpenAPI spec.

## This platform's quirks

- **The MCP endpoint requires a bearer token.** `src/app/api/[transport]/route.ts` checks `Authorization: Bearer <token>` against `MCP_SECRET_TOKEN` and the multi-value `MCP_TOKENS` on every request, failing closed if unset. Comparison is `crypto.timingSafeEqual` with an equal-length check first, not `===`. Any MCP client must send the header or pass the token as `?t=`.
- **The live MCP URL is `https://team-taheripour-platform.vercel.app/api/mcp`** — the `[transport]` segment resolves to `mcp` for streamable HTTP (`basePath: '/api'`). Probe it with garbage auth and expect `401`; a `404` means the path is wrong. That validates domain, path and auth gate in one request.
- **claude.ai custom connectors cannot send request headers.** The Advanced settings offer only an OAuth Client ID and Secret, so a header-gated MCP server is unreachable from claude.ai web (Claude Code and Desktop are fine). The symptom is a *registration* failure, not a 401, because claude.ai sees a bare 401, infers OAuth, and finds no authorization server. Worked around 2026-07-31 by also accepting `?t=`.
- **Vercel Deployment Protection 401s preview deployments at the edge**, before any request reaches app code. Externally-called endpoints — MCP connectors, webhooks, inbound email — cannot be tested on a preview URL at all, and a preview 401 says nothing about the app's own auth. Verify those against production.
- **The Review page is UI-only.** `src/app/review/page.tsx` reads `reviewItems` from `useStore()`, but `src/lib/store.tsx` initializes it as an empty array and never populates it. The inbound-email-triage flow it is built for has no data source yet.
- **`README.md` is stale.** It describes an earlier demo-mode version (mock data in `src/lib/mock-data.ts`, a `pipeline/` + `inbox/` route structure) that no longer exists. Don't trust its architecture section.
- **An env var defined but never referenced in the code is a signal, not dead config.** Grepping for one is what caught the unauthenticated MCP endpoint. Worth doing during any audit pass.
- **`/wrap` is overridden for this repo.** `.claude/commands/wrap.md` auto-merges to `main` once its gates pass (session-scoped commits, clean and pushed, type-check and real build green, main merged in first if it moved, Vercel preview `Ready`, `/test` clean, manual checks cleared or waived). User-requested 2026-07-16. A failed or ambiguous gate still stops and asks; destructive changes always stop.
- **The auto-mode Bash classifier can block an action already covered by a standing policy**, and a chat "yes" does not reliably clear a re-fired block. Retry once, then ask.

## PDF and rendering

- **jsPDF spaces multi-line text by `fontSize * lineHeightFactor` (default 1.15)**, not by the y-advance used between separate `doc.text` calls. When those disagree, the visible gap after a paragraph drifts with its line count, which looks random until measured. Call `doc.setLineHeightFactor(desiredLineHeight / fontSize)` once so drawn spacing equals the advance. Verify by diffing consecutive baselines from `pdfjs getTextContent().items[i].transform[5]`, not by eye.
- **Headless rendering captures whatever a CSS entrance animation is doing at that instant**, so an `animation-fill-mode: both` fade prints washed-out sections. Disable animations outright in the print document rather than only under `@media print`, or the screenshot used to verify the PDF becomes untrustworthy while the PDF itself is fine.

## Related docs

- [PROJECT.md](PROJECT.md) — features, test checklist, decisions
- [docs/session-log.md](docs/session-log.md) — session history

## Inbox (unsorted)

`/wrap` drops lessons here tagged `[platform]` or `[craft]`; `/prune` drains it monthly.

- (nothing yet)
