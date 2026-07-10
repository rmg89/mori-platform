# Session log

One entry per work session. Newest at the top.

## Template

```
## YYYY-MM-DD
- What changed:
- Why:
- Follow-ups / open questions:
```

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
