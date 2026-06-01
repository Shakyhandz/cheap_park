import { wallClockParts } from "./wallclock.js";

export type DayClass = "vardag" | "preHelgdag" | "helgdag";
export type Calendar = "SE";

type Ymd = { year: number; month: number; day: number };

// Anonymous Gregorian computus → Easter Sunday for `year`.
function easterSunday(year: number): Ymd {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March,4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { year, month, day };
}

// Days since epoch for date arithmetic (UTC noon avoids DST edges).
function dayNumber(d: Ymd): number {
  return Math.floor(Date.UTC(d.year, d.month - 1, d.day, 12) / 86_400_000);
}
function fromDayNumber(n: number): Ymd {
  const dt = new Date(n * 86_400_000);
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}
function addDays(d: Ymd, n: number): Ymd {
  return fromDayNumber(dayNumber(d) + n);
}
// 0=Sun..6=Sat for a calendar date.
function weekdayOf(d: Ymd): number {
  return new Date(Date.UTC(d.year, d.month - 1, d.day, 12)).getUTCDay();
}

// Find the Saturday within a single-month inclusive day range [fromDay, toDay].
function saturdayInRange(year: number, month: number, fromDay: number, toDay: number): Ymd {
  const start: Ymd = { year, month, day: fromDay };
  const end: Ymd = { year, month, day: toDay };
  for (let n = dayNumber(start); n <= dayNumber(end); n++) {
    const d = fromDayNumber(n);
    if (weekdayOf(d) === 6) return d;
  }
  return start; // unreachable for valid ranges
}

function swedishHolidays(year: number): Ymd[] {
  const easter = easterSunday(year);
  const fixed: Ymd[] = [
    { year, month: 1, day: 1 },   // nyårsdagen
    { year, month: 1, day: 6 },   // trettondedag jul
    { year, month: 5, day: 1 },   // första maj
    { year, month: 6, day: 6 },   // nationaldagen
    { year, month: 12, day: 25 }, // juldagen
    { year, month: 12, day: 26 }, // annandag jul
  ];
  const easterBased: Ymd[] = [
    addDays(easter, -2), // långfredag
    easter,              // påskdagen
    addDays(easter, 1),  // annandag påsk
    addDays(easter, 39), // Kristi himmelsfärd
    addDays(easter, 49), // pingstdagen
  ];
  // Midsommardagen: Saturday 20–26 June.
  const midsummer = saturdayInRange(year, 6, 20, 26);
  // Alla helgons dag: Saturday 31 Oct – 6 Nov (cross-month scan).
  const allSaints = (() => {
    const start = { year, month: 10, day: 31 };
    const end = { year, month: 11, day: 6 };
    for (let n = dayNumber(start); n <= dayNumber(end); n++) {
      const d = fromDayNumber(n);
      if (weekdayOf(d) === 6) return d;
    }
    return start;
  })();
  return [...fixed, ...easterBased, midsummer, allSaints];
}

const cache = new Map<string, Set<number>>();
function holidaySet(year: number, calendar: Calendar): Set<number> {
  const key = `${calendar}:${year}`;
  let s = cache.get(key);
  if (!s) {
    s = new Set(swedishHolidays(year).map(dayNumber));
    cache.set(key, s);
  }
  return s;
}

export function isHoliday(d: Ymd, calendar: Calendar): boolean {
  return holidaySet(d.year, calendar).has(dayNumber(d));
}

export function dayClassOf(
  instant: Date,
  ctx: { timeZone: string; calendar: Calendar },
): DayClass {
  const wc = wallClockParts(instant, ctx.timeZone);
  const today: Ymd = { year: wc.year, month: wc.month, day: wc.day };
  // 1. Sunday or red day → helgdag.
  if (wc.weekday === 0 || isHoliday(today, ctx.calendar)) return "helgdag";
  // 2. Next calendar day is helgdag → preHelgdag.
  const tomorrow = addDays(today, 1);
  const tomorrowIsHelg = weekdayOf(tomorrow) === 0 || isHoliday(tomorrow, ctx.calendar);
  if (tomorrowIsHelg) return "preHelgdag";
  // 3. otherwise vardag.
  return "vardag";
}
