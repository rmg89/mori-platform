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
- [platform] The Vercel project actually serving production for this repo is `team-taheripour-platform`, not `mori-platform`, despite the repo/app name. A second Vercel project literally named `mori-platform` was also connected to the same GitHub repo/branch, had zero env vars, and had been failing every build silently for 9+ days. Deleted 2026-07-10 — local repo is now linked to `team-taheripour-platform`. Any future Vercel CLI work on this repo should target that project.
- [platform] Confirmed 2026-07-10: local dev, Preview, and Production all use the same Supabase project and credentials (the secrets in Vercel are scoped to "Production, Preview" and were pulled as-is into `.env.local`). There is no separate dev/preview database — this resolves the open "needs input" question under Data safety above.
- [craft] `vercel link` and `vercel env pull` overwrite `.env.local` wholesale with whatever the target project/environment has — including wiping it down to nothing if linked to the wrong project, or if the default "Development" environment target has fewer vars set than "Production"/"Preview". If `.env.local` was already gitignored, there's no git history to recover from. Confirm `vercel project ls` and the right project *before* the first `vercel link` on a repo, and check `vercel env ls` for which environments actually hold the values you need.
- [craft] On Windows, npm-installed CLI tools (Vercel CLI included) ship a `.ps1` wrapper for PowerShell, which is blocked by PowerShell's default execution policy ("running scripts is disabled on this system"). Use the `.cmd` shim (e.g. `vercel.cmd`) or run the command from Git Bash instead of changing the execution policy.
- [craft] Any ancestor with a `transform` — even one that's only present via a completed CSS keyframe animation ending in `transform: translateY(0)` — creates a containing block for `position: fixed` descendants. A modal rendered inside an animated page wrapper (e.g. a page-level `.animate-fade-in` class) will position itself relative to that wrapper instead of the viewport, landing far down the page instead of centered. Fix: render modals via a React portal to `document.body`, not just `position: fixed` in place.
- [craft] Calling `new Date()` (or anything derived from it — `.getHours()`, `.toLocaleDateString()`) directly during render in an SSR'd component is a near-guaranteed React hydration mismatch whenever the server and client can be in different timezones, not just a rare race. Server (often UTC) and client (local) compute a different hour/date for the same instant, React discards and rebuilds the mismatched subtree, and any click on that subtree right after load can be lost. Fix with `suppressHydrationWarning` on the specific node, or defer the value to a post-mount effect.
- [craft] React's `autoFocus` can silently lose to `<body>` when the element that previously held focus (e.g. a "+ Add" trigger button) unmounts in the *same* render that mounts the `autoFocus` target — the browser's own focus-follows-removal behavior can land after React's `autoFocus` commit. Use an explicit `ref` + `useEffect(() => ref.current?.focus(), [dep])` instead whenever a focused trigger and a focused input swap places in one render.
- [craft] A control that's conditionally disabled or no-ops based on other input state (e.g. "only open this form if a sibling field isn't empty") reads to a user as completely broken, not as "waiting for input" — especially when it's the first thing they try. If a sibling control with the same shape (e.g. a twin "+ Add new X" button) is unconditionally clickable, match that instead of special-casing the empty state.
- [platform] `Company.engagement_ids` / `contact_ids` are not populated by the data layer — `fetchCompanies()`/`insertCompanyRow()` hardcoded them to `[]`. Any code reading those fields needs the live-derived version (match `engagements` by `company_id`) rather than trusting the object shape; fixed at the store level 2026-07-11 via a `useMemo`. One consumer (`companies/[id]/page.tsx`) had already independently worked around this by deriving links inline — worth grepping every read site of a denormalized array field before trusting it, since a page-local workaround can mask the same bug elsewhere.
- [craft] A hook (e.g. `useCallback`/`useState`) called *after* an early `if (!x) return` is a latent Rules-of-Hooks violation, not just a lint nit — it only actually crashes (React errors #300/#310, "rendered fewer/more hooks than expected") on whichever render the early-return condition flips relative to the previous render. Found this live in `EngagementDetailPage` 2026-07-15. Fix: hoist the hook above the guard and make its *body* handle the possibly-undefined value, not its call site.
- [platform] A column can be defined in the checked-in `supabase/schema.sql` (so it looks "real" on read) while genuinely not existing on the live production table, if it was added to the file without ever being run as a migration. `confirmed_at`/`declined_at` were exactly this — always written by `confirmProspect`/`declineProspect`, always in `schema.sql`, but missing in prod, causing a 400 ("Could not find the 'X' column ... in the schema cache") the first time anyone confirmed a prospect. `schema.sql` is not proof a column is live; only a migration + confirmation is.
- [craft] A new component can build and type-check cleanly while being completely unreachable — nothing wrong shows up until you grep for its importers. Before calling a new component "done," confirm something under the app's route tree actually renders it.
- [craft] Two Claude Code sessions (e.g. this CLI + an IDE-panel session) touching the same working directory concurrently can move git state — branch, HEAD, even a direct push to `main` — without either session knowing. Re-check `git status`/`git log`/`git fetch` immediately before merging, don't trust the state from earlier in the session.
