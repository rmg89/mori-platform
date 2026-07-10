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
- What changed: Scaffolded project dev-process files — `CLAUDE.md`, `PROJECT.md`, `docs/session-log.md` — from the actual codebase. Also fixed the MCP endpoint (`src/app/api/[transport]/route.ts`) found unauthenticated during scaffolding — it now requires `Authorization: Bearer <MCP_SECRET_TOKEN>` on every request (fails closed if the env var is unset), verified with curl (401 with no/wrong token, request reaches the handler with the correct one).
- Why: None of the three docs existed yet; needed to bootstrap the standing docs the other workflow skills (`/test`, `/wrap`) rely on. The MCP endpoint fix was because, unauthenticated, anyone with the URL could call any of the 27 tools — including field updates, contact deletion, and engagement archiving — against production data.
- Follow-ups / open questions:
  - Confirm whether Vercel preview deployments share the production Supabase project (see `CLAUDE.md` → Data safety)
  - No committed product roadmap found — PROJECT.md's "Planned" section is a placeholder pending input
  - MCP clients (including any Claude connector pointed at this server) now need `MCP_SECRET_TOKEN` set as their bearer token, or they'll get 401s
