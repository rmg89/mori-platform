# Mori Taheripour — Business Platform

A custom platform for managing speaking engagements, client relationships, AI-assisted communications, and business operations.

## Stack

- **Next.js 14** (App Router)
- **Supabase** — database, auth, file storage
- **Claude API (Anthropic)** — email reply drafts, Instagram captions
- **Microsoft Graph API** — email sync (M365) — *stub, connect after demo*
- **Tailwind CSS** — styling
- **jsPDF** — contract/advance sheet/invoice generation

---

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.local.example .env.local
```

Fill in:
- `NEXT_PUBLIC_SUPABASE_URL` — from your Supabase project settings
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase project settings
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project settings (keep secret)
- `ANTHROPIC_API_KEY` — from console.anthropic.com

### 3. Set up Supabase database
- Create a new Supabase project at supabase.com
- Go to SQL Editor → paste and run the contents of `supabase/schema.sql`
- Create storage buckets: `documents` (private) and `media` (private)

### 4. Run the dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Demo Mode

The app ships with rich mock data in `src/lib/mock-data.ts` so every page is fully populated for demo purposes. No Supabase connection is required to run and present the demo.

The AI features (email reply drafts, Instagram captions) require an `ANTHROPIC_API_KEY` to function.

---

## Architecture

```
src/
├── app/
│   ├── dashboard/        # Business snapshot
│   ├── pipeline/         # Client list + [id] detail pages
│   ├── inbox/            # CRM email threads + AI reply
│   ├── ai-tools/         # Instagram caption generator
│   ├── settings/         # Integration config (stub)
│   └── api/
│       ├── clients/      # CRUD — swap mock for Supabase
│       ├── documents/    # PDF generation endpoint
│       └── ai/
│           ├── email-reply/        # Claude email drafter
│           └── instagram-caption/  # Claude caption generator
├── components/
│   └── layout/AppShell.tsx         # Sidebar + top bar
├── lib/
│   ├── mock-data.ts       # Demo seed data
│   ├── documents.ts       # jsPDF contract/invoice/advance sheet generators
│   ├── supabase.ts        # Supabase client
│   └── utils.ts           # Formatting helpers
└── types/index.ts         # All TypeScript types
```

---

## Next Steps (Post-Demo)

### Priority 1: Connect Supabase
Replace `MOCK_CLIENTS` with real Supabase queries in each page. API routes at `/api/clients` are pre-stubbed with `// TODO` comments.

### Priority 2: Microsoft Graph API (Email)
- Register an app in Azure Active Directory
- Add `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` to `.env.local`
- Implement `/api/email/sync` to pull threads from M365
- Implement `/api/email/send` to send replies via Graph API `sendMail` endpoint
- The inbox UI at `/inbox` is fully built and ready to wire up

### Priority 3: Document generation
- Activate `src/lib/documents.ts` client-side PDF generation
- OR build the server-side `/api/documents/generate` route with jsPDF + Supabase Storage upload

### Priority 4: Auth
- Enable Supabase Auth with email/password or Microsoft SSO
- Add middleware to protect routes

### Priority 5: Media storage
- Finalize decision: Supabase Storage vs Google Drive
- Build media upload UI on client detail page (post-event tab)

---

## Notes on HubSpot

This platform intentionally replaces HubSpot with a custom Supabase + Microsoft Graph integration. This gives full control, no third-party sync bugs, and allows the AI reply feature to work natively without a middleware layer.
