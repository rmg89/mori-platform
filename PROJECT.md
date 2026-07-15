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
- **MCP server** (`src/app/api/[transport]`) — 27 tools exposing the full pipeline (list/get/update engagements, contacts, companies, calls, materials, briefing notes, invoices, PDF generation) for direct use by Claude. Requires `Authorization: Bearer <MCP_SECRET_TOKEN>` on every request (added 2026-07-10; fails closed if the token env var is unset)
- **Settings** (`src/app/settings`) — invoice letterhead / business profile editing (`src/lib/business.ts`, Billing tab), integrations status list; user management is a placeholder
- **File upload** endpoint (`src/app/api/upload`)
- **New Inquiry** (`src/components/NewInquiryModal.tsx`, launched from Prospects and Dashboard) — creates a prospect with search-or-create organization linking, AI-assisted website lookup for new organizations (`src/app/api/ai/enrich-company`, Claude + web search, never fabricates), and support for adding multiple contacts, each optionally linked to an existing or new company
- **Add Company** (`src/components/AddCompanyModal.tsx`, launched from the Companies page)
- **Delete company / delete contact** — typed-confirmation delete that unlinks (rather than blocks on) any referencing engagements/contacts/comms (`supabase/migrations/allow_delete_companies_contacts.sql`)
- **"Current" engagement tracking** (`src/lib/utils.ts` → `isEngagementCurrent`) — engagements with an `event_date` today or later are flagged "Current" on the company detail page and filterable on the Companies list
- **Invoice finalize workflow** — `draft → finalized → sent → paid`, plus an invoice edit modal (`src/components/InvoiceEditModal.tsx`) for correcting snapshot fields after creation

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
- Not confirmed whether the three migrations touched 2026-07-11 (`add_business_profile.sql`, `add_invoice_finalized_status.sql`, `allow_delete_companies_contacts.sql`) have actually been run against the live Supabase database — flagged by `/test`, not verifiable from the repo alone.

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
- [ ] Before trusting a pending file in `supabase/migrations/`, run it (or confirm it's already been run) directly in the Supabase SQL editor — its presence in the repo doesn't mean it's live

## Decisions

- Canonical Vercel project for this repo is `team-taheripour-platform`, not `mori-platform` — confirmed 2026-07-10. The local Git repo and CLI are linked to it.
- Local dev, Preview, and Production all share one Supabase project and one set of credentials — confirmed 2026-07-10. There is no separate dev/preview database.
