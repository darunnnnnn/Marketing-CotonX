/**
 * Confirms the Gmail delegation chain works end to end, before Phase 2 builds on it:
 *   service account key -> impersonate a mailbox -> read threads.
 *
 *   node scripts/verify-gmail.mjs <mailbox@cotonex.com>
 *
 * Reads the key path from GOOGLE_SERVICE_ACCOUNT_KEY, defaulting to
 * secrets/gmail-service-account.json (gitignored).
 *
 * Uses google-auth-library + fetch rather than the googleapis SDK so the auth
 * flow matches what the Deno Edge Function will do in Phase 2.
 */

import { readFileSync } from "node:fs";
import { JWT } from "google-auth-library";

const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const KEY_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? "secrets/gmail-service-account.json";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

const mailbox = process.argv[2];
if (!mailbox) {
  console.error("Usage: node scripts/verify-gmail.mjs <mailbox@cotonex.com>");
  process.exit(1);
}

let key;
try {
  key = JSON.parse(readFileSync(KEY_PATH, "utf8"));
} catch {
  console.error(`Could not read the service account key at ${KEY_PATH}`);
  console.error("Download it from Google Cloud > IAM & Admin > Service Accounts > Keys,");
  console.error("or point GOOGLE_SERVICE_ACCOUNT_KEY at it.");
  process.exit(1);
}

/** Explains the failures this setup actually produces, rather than a raw 403. */
function diagnose(status, body) {
  if (status === 401) {
    return "Key rejected. Check the JSON is the current key for this service account.";
  }
  if (status === 403 && /not authorized|unauthorized_client|access_denied/i.test(body)) {
    return [
      "Delegation is not authorized yet (or the scope does not match).",
      "Admin console > Security > Access and data control > API controls",
      "  > Manage Domain Wide Delegation",
      `  Client ID: ${key.client_id}`,
      `  Scope:     ${SCOPE}`,
      "Changes can take a few minutes to take effect.",
    ].join("\n");
  }
  if (status === 403) return "Gmail API may not be enabled on the project.";
  if (status === 404) return `No such mailbox in this domain: ${mailbox}`;
  return "";
}

async function call(path, token) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.text();
  if (!res.ok) {
    console.error(`\nHTTP ${res.status} on ${path}\n`);
    const hint = diagnose(res.status, body);
    if (hint) console.error(`${hint}\n`);
    console.error(body.slice(0, 600));
    process.exit(1);
  }
  return JSON.parse(body);
}

console.log(`Service account : ${key.client_email}`);
console.log(`Client ID       : ${key.client_id}`);
console.log(`Impersonating   : ${mailbox}`);
console.log(`Scope           : ${SCOPE}\n`);

const auth = new JWT({
  email: key.client_email,
  key: key.private_key,
  scopes: [SCOPE],
  subject: mailbox,
});

let token;
try {
  ({ access_token: token } = await auth.authorize());
} catch (error) {
  console.error("Token request failed.\n");
  console.error(diagnose(403, String(error?.message ?? error)));
  process.exit(1);
}

const profile = await call("/profile", token);
console.log(`Mailbox         : ${profile.emailAddress}`);
console.log(`Total messages  : ${profile.messagesTotal.toLocaleString()}`);
console.log(`Total threads   : ${profile.threadsTotal.toLocaleString()}`);

/* A rough sense of the Phase 2 backfill: how much mail is in the last 3 years. */
const recent = await call("/messages?q=newer_than:3y&maxResults=1", token);
if (recent.resultSizeEstimate !== undefined) {
  console.log(`Last 3 years    : ~${recent.resultSizeEstimate.toLocaleString()} messages (estimate)`);
}

const { threads = [] } = await call("/threads?maxResults=5", token);
console.log(`\nMost recent ${threads.length} threads:`);

for (const { id } of threads) {
  const thread = await call(`/threads/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, token);
  const headers = thread.messages?.[0]?.payload?.headers ?? [];
  const get = (name) => headers.find((h) => h.name === name)?.value ?? "(none)";
  console.log(`  - ${get("Subject")}`);
  console.log(`      from ${get("From")} · ${get("Date")} · ${thread.messages?.length ?? 0} message(s)`);
}

console.log("\nDelegation works. Phase 2 ingestion can be built against this.");
