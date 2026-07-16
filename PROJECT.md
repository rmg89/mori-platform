## Overview

CRM and business-operations platform for booking and running Mori Taheripour's speaking engagements, from first inquiry through post-event wrap-up and payment.

## Features

### Shipped

- **Pipeline**: prospects → engagements → wrap-up, each with its own list view (`src/app/prospects`, `src/app/engagements`, `src/app/wrap-up`) and a detail page per record (`[id]/page.tsx`)
- **Dashboard** (`src/app/dashboard`) — business snapshot: counts, upcoming events, items needing response, unpaid invoices, stale prospects
- **Companies & contacts directories** (`src/app/companies`, `src/app/contacts`) with per-record detail pages
- **Archive** (`src/app/archive`) for engagements taken out of the active pipeline, with a required reason
- **Advance sheet / briefing doc** per engagement (`src/app/engagements/[id]/advance-sheet`) — purpose, audience, venue/travel logistics, run of show, moderator/panelist info
- **Invoices** (`src/app/invoices`, `src/lib/invoices.ts`) — sequentially numbered via a `create_invoice` Postgres RPC, status tracked against per-engagement payment fields; deposit invoices supported separately from final invoices
- **PDF generation** (`src/lib/documents.ts`, jsPDF) — contracts, briefing docs, invoices, deposit invoices
- **AI email reply drafting** (`src/app/api/ai/email-reply`) and **Instagram caption generation** (`src/app/api/ai/instagram-caption`) via Claude
- **Automatic AI engagement scans** (`src/lib/ai-scan.ts`) — on decline, on move-to-confirmed, and on move-to-wrap-up, Claude flags which contract/materials/post-event items likely apply and drops a summary into that engagement's briefing notes
- **MCP server** (`src/app/api/[transport]`) — 29 tools exposing the full pipeline (list/get/update engagements, contacts, companies, calls, materials, briefing notes, invoices, PDF generation, plus `move_engagement_backward`/`unarchive_engagement`) for direct use by Claude. Requires `Authorization: Bearer <MCP_SECRET_TOKEN>` on every request (added 2026-07-10; fails closed if the token env var is unset)
- **Settings** (`src/app/settings`) — invoice letterhead / business profile editing (`src/lib/business.ts`, Billing tab), integrations status list; user management is a placeholder
- **File upload** endpoint (`src/app/api/upload`)
- **New Inquiry** (`src/components/NewInquiryModal.tsx`, launched from Prospects and Dashboard) — creates a prospect with search-or-create organization linking, AI-assisted website lookup for new organizations (`src/app/api/ai/enrich-company`, Claude + web search, never fabricates), and support for adding multiple contacts, each optionally linked to an existing or new company
- **Add Company** (`src/components/AddCompanyModal.tsx`, launched from the Companies page)
- **Delete company / delete contact** — typed-confirmation delete that unlinks (rather than blocks on) any referencing engagements/contacts/comms (`supabase/migrations/allow_delete_companies_contacts.sql`)
- **"Current" engagement tracking** (`src/lib/utils.ts` → `isEngagementCurrent`) — engagements with an `event_date` today or later are flagged "Current" on the company detail page and filterable on the Companies list
- **Invoice finalize workflow** — `draft → finalized → sent → paid`, plus an invoice edit modal (`src/components/InvoiceEditModal.tsx`) for correcting snapshot fields after creation
- **Un-archive, move backward, move to Wrap-Up manually** (`src/lib/pipeline.ts`, `src/components/UnarchiveButton.tsx`) — an archived record can be restored via a button on the Archive list or any detail page; a confirmed engagement or wrap-up record can be moved back one pipeline stage (restoring the frozen `prospect_step` from its snapshot); an engagement can be moved to Wrap-Up manually ahead of the automatic date-based transition. All three also exposed as MCP tools.
- **Add Contact** (`src/components/AddContactModal.tsx`, launched from the Contacts page) — standalone entry point for a contact independent of any engagement, with inline company search-or-create; sortable columns on both the Contacts and Companies list pages; a "Companies" nav link on the Contacts page mirroring the existing "Contacts" link on Companies.
- **Stage History nav + read-only snapshot views** (`src/components/StageHistoryNav.tsx`, `ProspectSnapshotView.tsx`, `EngagementSnapshotView.tsx`) — wired into `prospects/[id]`, `engagements/[id]`, `wrap-up/[id]` so a record that's moved past a stage shows a frozen, visually-faithful replica of that stage's live page instead of the stale live template, plus a "Stage History" pill nav to jump between them.
- **Supabase CLI migration tracking** — see Decisions below.

