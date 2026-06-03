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

// Constructing an Intl.DateTimeFormat is expensive; these helpers run once per
// feature on hot paths (price-now / total-cost over ~18k features), so cache
// one formatter per timezone.
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = fmtCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
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
    fmtCache.set(timeZone, f);
  }
  return f;
}

type IntParts = {
  year: number; month: number; day: number;
  hour: number; minute: number; second: number; weekday: number;
};

function integerParts(instant: Date, timeZone: string): IntParts {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // some engines emit 24 for midnight
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour,
    minute: parseInt(get("minute"), 10),
    second: parseInt(get("second"), 10),
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
  };
}

/**
 * Render an absolute instant into the wall-clock parts of a named IANA
 * timezone. Independent of the host machine's timezone — only the instant
 * (epoch) is taken from the Date; the zone decides the rendered parts.
 */
export function wallClockParts(instant: Date, timeZone: string): WallClock {
  const p = integerParts(instant, timeZone);
  return {
    year: p.year,
    month: p.month,
    day: p.day,
    hour: p.hour + p.minute / 60 + p.second / 3600,
    weekday: p.weekday,
  };
}

/**
 * Offset (ms) of `timeZone` at `instant`: how far the local wall clock leads
 * UTC. E.g. +7_200_000 for Europe/Stockholm in CEST (+2h).
 */
export function offsetMsAt(instant: Date, timeZone: string): number {
  const p = integerParts(instant, timeZone);
  const localAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return localAsUtc - instant.getTime();
}

/**
 * The UTC instant at which `timeZone`'s wall clock reads the given local
 * date + decimal hour. DST-correct: a local day is not always 24 real hours,
 * so boundary instants (e.g. "07:00 local") must be resolved through the
 * zone's offset, not by adding hours to local midnight. `decimalHour` may be
 * 24 (or hourEnd=24) to mean the next local midnight; Date.UTC overflow rolls
 * the date forward. Whole-hour boundaries never land on the transition hour
 * itself, so the result is unambiguous for parking tariffs.
 */
export function instantForZonedTime(
  timeZone: string,
  year: number,
  month: number, // 1..12
  day: number,
  decimalHour: number,
): Date {
  const hour = Math.floor(decimalHour);
  const minute = Math.round((decimalHour - hour) * 60);
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Two-pass: guess the offset at the naive instant, correct, then re-check in
  // case the first guess landed in the wrong offset (near a transition).
  const off1 = offsetMsAt(new Date(naiveUtc), timeZone);
  let ts = naiveUtc - off1;
  const off2 = offsetMsAt(new Date(ts), timeZone);
  if (off2 !== off1) ts = naiveUtc - off2;
  return new Date(ts);
}
