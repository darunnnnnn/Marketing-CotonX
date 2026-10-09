import { describe, expect, it } from "vitest";
import {
  decodeWords,
  normaliseSubject,
  parseAddresses,
  parseMbox,
  splitHeaders,
  splitMbox,
  stripQuoted,
} from "./mbox.ts";
import { classifyAll, makeContext } from "./classify.ts";

const SAMPLE = `From 1234567890 Mon Apr 06 09:12:03 2026
Message-ID: <a1@weber.de>
Date: Mon, 6 Apr 2026 11:12:03 +0200
From: "Weber, Klaus" <k.weber@heimtextil-weber.de>
To: sales@cotonex.com
Subject: =?UTF-8?Q?Anfrage_Bettw=C3=A4sche?=
Content-Type: text/plain; charset="utf-8"

Guten Tag,

bitte senden Sie uns ein Angebot und Muster.

Mit freundlichen Gruessen
Klaus Weber
Head of Purchasing
Heimtextil Weber GmbH
Tel: +49 202 555 118

From 1234567891 Tue Apr 07 08:00:00 2026
Message-ID: <b2@cotonex.com>
In-Reply-To: <a1@weber.de>
References: <a1@weber.de>
Date: Tue, 7 Apr 2026 10:00:00 +0200
From: Cotonex Sales <sales@cotonex.com>
To: "Weber, Klaus" <k.weber@heimtextil-weber.de>
Subject: Re: Anfrage Bettwaesche
Content-Type: text/plain

Sehr geehrter Herr Weber,

anbei unser Angebot. MOQ 3000 Stueck, FOB.

> Guten Tag,
> bitte senden Sie uns ein Angebot.

From 1234567892 Wed Apr 08 07:00:00 2026
Message-ID: <c3@news.com>
Date: Wed, 8 Apr 2026 09:00:00 +0200
From: Textile Weekly <news@textileweekly.com>
To: sales@cotonex.com
Subject: This week in home textiles
List-Unsubscribe: <https://textileweekly.com/u>
Content-Type: text/plain

Bed linen, towels and cotton news.
`;

describe("splitMbox", () => {
  it("splits on the From separator", () => {
    expect(splitMbox(SAMPLE)).toHaveLength(3);
  });

  it("returns nothing for an empty file", () => {
    expect(splitMbox("")).toHaveLength(0);
    expect(splitMbox("\n\n  \n")).toHaveLength(0);
  });

  it("unescapes mboxrd quoting so a body line is not lost", () => {
    const blocks = splitMbox("From x Mon Apr 06 09:12:03 2026\nSubject: t\n\n>From the start\n");
    expect(blocks[0]).toContain("From the start");
  });
});

describe("splitHeaders", () => {
  it("separates headers from the body", () => {
    const { headers, body } = splitHeaders("Subject: Hello\nFrom: a@b.c\n\nBody text");
    expect(headers.subject).toBe("Hello");
    expect(body).toBe("Body text");
  });

  it("unfolds continuation lines", () => {
    const { headers } = splitHeaders("Subject: a very\n  long subject\n\nBody");
    expect(headers.subject).toBe("a very long subject");
  });

  it("lower-cases header names", () => {
    const { headers } = splitHeaders("LIST-UNSUBSCRIBE: <x>\n\nBody");
    expect(headers["list-unsubscribe"]).toBe("<x>");
  });

  it("concatenates repeated headers instead of losing them", () => {
    const { headers } = splitHeaders("Received: from a\nReceived: from b\n\nBody");
    expect(headers.received).toContain("from a");
    expect(headers.received).toContain("from b");
  });
});

describe("decodeWords", () => {
  it("decodes quoted-printable encoded words", () => {
    expect(decodeWords("=?UTF-8?Q?Anfrage_Bettw=C3=A4sche?=")).toBe("Anfrage Bettwäsche");
  });

  it("decodes base64 encoded words", () => {
    expect(decodeWords("=?UTF-8?B?SGVsbG8gV29ybGQ=?=")).toBe("Hello World");
  });

  it("leaves plain text alone", () => {
    expect(decodeWords("Plain subject")).toBe("Plain subject");
  });
});

describe("parseAddresses", () => {
  it("reads a bare address", () => {
    expect(parseAddresses("a@b.com")).toEqual([{ email: "a@b.com" }]);
  });

  it("reads a display name with angle brackets", () => {
    expect(parseAddresses("Klaus Weber <k@weber.de>")).toEqual([
      { name: "Klaus Weber", email: "k@weber.de" },
    ]);
  });

  it("does not split on a comma inside a quoted name", () => {
    const parsed = parseAddresses('"Weber, Klaus" <k@weber.de>, other@firm.nl');
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({ name: "Weber, Klaus", email: "k@weber.de" });
  });

  it("lower-cases the address but keeps the name as written", () => {
    expect(parseAddresses("Klaus Weber <K.Weber@Weber.DE>")[0]).toEqual({
      name: "Klaus Weber",
      email: "k.weber@weber.de",
    });
  });

  it("ignores entries with no address", () => {
    expect(parseAddresses("undisclosed-recipients:;")).toHaveLength(0);
  });

  it("returns nothing for undefined", () => {
    expect(parseAddresses(undefined)).toHaveLength(0);
  });
});

