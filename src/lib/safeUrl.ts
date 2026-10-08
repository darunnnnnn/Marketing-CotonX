/**
 * Company websites arrive from CSV imports and enrichment, so they are
 * untrusted. A `javascript:` or `data:` URL in an href is a script-injection
 * vector; this returns a URL only when it is plainly safe to link to.
 */

const ALLOWED = new Set(["http:", "https:"]);

export function safeUrl(input: string | undefined): string | undefined {
  if (!input) return undefined;

  const trimmed = input.trim();
  if (!trimmed) return undefined;

  /* A bare domain is the common case in imported data. */
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    return ALLOWED.has(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
