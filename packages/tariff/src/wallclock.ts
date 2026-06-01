export type WallClock = {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  hour: number; // decimal hours, e.g. 13.5
  weekday: number; // 0=Sun..6=Sat
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/**
 * Render an absolute instant into the wall-clock parts of a named IANA
 * timezone. Independent of the host machine's timezone — only the instant
 * (epoch) is taken from the Date; the zone decides the rendered parts.
 */
export function wallClockParts(instant: Date, timeZone: string): WallClock {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // some engines emit 24 for midnight
  const minute = parseInt(get("minute"), 10);
  const second = parseInt(get("second"), 10);
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour: hour + minute / 60 + second / 3600,
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
  };
}
