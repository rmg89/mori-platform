---
description: End-of-session wrap-up for the current branch, mori-platform only. Same as the global /wrap, plus a gated auto-merge to main once the gates below pass.
---

# /wrap: end-of-session wrap-up (mori-platform override)

This project overrides the global `/wrap` (`~/.claude/commands/wrap.md`) to also merge to `main` once verified — but only under the gates below. This override is scoped to this repo; every other project still uses the global doc-only `/wrap`. Do not copy this file into another project without the user separately asking for it there.

Run this once per branch, right after that branch's work is done.

Do the following, in order:

1. Find what changed.
   Look at what this branch changed versus main (`git diff main...HEAD`, `git log main..HEAD`). That diff is the subject matter for everything below. If earlier turns in this conversation touched a *different* branch, that's out of scope here — it gets its own `/wrap` run when that branch is current. Don't reach for conversation memory to fill in what the diff doesn't show.

2. Summarize this branch's work.
   From that diff (plus the commit messages), reconstruct: features touched, bugs fixed, decisions made. Do not invent anything, and do not narrate work from other branches.

3. Append the summary to docs/session-log.md.
   Add a new entry at the top (most recent first) using the format already in that file. Include today's date, this branch's name, a "What I did" list, bugs found, decisions worth remembering, and anything still open. State plainly whether this entry ends with the branch merged or still open — steps 8-9 below decide which.

4. Update PROJECT.md.
   Move shipped features into "Shipped," newly committed work into "Planned." Add new bugs to "Known bugs," mark fixed ones fixed. If a bug was caught this session, add a regression checklist item. Fold in anything `/test` flagged as worth keeping.

5. Append new lessons to the project CLAUDE.md inbox.
   Tag each `[platform]` or `[craft]`. Keep each to a line or two. Capture first, route later.

6. Commit and push the doc updates.
   Stage only `docs/session-log.md`, `PROJECT.md`, `CLAUDE.md` — never a blanket add. Commit with a short conventional message (`docs: ...`), `Co-Authored-By` trailer. Push the current branch. Doc-only commit, no approval needed, same as any branch push.

7. Check the merge gates. All of these must hold, or stop and ask instead of merging — a failed or ambiguous gate is not a reason to proceed quietly:
   - **Session-scoped**: every commit in `main..HEAD` was made in *this* conversation session — not a branch you're resuming cold with no memory of its contents. If you can't personally account for each commit, stop and ask.
   - **Clean and pushed**: `git status` clean, branch pushed to origin, nothing uncommitted left behind.
   - **Type-check clean**: `tsc --noEmit` (or equivalent) passes on the branch.
   - **Build clean**: a real `npm run build` succeeds — not just a type-check. If it fails only on a missing local env var (a known false-negative in this repo, see CLAUDE.md), note that explicitly rather than treating it as a real failure.
   - **main hasn't left this branch behind uncontrolled**: if `main` has moved since this branch started, merge latest `main` into the branch *first* (not at merge time), resolve any conflicts on the branch, and re-verify type-check/build after resolving. State which side's logic was kept on any real (non-doc) conflict.
   - **Preview deploy green**: retrieve the real Vercel preview URL for the branch (CLI or GitHub link, never guessed) and confirm status is `Ready` before merging.
   - **Reviewed**: `/test` (or `/code-review`) has been run this session against the branch's *final* state, with no unresolved CONFIRMED/blocking findings.
   - **Manual-check list cleared or explicitly waived**: the user invoking `/wrap` on a branch *is itself* the signal that they've checked it and it's ready to finish — confirmed explicitly by the user 2026-07-17. Don't hold this gate open waiting for a separate statement beyond the `/wrap` invocation; that's asking twice for something already given. If the user's own words in this conversation say otherwise (e.g. they flag a specific item as still unverified, or say they haven't tested yet), that overrides the default and the gate stays open for that item.
   - **No destructive change hiding in the diff**: a dropped/altered column, a data-mutating migration, a tightened constraint, or any other one-way change always stops for separate explicit approval regardless of the gates above — this mirrors the existing Supabase migration autonomy split in CLAUDE.md and is never auto-approved by this command.

8. If every gate passes: merge to main.
   Merge (or fast-forward push, if `main` is checked out in a separate worktree and can't be checked out here) into `main`. Confirm the resulting production deploy reaches `Ready`. Delete the merged branch on the remote; delete it locally too unless blocked (e.g. by a worktree holding it elsewhere, or by currently being checked out here — note the block rather than forcing it).
   If any gate failed or was ambiguous: do not merge. Say plainly which gate stopped you, and what's needed before it can pass.

9. Report back.
   State whether the branch was merged or is still open, and why. Include: session log entry, PROJECT.md changes, inbox lessons with tags, the doc commit (short SHA), and — if merged — the merge commit and the production deploy status. If not merged, name the specific gate that's outstanding.
