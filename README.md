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
| 1 | Buyer database schema, auth, RBAC | next |
| 2 | Gmail ingestion — 10 mailboxes, 3 years | |
| 3 | Country segmentation, dedup/merge, verification UI | |
| 4 | Apollo and other acquisition sources | |
| 5 | Campaign engine — sequences, approvals, timezone scheduling | |
| 6 | Sending, tracking, reply-stop and human handoff | |
| 8 | WhatsApp / SMS on the same sequence engine | |
| 9 | AI voice agent, warm contacts only | |

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
