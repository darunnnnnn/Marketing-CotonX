/**
 * Country profiles for requirement §15 — send inside the buyer's working hours,
 * in their local time, not ours. IANA zones so daylight saving is handled by
 * Intl rather than by us.
 */

export type CountryProfile = {
  code: string;
  name: string;
  timeZone: string;
  language: string;
  /** Local hours a campaign may land in. */
  sendWindow: [number, number];
  /** 0 = Sunday. Days on which business mail is read. */
  workDays: number[];
};

const WEEK = [1, 2, 3, 4, 5];

export const COUNTRIES: CountryProfile[] = [
  { code: "DE", name: "Germany", timeZone: "Europe/Berlin", language: "de", sendWindow: [8, 11], workDays: WEEK },
  { code: "NL", name: "Netherlands", timeZone: "Europe/Amsterdam", language: "nl", sendWindow: [8, 11], workDays: WEEK },
  { code: "FR", name: "France", timeZone: "Europe/Paris", language: "fr", sendWindow: [9, 12], workDays: WEEK },
  { code: "IT", name: "Italy", timeZone: "Europe/Rome", language: "it", sendWindow: [9, 12], workDays: WEEK },
  { code: "ES", name: "Spain", timeZone: "Europe/Madrid", language: "es", sendWindow: [9, 12], workDays: WEEK },
  { code: "BE", name: "Belgium", timeZone: "Europe/Brussels", language: "nl", sendWindow: [8, 11], workDays: WEEK },
  { code: "AT", name: "Austria", timeZone: "Europe/Vienna", language: "de", sendWindow: [8, 11], workDays: WEEK },
  { code: "CH", name: "Switzerland", timeZone: "Europe/Zurich", language: "de", sendWindow: [8, 11], workDays: WEEK },
  { code: "DK", name: "Denmark", timeZone: "Europe/Copenhagen", language: "en", sendWindow: [8, 11], workDays: WEEK },
  { code: "SE", name: "Sweden", timeZone: "Europe/Stockholm", language: "en", sendWindow: [8, 11], workDays: WEEK },
  { code: "PL", name: "Poland", timeZone: "Europe/Warsaw", language: "pl", sendWindow: [8, 11], workDays: WEEK },
  { code: "GB", name: "United Kingdom", timeZone: "Europe/London", language: "en", sendWindow: [8, 11], workDays: WEEK },
  { code: "PT", name: "Portugal", timeZone: "Europe/Lisbon", language: "pt", sendWindow: [9, 12], workDays: WEEK },
  { code: "RU", name: "Russia", timeZone: "Europe/Moscow", language: "ru", sendWindow: [9, 12], workDays: WEEK },
  { code: "TR", name: "Turkey", timeZone: "Europe/Istanbul", language: "tr", sendWindow: [9, 12], workDays: WEEK },
  { code: "US", name: "United States", timeZone: "America/New_York", language: "en", sendWindow: [9, 11], workDays: WEEK },
  { code: "CA", name: "Canada", timeZone: "America/Toronto", language: "en", sendWindow: [9, 11], workDays: WEEK },
  { code: "MX", name: "Mexico", timeZone: "America/Mexico_City", language: "es", sendWindow: [9, 12], workDays: WEEK },
  { code: "BR", name: "Brazil", timeZone: "America/Sao_Paulo", language: "pt", sendWindow: [9, 12], workDays: WEEK },
  { code: "AE", name: "United Arab Emirates", timeZone: "Asia/Dubai", language: "en", sendWindow: [9, 12], workDays: [0, 1, 2, 3, 4] },
  { code: "AU", name: "Australia", timeZone: "Australia/Sydney", language: "en", sendWindow: [9, 11], workDays: WEEK },
  { code: "JP", name: "Japan", timeZone: "Asia/Tokyo", language: "ja", sendWindow: [9, 11], workDays: WEEK },
  { code: "IN", name: "India", timeZone: "Asia/Kolkata", language: "en", sendWindow: [10, 12], workDays: WEEK },
];

export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));

export const countryName = (code: string) => COUNTRY_BY_CODE.get(code)?.name ?? code;

/* Both of these run once per table row, so the formatters are cached too. */
const clockFormatters = new Map<string, Intl.DateTimeFormat>();
const stampFormatters = new Map<string, Intl.DateTimeFormat>();

function cached(
  store: Map<string, Intl.DateTimeFormat>,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  let formatter = store.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", { ...options, timeZone });
    store.set(timeZone, formatter);
  }
  return formatter;
}

/** Current local time in a country, as HH:MM. */
export function localTime(code: string, now = new Date()): string {
  const profile = COUNTRY_BY_CODE.get(code);
  if (!profile) return "—";
  return cached(clockFormatters, profile.timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

/* Constructing an Intl formatter is expensive and nextSendSlot can step
   through hundreds of hours, so keep one per zone. */
const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      weekday: "short",
      hour12: false,
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/** The country's wall-clock hour and weekday right now. */
function localParts(profile: CountryProfile, at: Date) {
  const parts = partsFormatter(profile.timeZone).formatToParts(at);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const weekdayName = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName);
  return { hour, weekday };
}

export function isInSendWindow(code: string, at = new Date()): boolean {
  const profile = COUNTRY_BY_CODE.get(code);
  if (!profile) return false;
  const { hour, weekday } = localParts(profile, at);
  const [open, close] = profile.sendWindow;
  return profile.workDays.includes(weekday) && hour >= open && hour < close;
}

/**
 * The next moment a send to this country is allowed. Walks forward in hour
 * steps, which is cheap at this scale and immune to daylight-saving maths.
 */
export function nextSendSlot(code: string, from = new Date()): Date {
  const profile = COUNTRY_BY_CODE.get(code);
  if (!profile) return from;
  if (isInSendWindow(code, from)) return from;

  const cursor = new Date(from);
  cursor.setMinutes(0, 0, 0);
  for (let step = 0; step < 24 * 14; step += 1) {
    cursor.setHours(cursor.getHours() + 1);
    if (isInSendWindow(code, cursor)) return new Date(cursor);
  }
  return cursor;
}

export function formatInZone(code: string, at: Date): string {
  const profile = COUNTRY_BY_CODE.get(code);
  /* An unknown country falls back to the viewer's own zone. */
  return cached(stampFormatters, profile?.timeZone ?? "local", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(profile ? {} : { timeZone: undefined }),
  }).format(at);
}
