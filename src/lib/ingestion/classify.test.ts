import { describe, expect, it } from "vitest";
import { classifyThread, deriveStatus, makeContext, summarise } from "./classify";
import { parseSignature } from "./signature";
import type { ParsedMessage, ParsedThread } from "./types";

const context = makeContext(["sales@cotonex.com", "merch1@cotonex.com", "export@cotonex.com"]);
const NOW = new Date("2026-06-01T12:00:00.000Z");

let counter = 0;
function message(over: Partial<ParsedMessage> = {}): ParsedMessage {
  counter += 1;
  return {
    id: `m${counter}`,
    threadId: "t1",
    from: { email: "sales@cotonex.com" },
    to: [{ email: "buyer@weber.de" }],
    cc: [],
    subject: "Cotonex",
    date: "2026-05-01T09:00:00.000Z",
    body: "Hello.",
    headers: {},
    ...over,
  };
}

const thread = (messages: ParsedMessage[], id = "t1"): ParsedThread => ({ id, messages });

/* A realistic buyer conversation. */
const realBuyerThread = thread([
  message({
    from: { email: "sales@cotonex.com" },
    to: [{ email: "k.weber@heimtextil-weber.de", name: "Klaus Weber" }],
    subject: "Cotonex - home textile manufacturing",
    body: "Dear Mr Weber,\n\nWe manufacture bed linen and towels.\n\nRegards\nCotonex",
    date: "2026-04-01T08:00:00.000Z",
  }),
  message({
    from: { email: "k.weber@heimtextil-weber.de", name: "Klaus Weber" },
    to: [{ email: "sales@cotonex.com" }],
    subject: "Re: Cotonex - home textile manufacturing",
    body:
      "Thank you for your message. Please send a quotation for 200 GSM towels.\n" +
      "What is your MOQ and lead time?\n\n" +
      "Best regards,\n" +
      "Klaus Weber\n" +
      "Head of Purchasing\n" +
      "Heimtextil Weber GmbH\n" +
      "Tel: +49 202 555 118\n",
    date: "2026-04-04T10:00:00.000Z",
  }),
  message({
    from: { email: "sales@cotonex.com" },
    to: [{ email: "k.weber@heimtextil-weber.de" }],
    subject: "Re: Cotonex - home textile manufacturing",
    body: "Our MOQ is 3000 pieces, FOB. Proforma attached.",
    date: "2026-04-20T09:00:00.000Z",
  }),
]);

