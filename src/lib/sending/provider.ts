/**
 * The sending seam (requirement 18).
 *
 * Sender.net vs Resend vs Postmark is deliberately not decided here. Every
 * provider implements this interface, the engine only ever sees the interface,
 * and switching provider is a one-line change in `activeProvider`.
 *
 * Nothing sends until a provider is configured, and the UI says so rather than
 * silently doing nothing.
 */

import type { Channel } from "../domain/types";

export type SendRequest = {
  to: string;
  toName?: string;
  subject: string;
  body: string;
  attachments: string[];
  channel: Channel;
  /** Round-trips through the provider so webhooks can be matched to a send. */
  metadata: { contactId: string; campaignId: string; stepId: string };
};

export type SendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string; retryable: boolean };

export type ProviderCapability = {
  id: string;
  label: string;
  channels: Channel[];
  /** Whether per-contact sequence state must be held by us rather than them. */
  sequencingHandledLocally: boolean;
  supportsWebhooks: boolean;
  requiresVerifiedDomain: boolean;
  notes: string;
};

export interface EmailProvider {
  readonly capability: ProviderCapability;
  configured(): boolean;
  send(request: SendRequest): Promise<SendResult>;
}

/** Candidates, with the tradeoffs that decide between them in Phase 6. */
export const PROVIDER_OPTIONS: ProviderCapability[] = [
  {
    id: "sender",
    label: "Sender.net",
    channels: ["email"],
    sequencingHandledLocally: true,
    supportsWebhooks: true,
    requiresVerifiedDomain: true,
    notes:
      "Newsletter-oriented. Campaign sends are straightforward; per-contact sequence state has to stay on our side, since its automations are list-based rather than contact-based.",
  },
  {
    id: "resend",
    label: "Resend",
    channels: ["email"],
    sequencingHandledLocally: true,
    supportsWebhooks: true,
    requiresVerifiedDomain: true,
    notes: "Transactional API, one call per message. Fits an engine that already owns sequencing.",
  },
  {
    id: "postmark",
    label: "Postmark",
    channels: ["email"],
    sequencingHandledLocally: true,
    supportsWebhooks: true,
    requiresVerifiedDomain: true,
    notes: "Strongest deliverability reporting of the three. Strict about unsolicited bulk mail.",
  },
];

/**
 * Stands in until a provider is chosen and keyed. Records what would have been
 * sent so the queue and activity screens behave exactly as they will in
 * production, without anything leaving the building.
 */
export class DryRunProvider implements EmailProvider {
  readonly capability: ProviderCapability = {
    id: "dry-run",
    label: "Dry run (nothing is sent)",
    channels: ["email", "whatsapp", "sms", "voice"],
    sequencingHandledLocally: true,
    supportsWebhooks: false,
    requiresVerifiedDomain: false,
    notes: "No provider configured. Sends are simulated and logged so the pipeline can be exercised end to end.",
  };

  readonly outbox: (SendRequest & { at: string })[] = [];

  configured(): boolean {
    return false;
  }

  async send(request: SendRequest): Promise<SendResult> {
    this.outbox.push({ ...request, at: new Date().toISOString() });
    return { ok: true, providerMessageId: `dry-run-${this.outbox.length}` };
  }
}

export const activeProvider: EmailProvider = new DryRunProvider();

/** Blocks a real send when the prerequisites are not met. */
export function sendingBlockers(): string[] {
  const blockers: string[] = [];
  if (!activeProvider.configured()) {
    blockers.push("No email provider is configured — sends are simulated.");
  }
  if (!import.meta.env.VITE_SUPABASE_URL) {
    blockers.push("No Supabase project — the queue is held in browser memory and is lost on reload.");
  }
  blockers.push("No authenticated sending domain — campaigns cannot be delivered from a free mailbox provider.");
  return blockers;
}
