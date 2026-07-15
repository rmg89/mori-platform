# Session log

One entry per work session. Newest at the top.

## Template

```
## YYYY-MM-DD
- What changed:
- Why:
- Follow-ups / open questions:
```

## 2026-07-11
- Branch: `main` (no feature branch — committed and pushed directly, twice: `248c84f` and `f2ca9f7`).
- What I did:
  - Wired up the previously non-functional "New Inquiry" button on the Prospects/Dashboard pages: built `insertEngagementRow` (`src/lib/db.ts`), `addProspect` (`src/lib/store.tsx`), and a new `NewInquiryModal` component.
  - Reworked Organization and Contact entry in that modal to search existing records first (with AI-assisted website lookup for new organizations via `/api/ai/enrich-company`, using Claude + web search — never fabricates, returns null instead of guessing) or add new, mirroring the existing pattern on the engagement detail page. Added support for multiple contacts per new prospect.
  - Wired up a second, separately-broken "Add Company" button on `/companies` (had no click handler at all) with a new `AddCompanyModal`.
  - Found and fixed several real bugs along the way (see Bugs found).
  - Added "Current" engagement tracking: `isEngagementCurrent()` (event date today or in the future) in `src/lib/utils.ts`, surfaced as a badge on the company detail page and a filter + badge on the companies list.
  - Ran `/test` against the full diff since session start (covering both this work and the parallel session's invoice-finalize/business-profile/delete-company-contact work) — reported two lists, no blocking issues found by reading, flagged migration-application status and PDF layout as needing a manual/preview check.
- Bugs found:
  - **Modal positioning broke inside `.animate-fade-in` page wrappers** — the wrapper's `transform` (from its fade-in keyframe) creates a CSS containing block, so any `position: fixed` modal inside it renders relative to the page container instead of the viewport, appearing far down the page. Fixed by rendering all four modals (`NewInquiryModal`, `ArchiveModal`, `ConfirmModal`, `InvoiceEditModal`) via `createPortal(..., document.body)`.
  - **Dashboard greeting/date caused a React hydration mismatch** — `new Date().getHours()`/`.toLocaleDateString()` were called directly in render, computed once server-side (UTC) and again client-side (local timezone), producing different text and forcing React to discard and rebuild that part of the tree on every load. This is the likely cause of "clicks doing nothing" right after page load. Fixed with `suppressHydrationWarning` on those two nodes (the documented React/Next.js pattern for content that's expected to differ between server and client).
  - **`company.engagement_ids`/`contact_ids` were always hardcoded to `[]`** in `src/lib/db.ts` (`fetchCompanies`, `insertCompanyRow`) — this silently broke the company detail page's Engagements/Contacts tabs for *every* company, not just newly created ones. Fixed by deriving both live from the current `engagements` state via `useMemo` in `store.tsx`.
  - **`mapContact()` dropped `company_id`/`team_id`** when loading contacts from Supabase — meant a contact's own company link was invisible to the app, so selecting an existing contact from a different company during New Inquiry would get silently re-linked to the new engagement's company instead of keeping their real one. Fixed by mapping both fields through; also had to add `company_id`/`team_id` to the `ContactRow` interface, which was missing them entirely.
  - **"+ Add new organization" only focused the input instead of opening the form when clicked with an empty field** — unlike "+ Add new contact", which always opens unconditionally. Looked exactly like the button doing nothing on first click, which is the natural way to use it. Fixed by removing the special case.
  - **`autoFocus` silently lost focus to `<body>`** on both the new-organization and new-contact forms — the trigger button that had focus unmounts in the same render that mounts the autofocused input, and the browser drops focus to `<body>` in that swap before React's `autoFocus` commits. Fixed with an explicit `ref` + `useEffect(() => ref.current?.focus(), [mode])` instead.
- Decisions:
  - Any future "link existing or create new" UI (companies, contacts, or similar) should follow the pattern established here: default to a search view, an always-clickable (never conditionally-disabled) "+ Add new" entry point, and an explicit "Company name"/equivalent-required-field style form — not a single dual-purpose search/name field.
  - AI-assisted data entry (company lookup) must use real web search and return `null`/unknown rather than ever letting the model guess a fact like a website URL — and any AI-filled field must show a "verify before saving" indicator in the UI, not look identical to manually-entered data.
  - "Current" is defined as: engagement has an `event_date` of today or later. This is the definition to reuse anywhere "current" comes up next.
- Follow-ups / open for next session:
  - Confirm the three migrations touched/added this session (`add_business_profile.sql`, `add_invoice_finalized_status.sql`, `allow_delete_companies_contacts.sql`) have actually been run against the live Supabase database — flagged by `/test` as the top risk, not verifiable by reading the repo alone.
  - Visually verify the PDF invoice layout changes in `src/lib/documents.ts` (header repositioning, new From/Billed-To two-column block) on an actual generated PDF — can't be confirmed by reading the jsPDF coordinate math alone.
  - `ANTHROPIC_API_KEY` is still unset everywhere — confirmed again this session as intentional; billing is meant to be the client's own Anthropic account, not the developer's, whenever AI features are actually turned on.

## 2026-07-10 (2)
- Branch: `main` (no feature branch — this session was deploy/infra investigation and cleanup, no app code changes committed).
- What I did:
  - Checked deploy setup: confirmed GitHub remote (`rmg89/mori-platform`) and that the Vercel CLI was installed but not logged in or linked.
  - Logged into Vercel CLI (account `rmgops`) and ran `vercel link`, initially linking to a Vercel project named `mori-platform` — this turned out to be the wrong project (see Bugs found).
  - Discovered a second Vercel project, `team-taheripour-platform`, connected to the same GitHub repo/branch (`main`). Verified via build logs that it clones the exact same commit as local `main` (`a8fd4ea`) and has the real Supabase/MCP secrets — it is the actual live production site.
  - Re-linked the local repo to `team-taheripour-platform` and, with explicit approval, pulled its Production-scoped env vars to restore `.env.local`.
  - Confirmed `ANTHROPIC_API_KEY` is not set anywhere (local or Vercel) — user confirmed this is expected, no real AI features are live yet.
  - Deleted the broken duplicate `mori-platform` Vercel project (user ran it directly from their terminal, since Claude Code's auto-safety classifier repeatedly blocked Claude from running the deletion itself). Confirmed gone via `vercel project ls`.
- Bugs found:
  - The Vercel project actually serving production traffic for this repo was `team-taheripour-platform`, not `mori-platform` — despite the repo and app being named `mori-platform`. A second, unrelated Vercel project called `mori-platform` was also connected to the same repo/branch via Git integration, had zero env vars configured, and had been failing every single build for at least 9 days straight, silently (0ms build, dies before it starts). Fixed by relinking the local repo to the correct project and deleting the broken one.
  - Running `vercel link` against the wrong project (`mori-platform`) auto-overwrote `.env.local` with that project's (empty) Development env vars, wiping out the real local secrets. They were not lost — recovered by pulling from the correct project — but this is a sharp edge worth knowing about (see CLAUDE.md inbox).
- Decisions:
  - Canonical Vercel project for this repo going forward is `team-taheripour-platform`. Any future `vercel link` / `vercel env pull` must target that project, not `mori-platform` (now deleted).
  - Confirmed local dev, Preview, and Production all share the exact same Supabase project and credentials — there is no separate dev/preview database. This resolves the "needs input" line in `CLAUDE.md` → Data safety (still needs to be written up there formally).
- Follow-ups / open for next session:
  - Update `CLAUDE.md` → Data safety section to state plainly that dev/preview/production share one Supabase project, since this is now confirmed (currently still phrased as an open question).
  - `ANTHROPIC_API_KEY` is unset everywhere — not urgent per user (no AI features live yet), but will need to be added before `email-reply`, `instagram-caption`, or `ai-scan` routes are actually used.
  - Pre-existing uncommitted change in `src/app/dashboard/page.tsx` (and `src/components/NewInquiryModal.tsx` from before) are still sitting in the working tree, untouched by this session.

## 2026-07-10
- Branch: `fix-mcp-auth`, merged to `main` this session (fast-forward, no merge commit), branch deleted locally and on origin after merge.
- What I did:
  - Scaffolded project dev-process docs — `CLAUDE.md`, `PROJECT.md`, `docs/session-log.md` — from the actual codebase (none existed before).
  - While scaffolding, found the MCP endpoint (`src/app/api/[transport]/route.ts`) had no auth check at all, despite a `MCP_SECRET_TOKEN` env var existing unused.
  - Fixed it: added an `Authorization: Bearer <MCP_SECRET_TOKEN>` check with a timing-safe comparison, failing closed if the env var is unset.
  - Verified locally with curl against the dev server: 401 with no/wrong token, request reaches the handler with the correct token.
  - Committed as two commits (fix, then docs), pushed the branch, merged to `main` on explicit request, pushed `main`, deleted the branch.
- Bugs found:
  - MCP endpoint unauthenticated — fixed this session (see above).
  - Review page (`src/app/review/page.tsx`) reads `reviewItems`, which is never populated anywhere — not fixed, logged as a known bug (it's unfinished work, not a regression).
- Decisions:
  - MCP endpoint auth fails closed (denies all requests) if `MCP_SECRET_TOKEN` isn't set, rather than falling open.
- Follow-ups / open for next session:
  - Confirm whether Vercel preview deployments share the production Supabase project (see `CLAUDE.md` → Data safety) — still needs input.
  - No committed product roadmap found — PROJECT.md's "Planned" section is still a placeholder.
  - MCP clients (including any Claude connector pointed at this server) now need `MCP_SECRET_TOKEN` configured as their bearer token, or they'll get 401s.
  - Pre-existing uncommitted changes sit in the working tree from before this session (`src/app/dashboard/page.tsx`, `src/components/NewInquiryModal.tsx`, `src/lib/db.ts`, `src/lib/store.tsx`) — untouched, not part of this session's work, still there to pick up.
