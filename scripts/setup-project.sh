#!/usr/bin/env bash
#
# Points this repository at a Supabase project and brings it fully up:
# link, migrate, seed, deploy functions, regenerate types.
#
# Safe to re-run. Migrations and the seed are both idempotent.
#
#   SUPABASE_ACCESS_TOKEN=sbp_... \
#   SUPABASE_DB_PASSWORD='...' \
#   scripts/setup-project.sh <project-ref>

set -euo pipefail

REF="${1:-}"

if [[ -z "$REF" ]]; then
  echo "Usage: scripts/setup-project.sh <project-ref>" >&2
  exit 1
fi

for var in SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD; do
  if [[ -z "${!var:-}" ]]; then
    echo "$var must be set." >&2
    exit 1
  fi
done

step() { printf '\n== %s\n' "$1"; }

step "Linking $REF"
npx supabase link --project-ref "$REF"

step "Applying migrations and seed"
npx supabase db push --include-seed

step "Deploying Edge Functions"
npx supabase functions deploy gmail-sync --no-verify-jwt

step "Regenerating types from the live schema"
npx supabase gen types typescript --linked > src/lib/domain/database.types.ts

step "Verifying"
npx supabase migration list
npx tsc -b --force
npx vitest run

cat <<EOF

Done. Two things still have to be set by hand, because they are secrets:

  1. Edge Function secret, for Gmail access:
       npx supabase secrets set GOOGLE_SERVICE_ACCOUNT_KEY="\$(cat secrets/gmail-service-account.json)"

  2. Scheduler credentials, in the SQL editor:
       select set_sync_secret('project_url', 'https://$REF.supabase.co');
       select set_sync_secret('service_role_key', '<service role key>');

Then update .env.local with the new URL and publishable key.
EOF
