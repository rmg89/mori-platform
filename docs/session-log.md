# Session log

One entry per work session. Newest at the top.

## Template

```
## YYYY-MM-DD
- What changed:
- Why:
- Follow-ups / open questions:
```

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
