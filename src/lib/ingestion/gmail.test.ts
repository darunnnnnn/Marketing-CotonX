import { describe, expect, it } from "vitest";
import {
  backfillQuery,
  decodeBase64Url,
  extractBody,
  headerMap,
  shouldSkip,
  toParsedMessage,
  toParsedThread,
} from "./gmail.ts";
import type { GmailMessage, GmailPart } from "./gmail.ts";
import { classifyThread, makeContext } from "./classify.ts";

const b64 = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const NOW = new Date("2026-06-01T00:00:00.000Z");
const context = makeContext(["sales@cotonex.com", "merch1@cotonex.com"]);

describe("decodeBase64Url", () => {
  it("decodes base64url without padding", () => {
    expect(decodeBase64Url(b64("Hello"))).toBe("Hello");
  });

  it("decodes multi-byte UTF-8 correctly", () => {
    expect(decodeBase64Url(b64("Bettwäsche für Köln"))).toBe("Bettwäsche für Köln");
  });

  it("returns empty string on malformed input rather than throwing", () => {
    expect(() => decodeBase64Url("!!!not base64!!!")).not.toThrow();
  });
});

describe("headerMap", () => {
  it("lower-cases names", () => {
    expect(headerMap([{ name: "List-Unsubscribe", value: "<x>" }])["list-unsubscribe"]).toBe("<x>");
  });

  it("concatenates repeated headers", () => {
    const map = headerMap([
      { name: "Received", value: "from a" },
      { name: "Received", value: "from b" },
    ]);
    expect(map.received).toBe("from a from b");
  });

  it("handles no headers", () => {
    expect(headerMap(undefined)).toEqual({});
  });
});

describe("extractBody", () => {
  it("reads a simple text/plain part", () => {
    const part: GmailPart = { mimeType: "text/plain", body: { data: b64("Plain body") } };
    expect(extractBody(part)).toBe("Plain body");
  });

  it("prefers text/plain over text/html in a multipart/alternative", () => {
    const part: GmailPart = {
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/html", body: { data: b64("<p>HTML body</p>") } },
        { mimeType: "text/plain", body: { data: b64("Plain body") } },
      ],
    };
    expect(extractBody(part)).toBe("Plain body");
  });

  it("falls back to HTML, stripped to text", () => {
    const part: GmailPart = {
      mimeType: "multipart/alternative",
      parts: [{ mimeType: "text/html", body: { data: b64("<p>Hello</p><p>World</p>") } }],
    };
    expect(extractBody(part)).toBe("Hello\nWorld");
  });

  it("descends into nested multipart", () => {
    const part: GmailPart = {
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [{ mimeType: "text/plain", body: { data: b64("Nested body") } }],
        },
      ],
    };
    expect(extractBody(part)).toBe("Nested body");
  });

  it("never reads an attachment", () => {
    const part: GmailPart = {
      mimeType: "multipart/mixed",
      parts: [
        { mimeType: "text/plain", body: { data: b64("Real body") } },
        {
          mimeType: "application/pdf",
          filename: "quote.pdf",
          body: { attachmentId: "abc", size: 90000 },
        },
      ],
    };
    expect(extractBody(part)).toBe("Real body");
  });

  it("returns empty for a missing payload", () => {
    expect(extractBody(undefined)).toBe("");
  });
});

describe("toParsedMessage", () => {
  const message: GmailMessage = {
    id: "gmail-1",
    threadId: "thread-1",
    internalDate: "1775034723000",
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: '"Weber, Klaus" <K.Weber@Heimtextil-Weber.de>' },
        { name: "To", value: "sales@cotonex.com" },
        { name: "Subject", value: "=?UTF-8?Q?Anfrage_Bettw=C3=A4sche?=" },
        { name: "Date", value: "Mon, 6 Apr 2026 11:12:03 +0200" },
        { name: "Message-ID", value: "<a1@weber.de>" },
      ],
      body: { data: b64("Bitte senden Sie ein Angebot.\n\n> alte Nachricht") },
    },
  };

  it("maps addresses, lower-casing the email and keeping the name", () => {
    const parsed = toParsedMessage(message)!;
    expect(parsed.from).toEqual({ name: "Weber, Klaus", email: "k.weber@heimtextil-weber.de" });
  });

  it("decodes the encoded subject", () => {
    expect(toParsedMessage(message)!.subject).toBe("Anfrage Bettwäsche");
  });

  it("prefers internalDate over the sender's Date header", () => {
    const parsed = toParsedMessage(message)!;
    expect(parsed.date).toBe(new Date(1775034723000).toISOString());
  });

  it("falls back to the Date header when internalDate is absent", () => {
    const parsed = toParsedMessage({ ...message, internalDate: undefined })!;
    expect(parsed.date).toBe(new Date("Mon, 6 Apr 2026 11:12:03 +0200").toISOString());
  });

  it("strips quoted history", () => {
    expect(toParsedMessage(message)!.body).not.toContain("alte Nachricht");
  });

  it("returns null when there is no From header", () => {
    expect(toParsedMessage({ id: "x", threadId: "t", payload: { headers: [] } })).toBeNull();
  });

  it("falls back to the snippet when no body part decodes", () => {
    const parsed = toParsedMessage({
      id: "x",
      threadId: "t",
      snippet: "Short preview text",
      payload: { headers: [{ name: "From", value: "a@b.com" }] },
    })!;
    expect(parsed.body).toBe("Short preview text");
  });
});