### Planned (committed)

- [needs input: no committed roadmap found in code or commit history — ask what's next]

### Maybe / someday

- Microsoft Graph (M365) email sync — stubbed in the README, not started
- Auth (Supabase Auth or SSO) and real user/permission management — Settings UI is a placeholder for this
- Media storage decision (Supabase Storage vs. Google Drive) for post-event assets

## Known bugs

- ~~MCP endpoint (`src/app/api/[transport]`) had no auth check~~ — fixed 2026-07-10, now requires a `MCP_SECRET_TOKEN` bearer token.
- The Review page (`src/app/review/page.tsx`) renders against `reviewItems`, which is never populated — see [CLAUDE.md](CLAUDE.md#this-platforms-quirks). Not a regression, just unfinished.
- ~~A stray duplicate Vercel project (`mori-platform`) with no env vars had been failing every deploy for 9+ days while the real project (`team-taheripour-platform`) succeeded~~ — found and deleted 2026-07-10; local repo relinked to the correct project.
- ~~Modals rendered inside a page wrapper with `.animate-fade-in` positioned relative to the page instead of the viewport~~ — the wrapper's keyframe `transform` creates a CSS containing block for any `position: fixed` descendant. Fixed 2026-07-11 by rendering all modals via `createPortal(..., document.body)`.
- ~~Dashboard greeting/date caused a React hydration mismatch~~ (`new Date()` computed once server-side in UTC, again client-side in local time) — likely cause of clicks being lost right after a fresh page load, since React discards and rebuilds the mismatched subtree. Fixed 2026-07-11 with `suppressHydrationWarning` on the two affected nodes.
- ~~`company.engagement_ids`/`contact_ids` were always hardcoded to `[]`~~ — broke the company detail page's Engagements/Contacts tabs for every company. Fixed 2026-07-11, now derived live from `engagements` state.
- ~~`mapContact()` dropped a contact's `company_id`/`team_id` on read~~ — meant linking an existing contact from a different company during New Inquiry would silently re-link them to the new company instead of preserving their real one. Fixed 2026-07-11.
- ~~"+ Add new organization" only focused the input instead of opening the form when clicked with an empty field~~ (unlike "+ Add new contact", which always opens) — looked exactly like the button not working. Fixed 2026-07-11.
- ~~`autoFocus` lost focus to `<body>` on the new-organization/new-contact forms~~ — the trigger button unmounts in the same render that mounts the autofocused input. Fixed 2026-07-11 with explicit `ref` + `useEffect` focus.
- `ANTHROPIC_API_KEY` is not set in any environment (local or Vercel). Not currently blocking — no AI feature is live yet per the client, and billing for it is meant to be the client's own Anthropic account, not the developer's — but `email-reply`, `instagram-caption`, `ai-scan`, and the New Inquiry AI company lookup will all fail at runtime (gracefully, with a visible error/fallback message) until it's added.
- ~~Not confirmed whether `add_business_profile.sql`, `add_invoice_finalized_status.sql`, and `allow_delete_companies_contacts.sql` had actually been run against the live Supabase database~~ — resolved 2026-07-15 by linking the repo to the Supabase CLI and running `supabase db push` for all 15 pre-existing migrations (all idempotent; `db push` reported "already exists, skipping" for everything genuinely already live). `allow_delete_companies_contacts.sql` itself had a real bug caught in the process — it referenced a table named `comms`, but the live table is `communications` (`schema.sql` was stale on this point) — fixed and re-applied. `npx supabase migration list` is now the source of truth for what's live; see [CLAUDE.md](CLAUDE.md#stack).
- ~~`confirmed_at`/`declined_at` were missing from the live `engagements` table~~ — both are base `schema.sql` columns that `confirmProspect`/`declineProspect` have always written to, but were never actually present in production, causing a 400 ("Could not find the 'confirmed_at' column") when confirming a prospect. Fixed 2026-07-15 with `supabase/migrations/add_confirmed_declined_at.sql`, confirmed run against production.
- ~~`EngagementDetailPage` called `useCallback` after an early `if (!e) return`~~ — changed the hook count between renders whenever the engagement lookup toggled found/not-found, surfacing as React errors #300/#310 in production. Fixed 2026-07-15 by hoisting the hook above the guard. Every other detail page was swept for the same pattern and is clean.
- ~~`prospect_step: 'confirmed'` fallback bug~~: `getBackwardTransition()` (`src/lib/pipeline.ts`) fell back to `'confirmed'` when an engagement had no `prospect_snapshot` (true for anything confirmed via the `move_to_confirmed` MCP tool) — `'confirmed'` is excluded from the Prospects list's active-steps filter, so the record silently vanished from every list after being moved backward. Fixed and merged 2026-07-16; falls back to `'in_contact'` instead.
- ~~`contacts.engagement_id` was `NOT NULL` on the live table~~, contradicting `schema.sql` (showed it nullable) — found via a direct insert test against production. Migration applied and confirmed live 2026-07-16 (via a separate manual path, not this session's own `db push` — see Decisions); Add Contact merged the same day.
- ~~The contact-search dropdown in `NewInquiryModal` stayed open after picking a name~~ — it defaulted to showing the first 6 results even with an empty query, so clearing the query on selection didn't hide the list. Fixed and merged 2026-07-16 with a `contactSearchOpen` state that closes on selection and only reopens on focus.
- ~~`StageHistoryNav.tsx`, `ProspectSnapshotView.tsx`, and `EngagementSnapshotView.tsx` were built but never wired into any route~~ — wired into all three detail pages and merged 2026-07-16; both snapshot views were also rewritten to be full visual replicas of their live-page counterparts rather than a generic reconstruction.
- Inside `EngagementSnapshotView`'s Briefing Document card, the "Primary Contact" and inner "Event Details" sub-sections render a gold header even when every field beneath is empty, showing visibly blank space — inconsistent with the "Prep Notes" section right below it (which has an explicit empty-state fallback) and every other card on the page (which hide entirely when empty). Found via `/test`, merged with this gap still open, not yet fixed.
- ~~`allow_contacts_without_engagement.sql` predated the Supabase CLI setup and used the wrong filename format~~ — silently skipped by `supabase migration list`/`db push` (no schema impact, tracking-only). Renamed to a CLI-compliant timestamp 2026-07-16.
- **Two migrations exist in the remote Supabase ledger with no matching local file** (`20260716160226`, `20260716162140`) — found via `supabase migration list` after this session's merges; attributed to a different agent/session, not yet reconciled with a local file. User will audit.
- **`add-contact-button`'s second batch of edits (Companies-page sort, Companies nav link) sat uncommitted on disk** despite being reported as pushed — caught only when the user asked directly. Committed 2026-07-16.

## Test checklist

- [ ] Create a new prospect (via UI) and confirm it appears in the Prospects list with the right stage
- [ ] Move a prospect through stages: inquiry → outreach → in_contact → declined, and confirm declining moves it to Wrap-Up with `wrap_up_review_needed` set and an AI scan note added
- [ ] Move a prospect to confirmed and check the AI scan flags contract/materials correctly on the engagement detail page
- [ ] Open an engagement detail page, edit a field (e.g. fee, event_date, notes), and confirm it persists after reload
- [ ] Generate a briefing/advance-sheet PDF for an engagement and confirm it downloads with the right data
- [ ] Create an invoice for an engagement and confirm the sequence number increments and status reflects `payment_received_at`
- [ ] Add a contact to an engagement, mark them as point of contact, and confirm it shows correctly on both the engagement and the Contacts directory
- [ ] Let an engagement's `event_date` pass, then load the dashboard/pipeline and confirm it auto-transitions to Wrap-Up (see `fetchAllEngagements` side effect in `src/lib/db.ts`)
- [ ] Hit the MCP endpoint (`/api/[transport]`) with no `Authorization` header and with a wrong token — confirm both get `401` — then with the correct `MCP_SECRET_TOKEN` bearer token and confirm the request reaches the handler
- [ ] Run `vercel project ls` and confirm exactly one Vercel project is connected to this repo (`team-taheripour-platform`), and that it has all required env vars set (`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `MCP_SECRET_TOKEN`) before trusting a deploy
- [ ] Open a company's detail page for a company with linked prospects/engagements/contacts and confirm they actually appear under the Engagements and Contacts tabs (regression: `engagement_ids`/`contact_ids` sync)
- [ ] From New Inquiry, search-select an existing contact who belongs to a *different* company than the one you're creating, finish creating the prospect, then confirm that contact's `company_id` was preserved, not overwritten (regression: `mapContact` dropping `company_id`)
- [ ] Click "+ Add new organization" / "+ Add new contact" with the field completely empty (don't type anything first) and confirm the form opens immediately with the first input focused (regression: empty-field click + autoFocus)
- [ ] Hard-refresh `/dashboard` and check the browser console for React hydration errors (#418/#423/#425) — should be none
- [ ] Before trusting a new migration file, run `npx supabase migration list` and confirm its timestamp shows a matching remote value — its presence in `supabase/migrations/` doesn't mean it's live until `db push` has run
- [ ] Confirm a prospect (writes `confirmed_at`) and decline a prospect (writes `declined_at`) and confirm both succeed with no 400 (regression: missing schema columns)
- [ ] On an engagement's detail page, click Move Backward / Move to Wrap-Up / Archive in sequence without a full page reload between clicks, watching the browser console for React errors #300/#310 (regression: hooks called after an early return)
- [ ] Move a *declined* prospect (parked in Wrap-Up) backward to Prospects specifically — distinct code path from a normal Wrap-Up record moving back to Engagements
- [ ] Unarchive a record from the Archive *list* page itself (not just from a detail page) and confirm it doesn't also navigate you into the record
- [ ] Delete a company and delete a contact end-to-end on a real (non-throwaway) record and confirm referencing engagements/contacts unlink cleanly rather than erroring
- [ ] Before adding a new component, grep whether anything under `src/app/` actually imports it — a component can build and type-check clean while being fully unreachable (regression: `StageHistoryNav`/`ProspectSnapshotView`/`EngagementSnapshotView`)
- [ ] Confirm an engagement via the `move_to_confirmed` MCP tool (not the UI), then move it back to Prospects — confirm it lands in `inquiry`/`outreach`/`in_contact` and shows up in the Prospects list, not silently `confirmed` and invisible (regression: `getBackwardTransition` fallback)
- [ ] Create a standalone contact (Add Contact button, no engagement) and confirm it saves and shows up in the Contacts directory, sorts correctly by every column, and that "create new company" inline also works (regression: `contacts.engagement_id` NOT NULL / new feature end-to-end)
- [ ] In New Inquiry, type in the contact search field, pick a result, and confirm the results list closes and doesn't reopen until you click/focus the field again (regression: dropdown defaulting to showing results even on an empty query)
- [ ] Move a Wrap-Up engagement back to Engagements *without* changing its `event_date`, then hard-refresh, and confirm it doesn't get silently re-forwarded to Wrap-Up by the automatic date-based transition in `fetchAllEngagements()` (regression: reschedule/auto-revert interaction gap, flagged by `/test`, never actually clicked through)
- [ ] Open the Engagement snapshot view (visit a Wrap-Up record, click "Engagements" in Stage History) for a record with little or no briefing data ever filled in, and confirm no section (Primary Contact, Event Details) shows a header with nothing underneath (regression: sparse-data blank-header gap in `EngagementSnapshotView`)
- [ ] Periodically run `npx supabase migration list` and confirm every entry with a `remote` timestamp also has a matching local file in `supabase/migrations/` — a migration applied outside this repo's own branch/CLI workflow (dashboard UI, another agent, a different checkout) creates a remote-only entry with nothing to show what it changed (regression: two untracked 2026-07-16 migrations found this way)

## Decisions

- Canonical Vercel project for this repo is `team-taheripour-platform`, not `mori-platform` — confirmed 2026-07-10. The local Git repo and CLI are linked to it.
- Local dev, Preview, and Production all share one Supabase project and one set of credentials — confirmed 2026-07-10. There is no separate dev/preview database.
- Adopted real Supabase CLI migration tracking 2026-07-15 (project ref `jwdxuorpcppsjcomvhch`) after repeated "was this migration actually run" incidents. All 15 pre-existing migration files were renamed to CLI-compliant timestamps and reconciled against the live database via `supabase db push`. Going forward: `supabase migration new <name>` for schema changes, `supabase db push --dry-run` to preview, `supabase db push` to apply — additive/idempotent changes applied without asking (mirrors the git branch-push convention), destructive/one-way changes always confirmed first.
