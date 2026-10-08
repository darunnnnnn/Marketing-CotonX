# Cotonex Marketing

Buyer intelligence and outreach automation for Cotonex. Separate app and separate
Supabase project from the ERP; a read-only link into the ERP comes later, for
enquiry handoff.

## Stack

- React 19 + TypeScript, built with Vite 8
- React Router 7
- Plain CSS per component (no framework) — tokens in `src/styles/tokens.css`
- ESLint flat config + typescript-eslint
- Supabase — Postgres, auth, storage, Realtime (Phase 1)
- Supabase Edge Functions, Deno (Phase 2)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in once the Supabase project exists
npm run dev
```

| Script | Does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc` only |

## Layout

```
src/
  styles/            tokens.css (palette, radii, spacing) + base.css
  components/ui/     Card, StatTile, Badge, Button, EmptyState
  components/layout/ AppShell, Sidebar, TopBar, AskFab, navigation.ts
  routes/            router.tsx, dashboard/, Placeholder.tsx
  lib/supabase.ts    browser Supabase client
```

Each component owns a sibling `.css` file. Colours, radii, spacing and type
sizes come from tokens — avoid hard-coded values so the app tracks the ERP's
look as that changes.

## Build phases

| Phase | Scope | State |
| --- | --- | --- |
| 0 | Scaffold, design system, app shell, routing | done |
| 1 | Supabase schema, auth, RBAC | deferred |
| 2 | Gmail ingestion | blocked (see below) |
| 3 | Country segmentation, dedup/merge, verification UI | done |
| 4 | Apollo and other acquisition sources | done, key pending |
| 5 | Campaign engine, approvals, timezone scheduling | done |
| 6 | Tracking, reply-stop, human handoff | done |
| 8 | WhatsApp / SMS | modelled |
| 9 | AI voice agent, warm contacts only | modelled |

Phases 3 to 6 are built against `memoryRepo`, an in-memory implementation of
the `Repository` interface seeded with realistic data. Phase 1 swaps in a
Supabase-backed implementation of that same interface; no screen changes.

## Architecture

```
src/lib/
  domain/types.ts        the schema design - channel-agnostic by construction
  domain/repository.ts   the only seam between UI and storage
  domain/countries.ts    timezones, working hours, next-send-slot
  domain/seed.ts         demo data matching the domain types exactly
  campaign/engine.ts     eligibility, sequence memory, reply-stop (pure)
  enrichment/            what an email address alone can tell us
  sources/apollo.ts      Apollo adapter, Edge Function + sample fallback
  sending/provider.ts    EmailProvider interface; Sender/Resend/Postmark TBD
```

Three seams keep later decisions cheap:

- **`Repository`** - swap in-memory for Supabase without touching a screen.
- **`EmailProvider`** - the Sender.net vs Resend choice is one line.
- **`channel` on every campaign step and event** - WhatsApp and voice reuse the
  engine rather than forking it.

The campaign engine is pure functions over the domain model, so the rules that
decide who gets contacted are testable in isolation and run identically in the
browser or in an Edge Function.

## What works right now

Run `npm run dev` and everything below is clickable against seed data:

- **Buyers &rarr; Lookup** - enter any email, see every derivable fact with its
  source and confidence, and which sources are still dark.
- **Segments** - the database by country with live local times and send windows.
- **Review Queue** - duplicate merging and verification gating.
- **Sources &rarr; Apollo** - the fixed buyer-targeting preset; results are
  generated locally until a key is configured.
- **Sources &rarr; Imports** - real CSV parsing, column matching, gap-filling.
- **Campaigns &rarr; any campaign** - the live send plan: who gets which step,
  at what time in their own timezone, and why everyone else was excluded.
- **Activity** - "Simulate reply" on any sent event demonstrates the reply-stop
  rule end to end.

## Decisions on record

- **Separate repo and separate Supabase project** from the ERP.
- **Gmail** for mailbox ingestion (~10 mailboxes, ~3 years of history).
- **Email provider stays open.** Sending sits behind an `EmailProvider` adapter;
  Sender.net vs Resend is settled in Phase 6 against real sequencing needs.
- **Channel-agnostic outreach tables from Phase 1**, so WhatsApp and voice do not
  require rewriting the campaign engine.
- **Reply detection halts the sequence** and hands the buyer to the sales team.
  Built fail-safe: if detection is uncertain, stop anyway.

## Open items before Phase 1

- Supabase project created; URL and anon key into `.env.local`.
- Sending subdomain decided and DNS (SPF/DKIM/DMARC) started — warming takes
  weeks of calendar time regardless of code.
- Google Cloud project with the Gmail API enabled, OAuth consent screen
  configured for the Cotonex workspace.