describe("exclusion", () => {
  it("drops newsletters by their List-Unsubscribe header", () => {
    const result = classifyThread(
      thread([
        message({
          from: { email: "news@textiletrends.com" },
          to: [{ email: "sales@cotonex.com" }],
          subject: "Home textile market report",
          body: "Our weekly round-up of home textile news. Bed linen, towels, cotton.",
          headers: { "list-unsubscribe": "<https://textiletrends.com/u>" },
        }),
      ]),
      context,
      NOW,
    );
    expect(result.verdict).toBe("not_buyer");
    expect(result.excluded).toBe("bulk_mail");
  });

  it("drops out-of-office replies", () => {
    const result = classifyThread(
      thread([
        message(),
        message({
          from: { email: "k.weber@heimtextil-weber.de" },
          to: [{ email: "sales@cotonex.com" }],
          subject: "Out of office",
          body: "I am away until Monday.",
          headers: { "auto-submitted": "auto-replied" },
        }),
      ]),
      context,
      NOW,
    );
    expect(result.excluded).toBe("auto_reply");
  });

  it("drops unattended mailboxes", () => {
    const result = classifyThread(
      thread([
        message({
          from: { email: "noreply@portal.de" },
          to: [{ email: "sales@cotonex.com" }],
          body: "Your order status changed.",
        }),
      ]),
      context,
      NOW,
    );
    expect(result.excluded).toBe("automated_sender");
  });

  it("drops mail sent through a marketing platform", () => {
    const result = classifyThread(
      thread([
        message({
          from: { email: "hello@supplier.it" },
          to: [{ email: "sales@cotonex.com" }],
          subject: "New cotton collection",
          body: "See our new range of towels and bed linen.",
          headers: { "dkim-signature": "v=1; a=rsa-sha256; d=mailchimp.com; s=k1" },
        }),
      ]),
      context,
      NOW,
    );
    expect(result.excluded).toBe("marketing_platform");
  });

  it("drops calendar invitations", () => {
    const result = classifyThread(
      thread([
        message({
          from: { email: "someone@partner.de" },
          to: [{ email: "sales@cotonex.com" }],
          headers: { "content-type": "text/calendar; method=REQUEST" },
        }),
      ]),
      context,
      NOW,
    );
    expect(result.excluded).toBe("calendar_invite");
  });

  it("drops logistics and software vendors", () => {
    const result = classifyThread(
      thread([
        message({
          from: { email: "tracking@dhl.com" },
          to: [{ email: "sales@cotonex.com" }],
          subject: "Your shipment",
          body: "Your container has been delivered.",
        }),
      ]),
      context,
      NOW,
    );
    expect(result.excluded).toBe("vendor_domain");
  });

  it("drops purely internal threads", () => {
    const result = classifyThread(
      thread([
        message({ from: { email: "sales@cotonex.com" }, to: [{ email: "merch1@cotonex.com" }] }),
        message({ from: { email: "merch1@cotonex.com" }, to: [{ email: "sales@cotonex.com" }] }),
      ]),
      context,
      NOW,
    );
    expect(result.excluded).toBe("internal_only");
  });

  it("drops a single unanswered message from a personal address", () => {
    const result = classifyThread(
      thread([
        message({
          from: { email: "randomguy@gmail.com" },
          to: [{ email: "sales@cotonex.com" }],
          subject: "Hello",
          body: "I want to buy towels.",
        }),
      ]),
      context,
      NOW,
    );
    expect(result.excluded).toBe("free_provider_one_shot");
  });

  it("keeps a personal address once a real conversation exists", () => {
    const result = classifyThread(
      thread([
        message({
          from: { email: "buyer.person@gmail.com" },
          to: [{ email: "sales@cotonex.com" }],
          subject: "Enquiry",
          body: "Please send a quotation and your MOQ for bed linen.",
          date: "2026-04-01T09:00:00.000Z",
        }),
        message({
          from: { email: "sales@cotonex.com" },
          to: [{ email: "buyer.person@gmail.com" }],
          body: "Here is our price list.",
          date: "2026-04-05T09:00:00.000Z",
        }),
        message({
          from: { email: "buyer.person@gmail.com" },
          to: [{ email: "sales@cotonex.com" }],
          body: "Thanks, please send samples.",
          date: "2026-04-11T09:00:00.000Z",
        }),
      ]),
      context,
      NOW,
    );
    expect(result.excluded).toBeUndefined();
    expect(result.verdict).toBe("buyer");
  });
});

