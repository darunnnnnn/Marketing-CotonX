import { Badge } from "./Badge";
import { STATUS_LABELS } from "../../lib/domain/types";
import type { ContactStatus } from "../../lib/domain/types";
import type { Tone } from "./StatTile";

/** One mapping of status to colour, used everywhere a status is shown. */
const TONES: Record<ContactStatus, Tone | "neutral"> = {
  never_contacted: "neutral",
  introduction_sent: "blue",
  conversation_started: "violet",
  buyer_replied: "green",
  waiting_for_buyer: "amber",
  no_reply: "rose",
  follow_up_required: "amber",
  enquiry_received: "green",
  active_lead: "teal",
};

export function StatusBadge({ status }: { status: ContactStatus }) {
  return <Badge tone={TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
