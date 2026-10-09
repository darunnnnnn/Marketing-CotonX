/**
 * Google service account authentication with domain-wide delegation.
 *
 * Signs a JWT asserting "this service account, acting as <mailbox>, wants the
 * Gmail read-only scope", and exchanges it for an access token. The Workspace
 * admin authorised that impersonation once in the Admin console; no per-user
 * consent and no refresh tokens are involved.
 *
 * Only the read-only scope is ever requested. The delegation grant is also
 * limited to that scope, so this cannot send, delete or modify mail even if
 * the code asked it to.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GMAIL_READONLY = "https://www.googleapis.com/auth/gmail.readonly";

export type ServiceAccount = {
  client_email: string;
  private_key: string;
  client_id?: string;
};

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const encodeJson = (value: unknown) => base64Url(new TextEncoder().encode(JSON.stringify(value)));

/** Turns the PEM in the key file into something Web Crypto will import. */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    /* Key files carry literal \n when they have been through an env var. */
    .replace(/\\n/g, "")
    .replace(/\s/g, "");

  const binary = atob(body);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    bytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/* Tokens last an hour; re-minting one per mailbox per run is wasteful and
   counts against the token endpoint's rate limit. */
const cache = new Map<string, { token: string; expiresAt: number }>();

/**
 * An access token that acts as `subject`.
 *
 * @param subject the mailbox to impersonate, e.g. sales@cotonex.com
 */
export async function getAccessToken(
  account: ServiceAccount,
  subject: string,
  scope: string = GMAIL_READONLY,
): Promise<string> {
  const key = `${account.client_email}:${subject}:${scope}`;
  const cached = cache.get(key);
  /* 60s of slack so a token cannot expire mid-request. */
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: "RS256", typ: "JWT" });
  const claims = encodeJson({
    iss: account.client_email,
    sub: subject,
    scope,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  });

  const signingInput = `${header}.${claims}`;
  const privateKey = await importPrivateKey(account.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput),
  );

  const assertion = `${signingInput}.${base64Url(new Uint8Array(signature))}`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    /* Translate the two failures this setup actually produces. A raw
       "unauthorized_client" tells an operator nothing. */
    const code = payload.error ?? `http_${response.status}`;
    if (code === "unauthorized_client") {
      throw new Error(
        `Domain-wide delegation is not authorised for ${subject}. In the Admin console, ` +
          `Security > Access and data control > API controls > Manage Domain Wide Delegation, ` +
          `confirm client ID ${account.client_id ?? "(unknown)"} is granted exactly ${scope}.`,
      );
    }
    if (code === "invalid_grant") {
      throw new Error(
        `Google rejected the impersonation of ${subject}. Usually this means the mailbox ` +
          `does not exist in the domain, or the server clock is skewed.`,
      );
    }
    throw new Error(`Token request failed (${code}): ${payload.error_description ?? "no detail"}`);
  }

  cache.set(key, {
    token: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  });

  return payload.access_token;
}

/** Reads and validates the service account key from the environment. */
export function loadServiceAccount(raw: string | undefined): ServiceAccount {
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set in the Edge Function secrets.");
  }
  let parsed: Partial<ServiceAccount>;
  try {
    parsed = JSON.parse(raw) as Partial<ServiceAccount>;
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON. Paste the whole key file.");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("The service account key is missing client_email or private_key.");
  }
  return parsed as ServiceAccount;
}