describe("classification", () => {
  it("accepts a genuine buyer conversation", () => {
    const result = classifyThread(realBuyerThread, context, NOW);
    expect(result.verdict).toBe("buyer");
    expect(result.score).toBeGreaterThanOrEqual(8);
    expect(result.counterparty?.email).toBe("k.weber@heimtextil-weber.de");
  });

  it("extracts the designation and phone from the signature", () => {
    const result = classifyThread(realBuyerThread, context, NOW);
    expect(result.extracted.designation).toMatch(/head of purchasing/i);
    expect(result.extracted.phone).toBe("+49 202 555 118");
    expect(result.extracted.company).toMatch(/Heimtextil Weber GmbH/);
  });

  it("explains itself", () => {
    const result = classifyThread(realBuyerThread, context, NOW);
    const labels = result.signals.map((signal) => signal.label);
    expect(labels).toContain("Two-way conversation");
    expect(labels).toContain("Signature shows a buying role");
    expect(result.signals.some((signal) => signal.label.includes("moq"))).toBe(true);
  });

  it("rejects an SEO pitch even though it is a real person writing", () => {
    const result = classifyThread(
      thread([
        message({
          from: { email: "mark@growthagency.com" },
          to: [{ email: "sales@cotonex.com" }],
          subject: "Boost your cotton textile sales",
          body: "We offer SEO services and link building for manufacturers. Reply to unsubscribe.",
        }),
      ]),
      context,
      NOW,
    );
    expect(result.verdict).toBe("not_buyer");
  });

  it("rejects a job application", () => {
    const result = classifyThread(
      thread([
        message({
          from: { email: "jobseeker@outlook.com" },
          to: [{ email: "sales@cotonex.com" }],
          subject: "Application for merchandiser role",
          body: "Please find my resume attached. I have experience in home textile merchandising.",
        }),
      ]),
      context,
      NOW,
    );
    expect(result.verdict).toBe("not_buyer");
  });

  it("sends a thin one-sided thread to review rather than guessing", () => {
    const result = classifyThread(
      thread([
        message({
          from: { email: "info@sometextiles.fr" },
          to: [{ email: "sales@cotonex.com" }],
          subject: "Question",
          body: "Hello, can you tell me about your fabric range? Thanks.",
        }),
      ]),
      context,
      NOW,
    );
    expect(result.verdict).toBe("review");
  });

  it("does not let vocabulary alone clear the accept bar", () => {
    /* Stuffed with trade terms but no conversation and no signature. */
    const result = classifyThread(
      thread([
        message({
          from: { email: "spam@randomdomain.com" },
          to: [{ email: "sales@cotonex.com" }],
          subject: "RFQ proforma quotation MOQ FOB CIF",
          body: "lab dip strike off GSM thread count purchase order incoterm bill of lading",
        }),
      ]),
      context,
      NOW,
    );
    expect(result.verdict).not.toBe("buyer");
  });

  it("recognises a German buyer writing in German", () => {
    const result = classifyThread(
      thread([
        message({
          from: { email: "sales@cotonex.com" },
          to: [{ email: "einkauf@bettwaren-nord.de" }],
          body: "Guten Tag, wir sind Hersteller von Heimtextilien.",
          date: "2026-04-01T08:00:00.000Z",
        }),
        message({
          from: { email: "p.lindqvist@bettwaren-nord.de", name: "Petra Lindqvist" },
          to: [{ email: "sales@cotonex.com" }],
          subject: "Anfrage Bettwaesche",
          body:
            "Bitte senden Sie uns ein Angebot und Muster.\n\n" +
            "Mit freundlichen Gruessen\n" +
            "Petra Lindqvist\n" +
            "Einkaufsleiterin\n" +
            "Bettwaren Nord GmbH\n" +
            "Tel: +49 40 555 220\n",
          date: "2026-04-09T08:00:00.000Z",
        }),
      ]),
      context,
      NOW,
    );
    expect(result.verdict).toBe("buyer");
    expect(result.extracted.phone).toBe("+49 40 555 220");
  });

  it("counts a repeated term only once", () => {
    const repeated = classifyThread(
      thread([
        message({
          from: { email: "x@firm.de" },
          to: [{ email: "sales@cotonex.com" }],
          body: "sample sample sample sample sample sample sample sample",
        }),
      ]),
      context,
      NOW,
    );
    const once = classifyThread(
      thread([
        message({
          from: { email: "x@firm.de" },
          to: [{ email: "sales@cotonex.com" }],
          body: "sample",
        }),
      ]),
      context,
      NOW,
    );
    expect(repeated.score).toBe(once.score);
  });

  it("does not match a term inside a longer word", () => {
    const result = classifyThread(
      thread([
        message({
          from: { email: "x@firm.de" },
          to: [{ email: "sales@cotonex.com" }],
          body: "The resampling process and the gsmarena review.",
        }),
      ]),
      context,
      NOW,
    );
    expect(result.signals.some((signal) => signal.label.includes("sample"))).toBe(false);
    expect(result.signals.some((signal) => signal.label.includes("gsm"))).toBe(false);
  });
});

