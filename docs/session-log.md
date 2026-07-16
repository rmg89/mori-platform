# Session log

One entry per work session. Newest at the top.

## Template

```
## YYYY-MM-DD
- What changed:
- Why:
- Follow-ups / open questions:
```

## 2026-07-15 (2)
- Branches: three opened this session, all still open (not merged):
  - `fix-prospect-backward-fallback` — pushed, ready to merge, no known blockers.
  - `add-contact-button` — pushed, but blocked (see Follow-ups).
  - `chore/supabase-cli-setup` — pushed, `/test`-reviewed, build confirmed green on Vercel, ready to merge.
- What I did:
  - Diagnosed and fixed a React error #300 crash on deleting a contact (`contacts/[id]/page.tsx`): a `useState` hook was declared *after* the `if (!match) return` guard, so hook count changed between renders whenever the contact was deleted mid-session. This fix ended up bundled into a concurrent session's commit (`1acf6ba`) on `main` rather than its own branch — the working directory was shared with another active Claude Code session for part of this session.
  - Diagnosed a shared-working-directory incident: found `main` had been merged/pushed without going through this session. Initially misdiagnosed as an unauthorized-push problem; the user corrected this — the push was authorized via a different session. Root cause is actually commit-time contamination: concurrent sessions sharing one working tree means `git commit` in one session can sweep up another session's uncommitted edits, regardless of which branch is "supposed" to own them. Hardened the global `~/.claude/CLAUDE.md` "Multiple tasks and merge conflicts" section: worktree-per-task is now the assumed default whenever concurrent sessions might be active, plus a mandatory git-state preflight (`git status`/`git branch --show-current`/`git log -3`) before any git action.
  - `fix-prospect-backward-fallback`: fixed `getBackwardTransition()` (`src/lib/pipeline.ts`) falling back to `prospect_step: 'confirmed'` when an engagement had no `prospect_snapshot` (true for anything confirmed via the `move_to_confirmed` MCP tool) — `'confirmed'` is excluded from the Prospects list's active-steps filter, so the record silently vanished from every list after being moved backward. Now falls back to `'in_contact'`, matching the existing wrap-up/declined branch.
  - `add-contact-button`: built a standalone "Add Contact" entry point on the Contacts directory (previously had none, unlike Companies). Required loosening the data model — contacts were strictly children of an engagement (`engagement_id` fk) with no path to create one independently; user chose to make contacts genuinely independent rather than requiring an engagement pick. Added `unassignedContacts` state + `createContact` action (`store.tsx`), a `fetchUnassignedContacts`/widened `insertContact`/`upsertContact` in `db.ts`, and `AddContactModal.tsx` (mirrors `AddCompanyModal.tsx`, plus inline "create new company" like `NewInquiryModal`'s pattern). Also added sortable column headers (Contact/Organization/Role/Status) to the Contacts page and (Company/Industry/Stage/Contacts) to the Companies page, and a "Companies" nav link on the Contacts page mirroring the existing "Contacts" link on the Companies page.
  - `chore/supabase-cli-setup`: adopted real Supabase CLI migration tracking after repeated "was this migration actually run" incidents (three separate times this project has hit undetected schema/live drift). Installed the CLI as a devDependency, linked the project (ref `jwdxuorpcppsjcomvhch`), renamed all 15 existing migration files to CLI-compliant timestamps (ordered by actual first-commit date from git history), and ran `supabase db push` (dry-run shown and explicitly approved first) to reconcile the remote ledger. All 15 turned out to be fully idempotent, so the push was safe regardless of prior state; confirmed via the `NOTICE ... already exists, skipping` output that 13 of them really were already live. Confirmed explicitly with the user (via AskUserQuestion) and wrote a durable autonomy policy into the global CLAUDE.md: additive/idempotent migrations get applied without asking from now on (mirrors git branch-push), destructive/one-way ones always stop for approval first (mirrors merge-to-main).
  - Ran `/test` twice: once on the (since-merged) unarchive/move-backward branch's newest commits, once on `chore/supabase-cli-setup`. Both read-only, no sign-off given.
  - Discussed (no code): whether to integrate HubSpot for email parsing. Recommendation given — don't; finish the already-stubbed native Microsoft Graph integration instead, since HubSpot's contact-association value only pays off if contacts are duplicated into HubSpot too, which reopens a two-system sync problem this platform was built to avoid.
- Bugs found:
  - **React #300 on contacts delete** — `useState` after an early return in `contacts/[id]/page.tsx`. Fixed (landed via a concurrent session's commit on `main`).
  - **`prospect_step: 'confirmed'` fallback bug** — engagements moved backward to Prospects with no `prospect_snapshot` vanished from the Prospects list. Fixed on `fix-prospect-backward-fallback`, not yet merged.
  - **`contacts.engagement_id` is `NOT NULL` live**, contradicting `schema.sql` (which shows it nullable) — found via a direct insert test against production before building further on the wrong assumption. Migration written (`allow_contacts_without_engagement.sql`) but not yet applied — this branch predates the CLI tooling setup, so it wasn't run through `supabase db push`. Add Contact will 400 until this runs.
  - **`allow_delete_companies_contacts.sql` referenced a table named `comms`; the live table (and every other migration, and `db.ts`) calls it `communications`** — `schema.sql` is stale on this point, never updated after a live rename. This is almost certainly why the delete-company FK error was still happening even after the migration was believed run. Found and fixed during the Supabase CLI reconciliation; confirmed applied to production.
  - **Confirmed via this session's CLI reconciliation**: `add_business_profile.sql`, `add_invoice_finalized_status.sql`, and `allow_delete_companies_contacts.sql` (all flagged "not confirmed" since 2026-07-11) had in fact never been applied to production before this session. All three are now applied and tracked.
- Decisions:
  - Contacts become genuinely independent of engagements (not just linkable-to-existing) — user's explicit choice, presented as a tradeoff between a smaller "must pick an engagement" change and this larger one.
  - Do not adopt HubSpot for email parsing; finish the native Microsoft Graph integration instead (see above).
  - Adopted Supabase CLI migration tracking as standard practice going forward, with an explicit, user-confirmed autonomy split for future migrations (additive = auto-apply, destructive = always ask) — written into the global CLAUDE.md, not just this project's.
  - Worktree-per-task is now the assumed default for any concurrent-session-prone project, written into the global CLAUDE.md, not just this project's.
  - Considered and explicitly rejected: a `pre-push` git hook blocking direct pushes to `main`. Was based on a misdiagnosis (thought a push had been unauthorized; it hadn't) and was reverted once corrected — noting this so it isn't proposed again for the same reason.
- Follow-ups / open for next session:
  - **`add-contact-button` is blocked**: run `supabase/migrations/allow_contacts_without_engagement.sql` (needs a rebase onto `main` after `chore/supabase-cli-setup` merges, so it goes through the CLI properly instead of the old manual-SQL-editor path).
  - Merge order: recommend `chore/supabase-cli-setup` first (no dependencies), then rebase `fix-prospect-backward-fallback` and `add-contact-button` onto the new `main` before merging each — all three share the same `origin/main` ancestor and will likely conflict on `CLAUDE.md`/`PROJECT.md`.
  - `StageHistoryNav.tsx`/`ProspectSnapshotView.tsx`/`EngagementSnapshotView.tsx` still undecided (carried over, not touched this session) — a different concurrent session (`wire-stage-history-nav`) appeared to be actively working on this area during this session.
  - Manual click-through still needed on `add-contact-button` once its migration runs: create a standalone contact, create-company-inline, sort every column on both Contacts and Companies pages.
  - `ANTHROPIC_API_KEY` still unset everywhere — unchanged, confirmed intentional in prior sessions.

## 2026-07-15 (3)
- Branch: `fix-contact-search-dropdown` — still open, not merged to `main`.
- What I did:
  - Fixed the contact-search dropdown in `NewInquiryModal` staying open after picking a name — it defaulted to showing the first 6 results even with an empty query, so clearing the query on selection didn't hide it. Added a `contactSearchOpen` state that opens on focus and closes immediately on selection.
- Bugs found:
  - **Contact-search dropdown never closed after selecting a contact** — fixed, see above.
- Decisions: none.
- Follow-ups / open for next session:
  - Not merged yet — needs a manual preview click-through (search, select, confirm the list closes and reopens only on refocus) before merging.

## 2026-07-15 (4)
- Branch: `wire-stage-history-nav` — still open, not merged to `main`.
- What I did:
  - Wired `StageHistoryNav.tsx`, `ProspectSnapshotView.tsx`, and `EngagementSnapshotView.tsx` (flagged in the entry below as built but never wired into any route) into `prospects/[id]`, `engagements/[id]`, and `wrap-up/[id]` — a record that's moved past a stage now shows a frozen replica of that stage's page instead of the stale live template, plus a "Stage History" pill nav to jump between stages.
  - Moved the Stage History nav from a small inline row at the top of the page to a full-width card at the bottom, and consolidated the separate Move-forward/Move-back/Archive boxes into one grouped card (Delete stays separate, last).
  - Fixed `getRecordStages()`: it inferred "this record was in Engagements" from `engagement_snapshot` being non-null, but that field is only set by the rarely-used manual `moveToWrapUp` action — most records reach Wrap-Up via the automatic date-based transition in `fetchAllEngagements()`, which never sets it. Silently dropped the "Engagements" pill for almost every real wrap-up record. Now derived from `section`/`prospect_step` directly.
  - Removed a redundant "Back to Prospects/Engagements" link from the two read-only snapshot views — it pointed at a list the record isn't in anymore; the Stage History pills (and the app shell's own nav) already cover that.
  - Rewrote `ProspectSnapshotView` and `EngagementSnapshotView` to be full visual replicas of their live-page counterparts (stepper table, event details, contacts, materials progress tiles, deposit card, briefing document, timeline) instead of a simplified generic label/value reconstruction, per explicit request that the read-only view "look like what we're used to."
  - Fixed the Briefing Document card being hidden entirely whenever a handful of snapshot fields (purpose/venue/travel/etc.) all happened to be empty — the live page's Briefing Document is never conditionally hidden; its header/contact/details/prepnotes sections are always shown regardless of data. Now always renders, matching the live page's own default-sections logic (Venue/Travel/Run of Show still conditional on physical-event/travel data, same as live).
  - Ran `/test` twice on this branch before merge.
- Bugs found:
  - **`getRecordStages()` silently dropped the Engagements stage for most wrap-up records** — fixed, see above.
  - **Briefing Document card was hidden entirely when snapshot data was sparse** — fixed, see above.
  - **Briefing Document's Primary Contact / Event Details sub-sections can render a header with nothing underneath** when their fields are empty, found on the second `/test` pass — inconsistent with "Prep Notes" right below (which has an explicit empty-state fallback) and every other card on the page (which hide entirely when empty). Not fixed this session.
- Decisions:
  - When reconstructing a live, data-driven page as a "frozen/read-only" view, match what the live page actually renders with *no* data (placeholders, always-shown sections) before assuming an empty section should just disappear — the two are easy to conflate and only diverge exactly on the sparse records a user is most likely to be looking at.
- Follow-ups / open for next session:
  - Fix the Primary Contact / Event Details blank-header gap in `EngagementSnapshotView.tsx` found by the second `/test` pass.
  - Not merged yet — needs a manual preview click-through (see the two `/test` reports in-session for the specific NEEDS MANUAL CHECK lists) before merging.
  - The reschedule/auto-revert interaction gap flagged on an earlier branch's `/test` pass (moving Wrap-Up → Engagements without changing `event_date` gets silently bounced back on next reload) still has no dedicated regression check beyond a checklist line — worth actually clicking through once, since it was only ever traced by reading.

## 2026-07-15
- Branch: `add-unarchive-and-move-backward` — merged to `main` this session (`104ad5a`), branch deleted locally and on origin.
- What I did:
  - Built delete company / delete contact (typed-confirmation delete, unlinks rather than blocks on referencing engagements/contacts/comms; `supabase/migrations/allow_delete_companies_contacts.sql`). This ended up bundled into an earlier commit (`f2ca9f7`) alongside a concurrent session's work rather than its own reviewed branch — see Decisions.
  - Ran `/test` against the un-archive / move-engagement-backward feature already on this branch (MCP tools `move_engagement_backward`/`unarchive_engagement`, `src/lib/pipeline.ts`, UI on the engagements/prospects/wrap-up/archive pages). Reported findings by reading only, no manual click-through yet at that point.
  - Diagnosed a live production error reported by Mori: confirming a prospect threw a Supabase 400, `Could not find the 'confirmed_at' column of 'engagements' in the schema cache`. Root cause: `confirmed_at`/`declined_at` are base `schema.sql` columns that `confirmProspect`/`declineProspect` have always written to, but they were missing from the live table (never applied via an actual migration). Added `supabase/migrations/add_confirmed_declined_at.sql`; confirmed run against production this session.
  - Diagnosed a second production error immediately after (React errors #300 then #310) — a genuine Rules-of-Hooks violation: `EngagementDetailPage` (`src/app/engagements/[id]/page.tsx`) called `useCallback` *after* its `if (!e) return` guard, so the hook count changes between renders whenever the engagement lookup toggles found/not-found. Fixed by hoisting the `useCallback` above the guard and guarding its body instead. Swept every other detail page (`companies/[id]`, `contacts/[id]`, `prospects/[id]`, `wrap-up/[id]`, advance-sheet) for the same pattern — all clean.
  - Added a manual "Move to Wrap-Up" button on the engagement detail page, matching the existing Archive/Move Backward pattern — previously the *only* way to reach Wrap-Up was the automatic date-based transition in `fetchAllEngagements()`.
  - Merged the branch into `main` (fast-forward, direct push — no PR) after confirming the migration had been run and testing had passed.
- Bugs found:
  - **`confirmed_at`/`declined_at` missing from the live `engagements` table** — see above. Fixed via migration, confirmed applied.
  - **Hooks-order violation in `EngagementDetailPage`** causing React #300/#310 crashes — see above. Fixed.
  - **Three new components never wired into any route**: `StageHistoryNav.tsx`, `ProspectSnapshotView.tsx`, `EngagementSnapshotView.tsx` (from the same branch's earlier work, by a concurrent session). They type-check and build clean but nothing imports them under `src/app/`; they also duplicate functionality that's already live inline (`SnapshotPanel`/`WrapUpSnapshotPanel`). Left uncommitted/untracked deliberately — not merged to `main`. Still need a decision: finish and wire up, or delete.
  - **MCP tool count in docs was stale** — `CLAUDE.md`/`PROJECT.md` said "27 tools" but this branch added two (`move_engagement_backward`, `unarchive_engagement`), making it 29. Corrected in `PROJECT.md` this session.
- Decisions:
  - Mid-session, discovered another Claude Code session (likely the IDE panel) was editing this same working directory concurrently and had pushed a commit directly to `main`, bypassing branch/review. No data was lost, but it prompted tightening the global `~/.claude/CLAUDE.md` "Version control and shipping" rules: branch *before* the first edit (not after), and commit/push a branch without asking (only merging to `main` still requires explicit approval).
  - Chose a direct fast-forward merge + push for this branch over opening a GitHub PR, since the diff had already been shown and approved in-session.
- Follow-ups / open for next session:
  - Decide the fate of `StageHistoryNav.tsx` / `ProspectSnapshotView.tsx` / `EngagementSnapshotView.tsx` (still sitting untracked locally, not on `main`).
  - Still not confirmed whether `allow_delete_companies_contacts.sql`, `add_business_profile.sql`, and `add_invoice_finalized_status.sql` have been run against production — carried over from 2026-07-11, still open.
  - Manual test coverage still needed: declining a prospect (writes `declined_at`, only spot-checked confirming so far), moving a *declined* prospect (parked in wrap-up) backward to Prospects specifically, unarchiving from the Archive *list* page itself (not just a detail page), and delete company/delete contact end-to-end on a real record (built 2026-07-11, never actually clicked on a live preview).
  - `ANTHROPIC_API_KEY` is still unset everywhere — confirmed again as intentional (client's own Anthropic account, not the developer's).

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