describe("toParsedThread", () => {
  it("orders messages oldest first and trusts Gmail's threadId", () => {
    const thread = toParsedThread({
      id: "t9",
      messages: [
        {
          id: "b",
          threadId: "t9",
          internalDate: "2000",
          payload: { headers: [{ name: "From", value: "b@x.com" }], body: { data: b64("second") } },
        },
        {
          id: "a",
          threadId: "t9",
          internalDate: "1000",
          payload: { headers: [{ name: "From", value: "a@x.com" }], body: { data: b64("first") } },
        },
      ],
    })!;

    expect(thread.id).toBe("t9");
    expect(thread.messages.map((message) => message.body)).toEqual(["first", "second"]);
    expect(thread.messages.every((message) => message.threadId === "t9")).toBe(true);
  });

  it("returns null for a thread with no usable messages", () => {
    expect(toParsedThread({ id: "empty", messages: [] })).toBeNull();
  });
});

describe("shouldSkip", () => {
  it("skips spam, trash, drafts and promotions", () => {
    for (const label of ["SPAM", "TRASH", "DRAFT", "CATEGORY_PROMOTIONS"]) {
      expect(shouldSkip({ id: "x", threadId: "t", labelIds: [label] }), label).toBe(true);
    }
  });

  it("keeps ordinary inbox mail", () => {
    expect(shouldSkip({ id: "x", threadId: "t", labelIds: ["INBOX", "IMPORTANT"] })).toBe(false);
  });
});

describe("backfillQuery", () => {
  it("narrows server-side so quota is not spent on noise", () => {
    const query = backfillQuery(3);
    expect(query).toContain("newer_than:3y");
    expect(query).toContain("-in:chats");
    expect(query).toContain("-category:promotions");
  });
});

describe("the two routes agree", () => {
  it("classifies a Gmail-sourced thread exactly as the mbox route would", () => {
    const thread = toParsedThread({
      id: "t-buyer",
      messages: [
        {
          id: "m1",
          threadId: "t-buyer",
          internalDate: "1775000000000",
          payload: {
            mimeType: "text/plain",
            headers: [
              { name: "From", value: "sales@cotonex.com" },
              { name: "To", value: "k.weber@heimtextil-weber.de" },
              { name: "Subject", value: "Cotonex" },
            ],
            body: { data: b64("We manufacture bed linen and towels.") },
          },
        },
        {
          id: "m2",
          threadId: "t-buyer",
          internalDate: "1775400000000",
          payload: {
            mimeType: "text/plain",
            headers: [
              { name: "From", value: "Klaus Weber <k.weber@heimtextil-weber.de>" },
              { name: "To", value: "sales@cotonex.com" },
              { name: "Subject", value: "Re: Cotonex" },
            ],
            body: {
              data: b64(
                "Please send a quotation. What is your MOQ?\n\n" +
                  "Best regards,\nKlaus Weber\nHead of Purchasing\nTel: +49 202 555 118\n",
              ),
            },
          },
        },
      ],
    })!;

    const result = classifyThread(thread, context, NOW);
    expect(result.verdict).toBe("buyer");
    expect(result.extracted.designation).toMatch(/head of purchasing/i);
    expect(result.extracted.phone).toBe("+49 202 555 118");
    expect(result.status).toBe("enquiry_received");
  });

  it("excludes a Gmail-sourced newsletter on its headers", () => {
    const thread = toParsedThread({
      id: "t-news",
      messages: [
        {
          id: "n1",
          threadId: "t-news",
          internalDate: "1775000000000",
          payload: {
            mimeType: "text/plain",
            headers: [
              { name: "From", value: "news@textileweekly.com" },
              { name: "To", value: "sales@cotonex.com" },
              { name: "Subject", value: "This week in home textiles" },
              { name: "List-Unsubscribe", value: "<https://x/u>" },
            ],
            body: { data: b64("Bed linen, towels and cotton news.") },
          },
        },
      ],
    })!;

    expect(classifyThread(thread, context, NOW).excluded).toBe("bulk_mail");
  });
});