describe("deriveStatus", () => {
  const out = (date: string) =>
    message({ from: { email: "sales@cotonex.com" }, to: [{ email: "b@weber.de" }], date, body: "Hello" });
  const inb = (date: string, body = "Thanks") =>
    message({ from: { email: "b@weber.de" }, to: [{ email: "sales@cotonex.com" }], date, body });

  it("is never_contacted for an empty thread", () => {
    expect(deriveStatus(thread([]), context, NOW)).toBe("never_contacted");
  });

  it("is introduction_sent after one unanswered recent message", () => {
    expect(deriveStatus(thread([out("2026-05-20T09:00:00.000Z")]), context, NOW)).toBe("introduction_sent");
  });

  it("is waiting_for_buyer after several recent unanswered messages", () => {
    expect(
      deriveStatus(thread([out("2026-05-15T09:00:00.000Z"), out("2026-05-25T09:00:00.000Z")]), context, NOW),
    ).toBe("waiting_for_buyer");
  });

  it("is no_reply once silence passes a month", () => {
    expect(deriveStatus(thread([out("2026-03-01T09:00:00.000Z")]), context, NOW)).toBe("no_reply");
  });

  it("is buyer_replied when they spoke last", () => {
    expect(
      deriveStatus(thread([out("2026-05-20T09:00:00.000Z"), inb("2026-05-22T09:00:00.000Z")]), context, NOW),
    ).toBe("buyer_replied");
  });

  it("is enquiry_received when their last message asked for a quotation", () => {
    expect(
      deriveStatus(
        thread([out("2026-05-20T09:00:00.000Z"), inb("2026-05-22T09:00:00.000Z", "Please send a quotation")]),
        context,
        NOW,
      ),
    ).toBe("enquiry_received");
  });

  it("is active_lead when they enquired and we answered", () => {
    expect(
      deriveStatus(
        thread([
          out("2026-05-10T09:00:00.000Z"),
          inb("2026-05-12T09:00:00.000Z", "Please send a quotation and your MOQ"),
          out("2026-05-20T09:00:00.000Z"),
        ]),
        context,
        NOW,
      ),
    ).toBe("active_lead");
  });

  it("is follow_up_required when a conversation went quiet after we spoke last", () => {
    expect(
      deriveStatus(
        thread([out("2026-02-01T09:00:00.000Z"), inb("2026-02-05T09:00:00.000Z"), out("2026-02-10T09:00:00.000Z")]),
        context,
        NOW,
      ),
    ).toBe("follow_up_required");
  });
});

describe("parseSignature", () => {
  it("returns nothing for a body with no signature", () => {
    expect(parseSignature("Please send the price list.")).toEqual({});
  });

  it("ignores an order number that looks like a phone number", () => {
    const parsed = parseSignature("Best regards,\nJohn Smith\nOrder 12345678\n");
    expect(parsed.phone).toBeUndefined();
  });

  it("reads a labelled national number", () => {
    const parsed = parseSignature("Regards,\nAnna Brandt\nTel: 0202 555 1180\n");
    expect(parsed.phone).toBe("0202 555 1180");
  });

  it("skips legal boilerplate", () => {
    const parsed = parseSignature(
      "Best regards,\nKlaus Weber\nHead of Purchasing\n" +
        "This e-mail is confidential and may be privileged.\n",
    );
    expect(parsed.designation).toMatch(/head of purchasing/i);
    expect(parsed.company).toBeUndefined();
  });
});

describe("summarise", () => {
  it("tallies verdicts and exclusion reasons", () => {
    const results = [
      classifyThread(realBuyerThread, context, NOW),
      classifyThread(
        thread(
          [message({ from: { email: "tracking@dhl.com" }, to: [{ email: "sales@cotonex.com" }] })],
          "t2",
        ),
        context,
        NOW,
      ),
    ];
    const totals = summarise(results);
    expect(totals.total).toBe(2);
    expect(totals.byVerdict.buyer).toBe(1);
    expect(totals.byExclusion.get("vendor_domain")).toBe(1);
  });
});
