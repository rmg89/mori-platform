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
- **Settings** (`src/app/settings`) — invoice letterhead / business profile editing, integrations status list; user management is a placeholder
- **File upload** endpoint (`src/app/api/upload`)

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
- `ANTHROPIC_API_KEY` is not set in any environment (local or Vercel). Not currently blocking — no AI feature is live yet per the client — but `email-reply`, `instagram-caption`, and `ai-scan` will all fail at runtime until it's added.

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

## Decisions

- Canonical Vercel project for this repo is `team-taheripour-platform`, not `mori-platform` — confirmed 2026-07-10. The local Git repo and CLI are linked to it.
- Local dev, Preview, and Production all share one Supabase project and one set of credentials — confirmed 2026-07-10. There is no separate dev/preview database.