describe("stripQuoted", () => {
  it("removes quoted lines", () => {
    expect(stripQuoted("My reply.\n> their text\n> more")).toBe("My reply.");
  });

  it("stops at an attribution line", () => {
    expect(stripQuoted("My reply.\nOn Mon, 6 Apr 2026 at 10:00, Klaus wrote:\nold text")).toBe("My reply.");
  });

  it("stops at a forwarded-message marker", () => {
    expect(stripQuoted("See below.\n---------- Forwarded message ----------\nold")).toBe("See below.");
  });
});

describe("threading", () => {
  it("groups a reply with its original through References", () => {
    const threads = parseMbox(SAMPLE);
    expect(threads.find((thread) => thread.messages.length === 2)).toBeDefined();
  });

  it("normalises reply prefixes across languages", () => {
    const keys = ["Anfrage", "Re: Anfrage", "AW: Anfrage", "Fwd: Anfrage", "RE: AW: Anfrage"].map(
      normaliseSubject,
    );
    expect(new Set(keys).size).toBe(1);
  });

  it("groups by subject when References is missing, if a participant is shared", () => {
    const noRefs = [
      "From x Mon Apr 06 09:00:00 2026",
      "Message-ID: <r1@weber.de>",
      "Date: Mon, 6 Apr 2026 09:00:00 +0000",
      "From: k.weber@weber.de",
      "To: sales@cotonex.com",
      "Subject: Towels",
      "",
      "Do you make towels?",
      "",
      "From x Tue Apr 07 09:00:00 2026",
      "Message-ID: <r2@cotonex.com>",
      "Date: Tue, 7 Apr 2026 09:00:00 +0000",
      "From: sales@cotonex.com",
      "To: k.weber@weber.de",
      "Subject: Re: Towels",
      "",
      "Yes we do.",
      "",
    ].join(String.fromCharCode(10));
    const threads = parseMbox(noRefs);
    expect(threads).toHaveLength(1);
    expect(threads[0].messages).toHaveLength(2);
  });

  it("does not merge same-subject threads from unrelated buyers", () => {
    const collision = [
      "From x Mon Apr 06 09:00:00 2026",
      "Message-ID: <e1@one.de>",
      "Date: Mon, 6 Apr 2026 09:00:00 +0000",
      "From: a@one.de",
      "To: sales@cotonex.com",
      "Subject: Enquiry",
      "",
      "Hello from company one.",
      "",
      "From x Mon Apr 06 10:00:00 2026",
      "Message-ID: <e2@two.nl>",
      "Date: Mon, 6 Apr 2026 10:00:00 +0000",
      "From: b@two.nl",
      "To: export@cotonex.com",
      "Subject: Enquiry",
      "",
      "Hello from company two.",
      "",
    ].join(String.fromCharCode(10));
    expect(parseMbox(collision)).toHaveLength(2);
  });
});

describe("parseMbox end to end", () => {
  const threads = parseMbox(SAMPLE);

  it("produces two threads from three messages", () => {
    expect(threads).toHaveLength(2);
  });

  it("decodes the subject and orders messages oldest first", () => {
    const conversation = threads.find((thread) => thread.messages.length === 2)!;
    expect(conversation.messages[0].subject).toBe("Anfrage Bettwäsche");
    expect(conversation.messages[0].date < conversation.messages[1].date).toBe(true);
  });

  it("strips the quoted history from the reply", () => {
    const conversation = threads.find((thread) => thread.messages.length === 2)!;
    expect(conversation.messages[1].body).not.toContain("> Guten Tag");
    expect(conversation.messages[1].body).toContain("MOQ 3000");
  });

  it("feeds the classifier: the buyer is accepted, the newsletter is not", () => {
    const context = makeContext(["sales@cotonex.com"]);
    const results = classifyAll(threads, context, new Date("2026-06-01T00:00:00.000Z"));

    const buyer = results.find((result) => result.counterparty?.email === "k.weber@heimtextil-weber.de");
    expect(buyer?.verdict).toBe("buyer");
    expect(buyer?.extracted.phone).toBe("+49 202 555 118");
    expect(buyer?.extracted.designation).toMatch(/head of purchasing/i);

    const newsletter = results.find((result) => result.counterparty?.email === "news@textileweekly.com");
    expect(newsletter?.excluded).toBe("bulk_mail");
  });

  it("survives a malformed file without throwing", () => {
    expect(() => parseMbox("garbage\nnot an mbox at all")).not.toThrow();
    expect(() => parseMbox("")).not.toThrow();
  });
});
