# Mori Platform

This loads on top of `~/.claude/CLAUDE.md` (global engineering defaults) and holds only things specific to this platform.

## What this is

A custom business-operations platform for Mori Taheripour (client: MT Global Strategies) that replaces HubSpot for managing the full lifecycle of speaking engagements — prospects → confirmed engagements → wrap-up — plus companies, contacts, invoices, and AI-assisted tools.

## Stack

- **Frontend**: Next.js 14.2.5 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend/data**: Supabase (Postgres), via `src/lib/supabase.ts` — an anon client for the browser and a service-role `supabaseAdmin()` for server routes. Base schema in `supabase/schema.sql`, incremental changes in `supabase/migrations/`.
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

[needs input: I couldn't confirm from the code whether the Vercel preview deployment points at the same Supabase project as production, or a separate one. There's a single `.env.local` (gitignored, not committed) with one set of Supabase credentials — no `vercel.json` or per-environment config in the repo to check against. Confirm this before doing any bulk/destructive testing on a preview branch.]

## This platform's quirks

- **The MCP endpoint requires a bearer token.** `src/app/api/[transport]/route.ts` checks `Authorization: Bearer <MCP_SECRET_TOKEN>` on every request (fails closed if the env var is unset). Any MCP client (including Claude connectors) must send that header.
- **The Review page is UI-only.** `src/app/review/page.tsx` reads `reviewItems` from `useStore()`, but `src/lib/store.tsx` initializes `reviewItems` as an empty array and never fetches or populates it from anywhere. The inbound-email-triage flow it's built for isn't wired to a data source yet.
- **`src/lib/db.ts` is the real data layer**, despite the filename suggesting something generic — it maps raw Supabase rows into the app's `Engagement` shape, including deriving flags/alerts from boolean columns (e.g. `engagement_flags`, `post_event_flags`, overdue-invoice and event-approaching alerts).
- **Engagements auto-transition on read.** `fetchAllEngagements()` (`src/lib/db.ts`) updates any confirmed engagement whose `event_date` has passed to `wrap-up` as a side effect of fetching, and fires an async AI scan for each one. This runs on every dashboard/pipeline load, not on a schedule.
- **`README.md` is stale.** It describes an earlier demo-mode version of the app (mock data in `src/lib/mock-data.ts`, a `pipeline/` + `inbox/` route structure). That file no longer exists — the app now reads live from Supabase and the routes are `prospects/`, `engagements/`, `wrap-up/`, `companies/`, `contacts/`, `invoices/`, `archive/`, `review/`. Don't trust the README's architecture section.

## Related docs

- [PROJECT.md](PROJECT.md) — features, test checklist, decisions
- [docs/session-log.md](docs/session-log.md) — session history

## Inbox (unsorted)

`/wrap` drops lessons here tagged `[platform]` or `[craft]`; periodically sort into the sections above.

- [platform] The MCP endpoint (`/api/[transport]`) requires `Authorization: Bearer <MCP_SECRET_TOKEN>` as of 2026-07-10. Any MCP client, including a Claude connector pointed at this server, needs that header configured or it gets 401s.
- [craft] An env var that's defined but never referenced anywhere in the code (grep for it) is a strong signal of an incomplete security gate, not dead config — worth checking specifically during any scaffold/audit pass. Caught the unauthenticated MCP endpoint this way.
- [craft] For comparing bearer tokens/secrets in a route handler, use `crypto.timingSafeEqual` with an equal-length check first, not plain `===` — avoids a timing side-channel for cheap.
