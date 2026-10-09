import { describe, expect, it } from "vitest";
import { COUNTRIES, COUNTRY_BY_CODE, isInSendWindow, localTime, nextSendSlot } from "./countries.ts";

const hourIn = (zone: string, at: Date) =>
  Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: zone }).format(at));

const weekdayIn = (zone: string, at: Date) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: zone }).format(at);

describe("country profiles", () => {
  it("has no duplicate codes", () => {
    const codes = COUNTRIES.map((country) => country.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("declares a valid IANA zone for every country", () => {
    for (const country of COUNTRIES) {
      expect(() => new Intl.DateTimeFormat("en", { timeZone: country.timeZone }), country.code).not.toThrow();
    }
  });

  it("declares a sane send window for every country", () => {
    for (const country of COUNTRIES) {
      const [open, close] = country.sendWindow;
      expect(open, country.code).toBeGreaterThanOrEqual(0);
      expect(close, country.code).toBeGreaterThan(open);
      expect(close, country.code).toBeLessThanOrEqual(24);
      expect(country.workDays.length, country.code).toBeGreaterThan(0);
    }
  });
});

describe("isInSendWindow", () => {
  it("is closed in the middle of the night", () => {
    /* 02:00 UTC Tuesday = 03:00 in Berlin. */
    expect(isInSendWindow("DE", new Date("2026-03-10T02:00:00.000Z"))).toBe(false);
  });

  it("is open mid-morning on a working day", () => {
    /* 08:00 UTC Tuesday = 09:00 in Berlin, inside the 08-11 window. */
    expect(isInSendWindow("DE", new Date("2026-03-10T08:00:00.000Z"))).toBe(true);
  });

  it("is closed at the weekend even during business hours", () => {
    /* Saturday 09:00 Berlin. */
    expect(isInSendWindow("DE", new Date("2026-03-14T08:00:00.000Z"))).toBe(false);
  });

  it("follows the local week, not ours", () => {
    /* Sunday is a working day in the UAE and not in Germany. */
    const sundayMorning = new Date("2026-03-15T06:00:00.000Z");
    expect(isInSendWindow("AE", sundayMorning)).toBe(true);
    expect(isInSendWindow("DE", sundayMorning)).toBe(false);
  });

  it("returns false for an unknown country rather than throwing", () => {
    expect(isInSendWindow("ZZ")).toBe(false);
  });
});

describe("nextSendSlot", () => {
  it("returns the current moment when the window is already open", () => {
    const now = new Date("2026-03-10T08:30:00.000Z");
    expect(nextSendSlot("DE", now).getTime()).toBe(now.getTime());
  });

  it("always lands inside the window it targets", () => {
    for (const country of COUNTRIES) {
      /* Probe several times of day across a whole week. */
      for (let offset = 0; offset < 7 * 24; offset += 5) {
        const from = new Date(Date.UTC(2026, 2, 9, offset, 0, 0));
        const slot = nextSendSlot(country.code, from);
        expect(isInSendWindow(country.code, slot), `${country.code} from ${from.toISOString()}`).toBe(true);
      }
    }
  });

  it("never returns a moment in the past", () => {
    for (const country of COUNTRIES) {
      for (let offset = 0; offset < 48; offset += 3) {
        const from = new Date(Date.UTC(2026, 2, 14, offset, 37, 0));
        expect(nextSendSlot(country.code, from).getTime(), country.code).toBeGreaterThanOrEqual(from.getTime());
      }
    }
  });

  it("lands on a working day in the local week", () => {
    for (const country of COUNTRIES) {
      const slot = nextSendSlot(country.code, new Date("2026-03-14T20:00:00.000Z"));
      const weekday = weekdayIn(country.timeZone, slot);
      const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
      expect(country.workDays, `${country.code} landed on ${weekday}`).toContain(index);
    }
  });

  it("lands inside the declared hours in local time", () => {
    for (const country of COUNTRIES) {
      const slot = nextSendSlot(country.code, new Date("2026-03-10T00:00:00.000Z"));
      const hour = hourIn(country.timeZone, slot);
      expect(hour, country.code).toBeGreaterThanOrEqual(country.sendWindow[0]);
      expect(hour, country.code).toBeLessThan(country.sendWindow[1]);
    }
  });

  /* Europe moves to summer time on 29 March 2026. */
  it("stays correct across a daylight-saving transition", () => {
    const beforeChange = new Date("2026-03-27T20:00:00.000Z");
    const slot = nextSendSlot("DE", beforeChange);
    expect(isInSendWindow("DE", slot)).toBe(true);
    expect(hourIn("Europe/Berlin", slot)).toBeGreaterThanOrEqual(8);
  });

  it("returns the input unchanged for an unknown country", () => {
    const now = new Date("2026-03-10T02:00:00.000Z");
    expect(nextSendSlot("ZZ", now).getTime()).toBe(now.getTime());
  });
});

describe("localTime", () => {
  it("formats the recipient's wall clock, not ours", () => {
    const at = new Date("2026-03-10T12:00:00.000Z");
    expect(localTime("DE", at)).toBe("13:00");
    expect(localTime("IN", at)).toBe("17:30");
  });

  it("degrades gracefully for an unknown country", () => {
    expect(localTime("ZZ")).toBe("—");
  });
});

describe("COUNTRY_BY_CODE", () => {
  it("indexes every country", () => {
    expect(COUNTRY_BY_CODE.size).toBe(COUNTRIES.length);
  });
});
