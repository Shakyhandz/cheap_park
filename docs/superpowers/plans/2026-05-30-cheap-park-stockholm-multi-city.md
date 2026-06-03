# Stockholm Multi-City Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Stockholm street parking (Trafikkontoret LTF-Tolken API) as a fully-shipped second city alongside Gothenburg, on one shared map, driven by a single unified `parkings.geojson`.

**Architecture:** Keep the static-data-on-GitHub-Pages approach (Alternativ A). The poller becomes a multi-city orchestrator producing one GeoJSON FeatureCollection (points for Gothenburg, lines for Stockholm) plus a shared `tariffs.json`. The tariff engine gains a locale context (per-city timezone + per-country holiday calendar) and a day-class concept. The web app loads one file into a flat client model and renders two data-driven MapLibre layers colored by locally-computed price tier.

**Tech Stack:** TypeScript, Node ≥20, vitest, React 18, MapLibre GL JS (`react-map-gl/maplibre`), Vite. npm workspaces: `@cheap-park/tariff`, `@cheap-park/poller`, `@cheap-park/web`.

**Spec:** `docs/superpowers/specs/2026-05-30-cheap-park-stockholm-multi-city-design.md`

**Branch:** `stockholm-multi-city` (already checked out).

**Test command pattern:** `npm test --workspace @cheap-park/<pkg>` runs vitest once. Single file: `npx vitest run <path> --root packages/<pkg>` (or from the workspace dir). All three packages use vitest 2.x.

---

## File Structure

**`packages/tariff` (engine — changed + new):**
- `src/types.ts` — MODIFY: add `DayClass`, `TariffRule.dayClasses?`, GeoJSON/city types.
- `src/holidays.ts` — CREATE: Swedish red-day calc + `dayClassOf`.
- `src/wallclock.ts` — CREATE: `Intl`-based timezone wall-clock parts.
- `src/days.ts` — MODIFY: `ruleAppliesAt` takes instant + `EvalContext`.
- `src/price-now.ts` — MODIFY: `priceNow(tariff, instant, ctx)`.
- `src/total-cost.ts` — MODIFY: `totalCost(tariff, instant, durMin, ctx)` + analytic boundary stepping.
- `src/index.ts` — MODIFY: re-export new symbols.

**`packages/poller` (pipeline — changed + new):**
- `src/fetch-stockholm.ts` — CREATE: fetch `ptillaten/all`.
- `src/tariff-templates-stockholm.ts` — CREATE: `PARKING_RATE` → `Tariff`.
- `src/normalize-stockholm.ts` — CREATE: GeoJSON features (cars only).
- `src/normalize.ts` — MODIFY: emit unified `ParkingFeature` (provider/rulesText/accessible).
- `src/geometry.ts` — CREATE: `midpointOf(geometry)` + coord rounding.
- `src/sanity.ts` — MODIFY: per-city threshold.
- `src/main.ts` — MODIFY: orchestrate both cities, write `parkings.geojson`.

**`apps/web` (client — changed):**
- `src/lib/client-model.ts` — CREATE: `ClientParking` + `flattenSnapshot`.
- `src/lib/data.ts` — MODIFY: load `parkings.geojson`.
- `src/lib/prices.ts` — MODIFY: thread `ctx`.
- `src/lib/filter.ts` — MODIFY: operate on `ClientParking`.
- `src/lib/colors.ts` — unchanged (tier math reused).
- `src/lib/map-source.ts` — CREATE: build runtime GeoJSON with `tier`/`dimmed` props.
- `src/components/MapView.tsx` — MODIFY: data-driven layers + nearest-city centering.
- `src/components/DetailSheet.tsx`, `ListView.tsx`, `App.tsx` — MODIFY: `ClientParking`.

**Deploy:**
- `.github/workflows/poll-data.yml` — MODIFY: add `STHLM_TK_APIKEY` env.

---

## Phase 1 — Tariff engine: locale + day-class

### Task 1: Wall-clock parts from a timezone

**Files:**
- Create: `packages/tariff/src/wallclock.ts`
- Test: `packages/tariff/tests/wallclock.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/tariff/tests/wallclock.test.ts
import { describe, expect, it } from "vitest";
import { wallClockParts } from "../src/wallclock.js";

describe("wallClockParts", () => {
  // 2026-05-30T11:31:00Z = 13:31 in Stockholm (CEST, +2), 14:31 in Helsinki (EEST, +3)
  const instant = new Date("2026-05-30T11:31:00Z");

  it("renders the instant in Stockholm time", () => {
    const p = wallClockParts(instant, "Europe/Stockholm");
    expect(p.year).toBe(2026);
    expect(p.month).toBe(5);
    expect(p.day).toBe(30);
    expect(p.hour).toBe(13.516666666666667); // 13 + 31/60
    expect(p.weekday).toBe(6); // Saturday
  });

  it("renders the same instant in Helsinki time", () => {
    const p = wallClockParts(instant, "Europe/Helsinki");
    expect(p.hour).toBeCloseTo(14.516666, 4);
    expect(p.weekday).toBe(6);
  });

  it("is independent of the host timezone (uses the named zone)", () => {
    // Midnight UTC on a Monday is still Monday 02:00 in Stockholm summer.
    const p = wallClockParts(new Date("2026-06-01T00:00:00Z"), "Europe/Stockholm");
    expect(p.weekday).toBe(1); // Monday
    expect(p.hour).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wallclock.test.ts --root packages/tariff`
Expected: FAIL — `wallClockParts` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/tariff/src/wallclock.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/wallclock.test.ts --root packages/tariff`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/tariff/src/wallclock.ts packages/tariff/tests/wallclock.test.ts
git commit -m "feat(tariff): wall-clock parts from a named timezone"
```

---

### Task 2: Swedish holiday calendar + day class

**Files:**
- Create: `packages/tariff/src/holidays.ts`
- Test: `packages/tariff/tests/holidays.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/tariff/tests/holidays.test.ts
import { describe, expect, it } from "vitest";
import { isHoliday, dayClassOf } from "../src/holidays.js";

const SE = { timeZone: "Europe/Stockholm", calendar: "SE" as const };

describe("isHoliday (SE)", () => {
  it("fixed holidays", () => {
    expect(isHoliday({ year: 2026, month: 1, day: 1 }, "SE")).toBe(true);   // nyårsdagen
    expect(isHoliday({ year: 2026, month: 6, day: 6 }, "SE")).toBe(true);   // nationaldagen
    expect(isHoliday({ year: 2026, month: 12, day: 25 }, "SE")).toBe(true); // juldagen
  });

  it("easter-derived holidays for 2026 (Easter Sunday = April 5)", () => {
    expect(isHoliday({ year: 2026, month: 4, day: 3 }, "SE")).toBe(true);  // långfredag
    expect(isHoliday({ year: 2026, month: 4, day: 5 }, "SE")).toBe(true);  // påskdagen
    expect(isHoliday({ year: 2026, month: 4, day: 6 }, "SE")).toBe(true);  // annandag påsk
    expect(isHoliday({ year: 2026, month: 5, day: 14 }, "SE")).toBe(true); // Kristi himmelsfärd (+39)
    expect(isHoliday({ year: 2026, month: 5, day: 24 }, "SE")).toBe(true); // pingstdagen (+49)
  });

  it("moving-Saturday holidays for 2026", () => {
    expect(isHoliday({ year: 2026, month: 6, day: 20 }, "SE")).toBe(true);  // midsommardagen (Sat 20 Jun)
    expect(isHoliday({ year: 2026, month: 10, day: 31 }, "SE")).toBe(true); // alla helgons dag (Sat 31 Oct)
  });

  it("a plain weekday is not a holiday", () => {
    expect(isHoliday({ year: 2026, month: 5, day: 27 }, "SE")).toBe(false); // Wednesday
  });
});

describe("dayClassOf (SE) — strict priority", () => {
  it("Sunday is helgdag", () => {
    // 2026-05-31 is a Sunday
    expect(dayClassOf(new Date("2026-05-31T10:00:00Z"), SE)).toBe("helgdag");
  });
  it("a red day on a weekday is helgdag", () => {
    expect(dayClassOf(new Date("2026-06-06T10:00:00Z"), SE)).toBe("helgdag"); // nationaldagen (Sat) — red wins
  });
  it("Saturday before an ordinary Sunday is preHelgdag", () => {
    expect(dayClassOf(new Date("2026-05-30T10:00:00Z"), SE)).toBe("preHelgdag"); // Sat 30 May
  });
  it("Dec 31 before New Year's Day is preHelgdag", () => {
    expect(dayClassOf(new Date("2026-12-31T10:00:00Z"), SE)).toBe("preHelgdag");
  });
  it("an ordinary weekday is vardag", () => {
    expect(dayClassOf(new Date("2026-05-27T10:00:00Z"), SE)).toBe("vardag"); // Wednesday
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/holidays.test.ts --root packages/tariff`
Expected: FAIL — `isHoliday`/`dayClassOf` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/tariff/src/holidays.ts
import { wallClockParts } from "./wallclock.js";
import type { EvalContext } from "./days.js";

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

// Days since an epoch for date arithmetic (UTC noon avoids DST edges).
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
function sameYmd(a: Ymd, b: Ymd): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}
// 0=Sun..6=Sat for a calendar date.
function weekdayOf(d: Ymd): number {
  return new Date(Date.UTC(d.year, d.month - 1, d.day, 12)).getUTCDay();
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
  // Midsommardagen: Saturday in 20–26 June. Alla helgons dag: Saturday 31 Oct–6 Nov.
  const midsummer = saturdayInRange(year, 6, 20, 26);
  const allSaints = saturdayInRange(year, 10, 31, year, 11, 6);
  return [...fixed, ...easterBased, midsummer, allSaints];
}

function saturdayInRange(
  year: number, month: number, fromDay: number, toDay: number,
  toMonth?: number, _y?: number, toDay2?: number,
): Ymd {
  // Simple form: within a single month [fromDay, toDay].
  // Cross-month form (alla helgons dag): scan fromDay/month .. toDay2/toMonth.
  const start: Ymd = { year, month, day: fromDay };
  const endMonth = toMonth ?? month;
  const endDay = toMonth ? toDay2! : toDay;
  const end: Ymd = { year, month: endMonth, day: endDay };
  for (let n = dayNumber(start); n <= dayNumber(end); n++) {
    const d = fromDayNumber(n);
    if (weekdayOf(d) === 6) return d;
  }
  return start; // unreachable for valid ranges
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

export function dayClassOf(instant: Date, ctx: EvalContext): DayClass {
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
```

Note for the implementer: `saturdayInRange` is called two ways. For midsummer use `saturdayInRange(year, 6, 20, 26)`. For alla helgons dag use `saturdayInRange(year, 10, 31, 6, 11, year, 6)` — **but** to avoid the awkward overload, the cleaner call shown in `swedishHolidays` is `saturdayInRange(year, 10, 31, 31, 11, year, 6)`. Replace the cross-month call with this explicit scan instead:

```ts
  const allSaints = (() => {
    const start = { year, month: 10, day: 31 };
    const end = { year, month: 11, day: 6 };
    for (let n = dayNumber(start); n <= dayNumber(end); n++) {
      const d = fromDayNumber(n);
      if (weekdayOf(d) === 6) return d;
    }
    return start;
  })();
```

And simplify `saturdayInRange` to the single-month signature `(year, month, fromDay, toDay)`. Keep the function focused; inline the cross-month case as above.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/holidays.test.ts --root packages/tariff`
Expected: PASS (all groups).

- [ ] **Step 5: Commit**

```bash
git add packages/tariff/src/holidays.ts packages/tariff/tests/holidays.test.ts
git commit -m "feat(tariff): Swedish holiday calendar + dayClassOf"
```

---

### Task 3: Add `DayClass`/`dayClasses` and `EvalContext` to types + days

**Files:**
- Modify: `packages/tariff/src/types.ts`, `packages/tariff/src/days.ts`
- Test: `packages/tariff/tests/days.test.ts` (extend)

- [ ] **Step 1: Write the failing test (append to days.test.ts)**

```ts
// append to packages/tariff/tests/days.test.ts
import { dayClassOf } from "../src/holidays.js";
import type { EvalContext } from "../src/days.js";

const SE: EvalContext = { timeZone: "Europe/Stockholm", calendar: "SE" };

describe("ruleAppliesAt with dayClasses + ctx", () => {
  const preHelgRule = {
    daysOfWeek: [],
    dayClasses: ["preHelgdag" as const],
    hourStart: 11,
    hourEnd: 17,
    pricePerHour: 15,
  };

  it("matches on a preHelgdag inside the window", () => {
    // 2026-05-30 is Saturday (preHelgdag), 13:00 Stockholm = 11:00Z
    expect(ruleAppliesAt(preHelgRule, new Date("2026-05-30T11:00:00Z"), SE)).toBe(true);
  });

  it("does not match on a plain weekday", () => {
    // 2026-05-27 Wednesday (vardag), 13:00 Stockholm
    expect(ruleAppliesAt(preHelgRule, new Date("2026-05-27T11:00:00Z"), SE)).toBe(false);
  });

  it("a rule without dayClasses ignores day class (back-compat)", () => {
    const anyDay = { daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 5 };
    expect(ruleAppliesAt(anyDay, new Date("2026-05-27T11:00:00Z"), SE)).toBe(true);
  });
});
```

Also update the **existing** `ruleAppliesAt` tests in this file to pass `SE` as the third arg (they currently call `ruleAppliesAt(rule, date)`), since the signature changes. Use `new Date("...Z")` UTC literals so they are timezone-stable, or keep the local-time literals — the rule there uses `daysOfWeek: [1..5]` weekday matching which `wallClockParts` resolves in Stockholm time.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/days.test.ts --root packages/tariff`
Expected: FAIL — `EvalContext` not exported / `ruleAppliesAt` arity.

- [ ] **Step 3: Implement — types.ts**

In `packages/tariff/src/types.ts`, change `TariffRule`:

```ts
import type { DayClass } from "./holidays.js";

export type { DayClass } from "./holidays.js";

export type TariffRule = {
  daysOfWeek: number[];      // 0=Sun..6=Sat. Empty = all days.
  dayClasses?: DayClass[];   // Empty/absent = no day-class restriction.
  hourStart: number;
  hourEnd: number;
  pricePerHour: number;
  maxPerDay?: number | null;
};
```

(Leave `Tariff`, and the *old* flat `Parking`/`ParkingsSnapshot` types in place for now — they are removed in Task 9 once the GeoJSON types exist.)

- [ ] **Step 3b: Implement — days.ts**

Rewrite `packages/tariff/src/days.ts`:

```ts
import type { TariffRule } from "./types.js";
import type { Calendar, DayClass } from "./holidays.js";
import { dayClassOf } from "./holidays.js";
import { wallClockParts } from "./wallclock.js";

export type EvalContext = { timeZone: string; calendar: Calendar };

export function dayOfWeekFor(instant: Date, ctx: EvalContext): number {
  return wallClockParts(instant, ctx.timeZone).weekday;
}

export function hourOf(instant: Date, ctx: EvalContext): number {
  return wallClockParts(instant, ctx.timeZone).hour;
}

export function ruleAppliesAt(rule: TariffRule, at: Date, ctx: EvalContext): boolean {
  const wc = wallClockParts(at, ctx.timeZone);
  const dayMatches = rule.daysOfWeek.length === 0 || rule.daysOfWeek.includes(wc.weekday);
  const classMatches =
    !rule.dayClasses ||
    rule.dayClasses.length === 0 ||
    rule.dayClasses.includes(dayClassOf(at, ctx) as DayClass);
  const hourMatches = wc.hour >= rule.hourStart && wc.hour < rule.hourEnd;
  return dayMatches && classMatches && hourMatches;
}
```

This creates a small import cycle (`days.ts` ↔ `holidays.ts` via the `EvalContext` type import). Because `holidays.ts` imports `EvalContext` only as a **type**, it is erased at compile time — no runtime cycle. Verify the build in Step 4.

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/days.test.ts --root packages/tariff`
Then: `npm run build --workspace @cheap-park/tariff`
Expected: PASS, and `tsc` succeeds (confirms no real cycle).

- [ ] **Step 5: Commit**

```bash
git add packages/tariff/src/types.ts packages/tariff/src/days.ts packages/tariff/tests/days.test.ts
git commit -m "feat(tariff): day-class + EvalContext in ruleAppliesAt"
```

---

### Task 4: Thread `ctx` through `priceNow`

**Files:**
- Modify: `packages/tariff/src/price-now.ts`
- Test: `packages/tariff/tests/price-now.test.ts` (extend + fix arity)

- [ ] **Step 1: Update tests**

In `packages/tariff/tests/price-now.test.ts`, add at top:

```ts
import type { EvalContext } from "../src/days.js";
const SE: EvalContext = { timeZone: "Europe/Stockholm", calendar: "SE" };
```

Change every `priceNow(t, date)` call to `priceNow(t, date, SE)`. The existing date literals are written as local time (`"2026-05-11T14:00:00"`); change them to explicit UTC offsets so they're stable — e.g. `"2026-05-11T12:00:00Z"` is 14:00 Stockholm (CEST). Update the asserted hours accordingly:
- `14:00` Stockholm → `"2026-05-11T12:00:00Z"`, still expect `35`.
- `20:00` Stockholm → `"2026-05-11T18:00:00Z"`, expect `"free"`.
- Weekend `14:00` Sat → `"2026-05-09T12:00:00Z"`, expect `"free"`.

Add one day-class test:

```ts
it("applies a preHelgdag rule via ctx", () => {
  const t: Tariff = {
    id: "taxa3", name: "Taxa 3",
    rules: [
      { daysOfWeek: [], dayClasses: ["vardag"], hourStart: 7, hourEnd: 19, pricePerHour: 20 },
      { daysOfWeek: [], dayClasses: ["preHelgdag"], hourStart: 11, hourEnd: 17, pricePerHour: 15 },
    ],
  };
  // Sat 2026-05-30 13:00 Stockholm (preHelgdag) → 15
  expect(priceNow(t, new Date("2026-05-30T11:00:00Z"), SE)).toBe(15);
  // Wed 2026-05-27 13:00 Stockholm (vardag) → 20
  expect(priceNow(t, new Date("2026-05-27T11:00:00Z"), SE)).toBe(20);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/price-now.test.ts --root packages/tariff`
Expected: FAIL — arity mismatch.

- [ ] **Step 3: Implement**

```ts
// packages/tariff/src/price-now.ts
import { ruleAppliesAt, type EvalContext } from "./days.js";
import type { Tariff } from "./types.js";

export type PriceNow = number | "free" | "n/a";

export function priceNow(tariff: Tariff | null, now: Date, ctx: EvalContext): PriceNow {
  if (!tariff) return "n/a";
  for (const rule of tariff.rules) {
    if (ruleAppliesAt(rule, now, ctx)) {
      return rule.pricePerHour === 0 ? "free" : rule.pricePerHour;
    }
  }
  return "free";
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/price-now.test.ts --root packages/tariff`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tariff/src/price-now.ts packages/tariff/tests/price-now.test.ts
git commit -m "feat(tariff): priceNow takes EvalContext"
```

---

### Task 5: `totalCost` with `ctx` + analytic boundary stepping

**Files:**
- Modify: `packages/tariff/src/total-cost.ts`
- Test: `packages/tariff/tests/total-cost.test.ts` (extend + fix arity)

- [ ] **Step 1: Update + add tests**

Add `SE` ctx import (as in Task 4) and pass it as the new 4th arg to every `totalCost(t, from, dur)` → `totalCost(t, from, dur, SE)`. Convert date literals to `...Z` UTC as in Task 4. Then add a boundary + regression test:

```ts
import type { EvalContext } from "../src/days.js";
const SE: EvalContext = { timeZone: "Europe/Stockholm", calendar: "SE" };

it("splits across a rule boundary (Taxa 1: flat 55/h all day)", () => {
  const taxa1: Tariff = {
    id: "taxa1", name: "Taxa 1",
    rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 55 }],
  };
  // 2h from 13:00 Stockholm = 110 kr
  const r = totalCost(taxa1, new Date("2026-05-27T11:00:00Z"), 120, SE);
  expect(r).not.toBe("n/a");
  if (r !== "n/a") expect(r.total).toBe(110);
});

it("crosses a daytime→evening price change", () => {
  const taxa2: Tariff = {
    id: "taxa2", name: "Taxa 2",
    rules: [
      { daysOfWeek: [], dayClasses: ["vardag"], hourStart: 7, hourEnd: 21, pricePerHour: 31 },
      { daysOfWeek: [], dayClasses: ["vardag"], hourStart: 0, hourEnd: 7, pricePerHour: 20 },
      { daysOfWeek: [], dayClasses: ["vardag"], hourStart: 21, hourEnd: 24, pricePerHour: 20 },
    ],
  };
  // Wed 20:00 Stockholm for 2h → 1h @31 + 1h @20 = 51
  const r = totalCost(taxa2, new Date("2026-05-27T18:00:00Z"), 120, SE);
  if (r !== "n/a") expect(r.total).toBe(51);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/total-cost.test.ts --root packages/tariff`
Expected: FAIL — arity mismatch.

- [ ] **Step 3: Implement (ctx + analytic boundary)**

Replace `packages/tariff/src/total-cost.ts` with a version that threads `ctx` and finds the next boundary by jumping to the next rule edge / day-class change instead of stepping every minute:

```ts
import { ruleAppliesAt, type EvalContext } from "./days.js";
import { wallClockParts } from "./wallclock.js";
import type { Tariff, TariffRule } from "./types.js";

export type Segment = { from: Date; to: Date; rate: number };
export type TotalCostResult = { total: number; breakdown: Segment[] } | "n/a";

const MS_PER_HOUR = 3600 * 1000;

function findRule(tariff: Tariff, at: Date, ctx: EvalContext): TariffRule | null {
  for (const rule of tariff.rules) {
    if (ruleAppliesAt(rule, at, ctx)) return rule;
  }
  return null;
}

/**
 * Candidate boundary instants strictly after `from` and not past `hardEnd`:
 * every rule hourStart/hourEnd that lies later today, plus the next local
 * midnight (covers day-of-week and day-class transitions). We then jump to the
 * earliest candidate whose active rule differs from the current one.
 */
function nextBoundary(tariff: Tariff, from: Date, hardEnd: Date, ctx: EvalContext): Date {
  const wc = wallClockParts(from, ctx.timeZone);
  const startOfLocalDayMs = from.getTime() - (wc.hour * MS_PER_HOUR);
  const candidates: number[] = [];
  for (const rule of tariff.rules) {
    for (const edge of [rule.hourStart, rule.hourEnd]) {
      candidates.push(startOfLocalDayMs + edge * MS_PER_HOUR);
    }
  }
  candidates.push(startOfLocalDayMs + 24 * MS_PER_HOUR); // next local midnight
  const startRule = findRule(tariff, from, ctx);
  const sorted = candidates
    .filter((t) => t > from.getTime() && t <= hardEnd.getTime())
    .sort((a, b) => a - b);
  for (const t of sorted) {
    const at = new Date(t);
    if (findRule(tariff, at, ctx) !== startRule) return at;
  }
  return hardEnd;
}

export function totalCost(
  tariff: Tariff | null,
  fromNow: Date,
  durationMinutes: number,
  ctx: EvalContext,
): TotalCostResult {
  if (!tariff) return "n/a";
  const end = new Date(fromNow.getTime() + durationMinutes * 60_000);
  const segments: Segment[] = [];
  let cursor = fromNow;

  // Guard against pathological loops (e.g. zero-length candidates).
  let guard = 0;
  while (cursor < end && guard++ < 10_000) {
    const rule = findRule(tariff, cursor, ctx);
    const segEnd = nextBoundary(tariff, cursor, end, ctx);
    const rate = rule?.pricePerHour ?? 0;
    segments.push({ from: cursor, to: segEnd, rate });
    cursor = segEnd;
  }

  let total = 0;
  for (const seg of segments) {
    const hours = (seg.to.getTime() - seg.from.getTime()) / MS_PER_HOUR;
    total += hours * seg.rate;
  }

  const cap = tariff.rules.find((r) => r.maxPerDay != null)?.maxPerDay ?? null;
  if (cap != null && total > cap) total = cap;

  return { total: Math.round(total * 100) / 100, breakdown: segments };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/total-cost.test.ts --root packages/tariff`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tariff/src/total-cost.ts packages/tariff/tests/total-cost.test.ts
git commit -m "feat(tariff): totalCost takes EvalContext + analytic boundary stepping"
```

---

### Task 6: GeoJSON + city types; export surface

**Files:**
- Modify: `packages/tariff/src/types.ts`, `packages/tariff/src/index.ts`
- Test: `packages/tariff/tests/types.test.ts` (new, type-level smoke)

- [ ] **Step 1: Write a smoke test**

```ts
// packages/tariff/tests/types.test.ts
import { describe, expect, it } from "vitest";
import type {
  ParkingFeature, ParkingFeatureCollection, CityMeta, CityId, Vehicle,
} from "../src/types.js";

describe("unified GeoJSON types", () => {
  it("a Point feature compiles and round-trips", () => {
    const f: ParkingFeature = {
      type: "Feature",
      geometry: { type: "Point", coordinates: [11.92, 57.68] },
      properties: {
        id: "gbg:1", city: "goteborg", vehicle: "bilar", name: "X",
        provider: "Y", tariffId: "t1", rulesText: "…", accessible: false,
        spaces: 10, maxParkingMinutes: 30,
      },
    };
    const fc: ParkingFeatureCollection = {
      type: "FeatureCollection",
      generatedAt: "2026-05-30T04:00:00Z",
      cities: {
        goteborg: { source: "s", timeZone: "Europe/Stockholm", holidayCalendar: "SE", center: [11.97, 57.71] },
      } as Record<CityId, CityMeta>,
      features: [f],
    };
    expect(fc.features[0]!.properties.city).toBe("goteborg");
    const v: Vehicle = "bilar";
    expect(v).toBe("bilar");
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/types.test.ts --root packages/tariff`
Expected: FAIL — types not exported.

- [ ] **Step 3: Implement — types.ts additions**

Append to `packages/tariff/src/types.ts` (and **remove** the old `Parking`, `ParkingsSnapshot` types — see note):

```ts
import type { Calendar } from "./holidays.js";

export type CityId = "goteborg" | "stockholm";
export type Vehicle = "bilar";

export type CityMeta = {
  source: string;
  timeZone: string;        // IANA, e.g. "Europe/Stockholm"
  holidayCalendar: Calendar;
  center: [number, number]; // [lng, lat]
};

export type ParkingProperties = {
  id: string;              // "gbg:…" / "sthlm:…"
  city: CityId;
  vehicle: Vehicle;
  name: string;
  provider: string;
  tariffId: string | null;
  rulesText: string;
  accessible: boolean;
  spaces: number | null;
  maxParkingMinutes: number | null;
};

export type PointGeometry = { type: "Point"; coordinates: [number, number] };
export type LineGeometry = { type: "LineString"; coordinates: [number, number][] };
export type MultiLineGeometry = { type: "MultiLineString"; coordinates: [number, number][][] };
export type ParkingGeometry = PointGeometry | LineGeometry | MultiLineGeometry;

export type ParkingFeature = {
  type: "Feature";
  geometry: ParkingGeometry;
  properties: ParkingProperties;
};

export type ParkingFeatureCollection = {
  type: "FeatureCollection";
  generatedAt: string;
  cities: Record<CityId, CityMeta>;
  features: ParkingFeature[];
};
```

**Removal note:** the old `Parking` and `ParkingsSnapshot` types are replaced by `ParkingFeature`/`ParkingFeatureCollection`. Keep `Tariff`, `TariffRule`, `TariffsSnapshot`. The poller's `normalize.ts`/`main.ts` (Tasks 9–12) and the web app (Tasks 14+) are updated to the new types; this task only adds the types. To keep the build green between tasks, leave the old `Parking` type in place **until Task 9** removes its last consumer, then delete it in Task 9.

- [ ] **Step 3b: Implement — index.ts**

```ts
// packages/tariff/src/index.ts
export * from "./types.js";
export { dayOfWeekFor, hourOf, ruleAppliesAt, type EvalContext } from "./days.js";
export { priceNow, type PriceNow } from "./price-now.js";
export { totalCost, type TotalCostResult, type Segment } from "./total-cost.js";
export { isHoliday, dayClassOf, type DayClass, type Calendar } from "./holidays.js";
export { wallClockParts, type WallClock } from "./wallclock.js";
```

- [ ] **Step 4: Run tests + full package build**

Run: `npm test --workspace @cheap-park/tariff`
Then: `npm run build --workspace @cheap-park/tariff`
Expected: all tariff tests PASS; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/tariff/src/types.ts packages/tariff/src/index.ts packages/tariff/tests/types.test.ts
git commit -m "feat(tariff): unified GeoJSON + city metadata types"
```

---

## Phase 2 — Poller: Stockholm producer + orchestrator

### Task 7: Stockholm fetcher

**Files:**
- Create: `packages/poller/src/fetch-stockholm.ts`
- Test: `packages/poller/tests/fetch-stockholm.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/poller/tests/fetch-stockholm.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchStockholm } from "../src/fetch-stockholm.js";

describe("fetchStockholm", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("calls ptillaten/all with the api key and json format", async () => {
    const urls: string[] = [];
    globalThis.fetch = vi.fn(async (url) => {
      urls.push(String(url));
      return new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), { status: 200 });
    }) as typeof fetch;

    await fetchStockholm("KEY123");
    expect(urls[0]).toContain("/LTF-Tolken/v1/ptillaten/all");
    expect(urls[0]).toContain("outputFormat=json");
    expect(urls[0]).toContain("apiKey=KEY123");
  });

  it("throws on non-ok", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 403 })) as typeof fetch;
    await expect(fetchStockholm("X")).rejects.toThrow(/403/);
  });

  it("returns the parsed feature collection", async () => {
    const fc = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [18, 59] }, properties: {} }] };
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(fc), { status: 200 })) as typeof fetch;
    const out = await fetchStockholm("X");
    expect(out.features).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/fetch-stockholm.test.ts --root packages/poller`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// packages/poller/src/fetch-stockholm.ts
const BASE = "https://openparking.stockholm.se/LTF-Tolken/v1";

export type RawStockholmFeature = {
  type: "Feature";
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown>;
};

export type RawStockholmFC = {
  type: "FeatureCollection";
  features: RawStockholmFeature[];
};

export async function fetchStockholm(apiKey: string): Promise<RawStockholmFC> {
  const url = `${BASE}/ptillaten/all?outputFormat=json&apiKey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch ptillaten failed: ${res.status} ${res.statusText}`);
  }
  // Response is UTF-8 GeoJSON; res.json() decodes UTF-8 by default.
  return (await res.json()) as RawStockholmFC;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/fetch-stockholm.test.ts --root packages/poller`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/poller/src/fetch-stockholm.ts packages/poller/tests/fetch-stockholm.test.ts
git commit -m "feat(poller): Stockholm ptillaten fetcher"
```

---

### Task 8: Stockholm tariff templates (PARKING_RATE → Tariff)

**Files:**
- Create: `packages/poller/src/tariff-templates-stockholm.ts`
- Test: `packages/poller/tests/tariff-templates-stockholm.test.ts`

The six car patterns are fixed strings (validated live). We match by the leading `taxa N:` token (or `avgiftsfri`) and return a hand-built `Tariff` with the official rates. This is a lookup table keyed by taxa number, not a free-text parser — the strings are stable and there are only six.

- [ ] **Step 1: Write the failing test**

```ts
// packages/poller/tests/tariff-templates-stockholm.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { matchStockholmTariff, resetStockholmRegistry, getStockholmTariffs } from "../src/tariff-templates-stockholm.js";
import { priceNow } from "@cheap-park/tariff";
import type { EvalContext } from "@cheap-park/tariff";

const SE: EvalContext = { timeZone: "Europe/Stockholm", calendar: "SE" };

describe("matchStockholmTariff", () => {
  beforeEach(() => resetStockholmRegistry());

  it("avgiftsfri → free tariff id", () => {
    expect(matchStockholmTariff("avgiftsfri")).toBe("sthlm-avgiftsfri");
  });

  it("taxa 1 → sthlm-taxa-1, 55 kr/h around the clock", () => {
    const id = matchStockholmTariff("taxa 1: 55 kr/tim alla dagar 00-24 Boende: ingen boendeparkering");
    expect(id).toBe("sthlm-taxa-1");
    const t = getStockholmTariffs().find((x) => x.id === id)!;
    expect(priceNow(t, new Date("2026-05-27T11:00:00Z"), SE)).toBe(55); // Wed 13:00
    expect(priceNow(t, new Date("2026-05-31T01:00:00Z"), SE)).toBe(55); // Sun 03:00
  });

  it("taxa 3 → 20 vardag 7-19, 15 preHelgdag 11-17, else free", () => {
    const id = matchStockholmTariff("taxa 3: 20 kr/tim vardagar 7-19, 15 kr/tim dag före helgdag 11-17, Boende: 1100 kr/månad eller 75 kr/dygn");
    expect(id).toBe("sthlm-taxa-3");
    const t = getStockholmTariffs().find((x) => x.id === id)!;
    expect(priceNow(t, new Date("2026-05-27T11:00:00Z"), SE)).toBe(20);   // Wed 13:00 vardag
    expect(priceNow(t, new Date("2026-05-30T11:00:00Z"), SE)).toBe(15);   // Sat 13:00 preHelgdag
    expect(priceNow(t, new Date("2026-05-31T11:00:00Z"), SE)).toBe("free"); // Sun
  });

  it("unknown pattern → null, nothing registered", () => {
    expect(matchStockholmTariff("taxa 99: weird")).toBe(null);
  });

  it("taxa 5 → 5 kr vardag 7-19", () => {
    const id = matchStockholmTariff("taxa 5: 5 kr/tim vardagar 7-19, Boende: 300 kr/månad eller 20 kr/dygn");
    const t = getStockholmTariffs().find((x) => x.id === id)!;
    expect(priceNow(t, new Date("2026-05-27T11:00:00Z"), SE)).toBe(5);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/tariff-templates-stockholm.test.ts --root packages/poller`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// packages/poller/src/tariff-templates-stockholm.ts
import type { Tariff } from "@cheap-park/tariff";

const REGISTRY = new Map<string, Tariff>();
export function getStockholmTariffs(): Tariff[] {
  return [...REGISTRY.values()].sort((a, b) => a.id.localeCompare(b.id));
}
export function resetStockholmRegistry(): void {
  REGISTRY.clear();
}

// Official Taxa 1–5 (Stockholms stad). dayClasses encode the wording:
// "vardagar" = vardag, "dag före helgdag" = preHelgdag, "helgdag" = helgdag.
function buildTariff(id: string): Tariff | null {
  switch (id) {
    case "sthlm-avgiftsfri":
      return { id, name: "Avgiftsfri", rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }] };
    case "sthlm-taxa-1":
      return { id, name: "Taxa 1", rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 55 }] };
    case "sthlm-taxa-2":
      return {
        id, name: "Taxa 2",
        rules: [
          { daysOfWeek: [], dayClasses: ["vardag"], hourStart: 7, hourEnd: 21, pricePerHour: 31 },
          { daysOfWeek: [], dayClasses: ["preHelgdag", "helgdag"], hourStart: 9, hourEnd: 19, pricePerHour: 31 },
          { daysOfWeek: [], dayClasses: ["vardag"], hourStart: 0, hourEnd: 7, pricePerHour: 20 },
          { daysOfWeek: [], dayClasses: ["vardag"], hourStart: 21, hourEnd: 24, pricePerHour: 20 },
          { daysOfWeek: [], dayClasses: ["preHelgdag", "helgdag"], hourStart: 0, hourEnd: 9, pricePerHour: 20 },
          { daysOfWeek: [], dayClasses: ["preHelgdag", "helgdag"], hourStart: 19, hourEnd: 24, pricePerHour: 20 },
        ],
      };
    case "sthlm-taxa-3":
      return {
        id, name: "Taxa 3",
        rules: [
          { daysOfWeek: [], dayClasses: ["vardag"], hourStart: 7, hourEnd: 19, pricePerHour: 20 },
          { daysOfWeek: [], dayClasses: ["preHelgdag"], hourStart: 11, hourEnd: 17, pricePerHour: 15 },
        ],
      };
    case "sthlm-taxa-4":
      return {
        id, name: "Taxa 4",
        rules: [
          { daysOfWeek: [], dayClasses: ["vardag"], hourStart: 7, hourEnd: 19, pricePerHour: 10 },
          { daysOfWeek: [], dayClasses: ["preHelgdag"], hourStart: 11, hourEnd: 17, pricePerHour: 10 },
        ],
      };
    case "sthlm-taxa-5":
      return {
        id, name: "Taxa 5",
        rules: [{ daysOfWeek: [], dayClasses: ["vardag"], hourStart: 7, hourEnd: 19, pricePerHour: 5 }],
      };
    default:
      return null;
  }
}

export function matchStockholmTariff(parkingRate: string): string | null {
  const s = parkingRate.trim().toLowerCase();
  let id: string | null = null;
  if (s.startsWith("avgiftsfri")) id = "sthlm-avgiftsfri";
  else {
    const m = s.match(/^taxa\s+(\d+)\s*:/);
    if (m) {
      const n = m[1];
      if (["1", "2", "3", "4", "5"].includes(n!)) id = `sthlm-taxa-${n}`;
    }
  }
  if (!id) return null;
  const t = buildTariff(id);
  if (!t) return null;
  REGISTRY.set(t.id, t);
  return t.id;
}
```

Note: `taxa 11–14` intentionally return `null` here (MC/special, not cars). The spec mentions parsing them "for completeness," but since MVP filters to cars only, they never reach this function. If a future car row uses them, this returns `null` → "pris okänt", which is the safe fallback. Out of scope to build them now (YAGNI).

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/tariff-templates-stockholm.test.ts --root packages/poller`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/poller/src/tariff-templates-stockholm.ts packages/poller/tests/tariff-templates-stockholm.test.ts
git commit -m "feat(poller): Stockholm tariff templates (Taxa 1-5 + avgiftsfri)"
```

---

### Task 9: Geometry helpers (midpoint + coord rounding)

**Files:**
- Create: `packages/poller/src/geometry.ts`
- Test: `packages/poller/tests/geometry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/poller/tests/geometry.test.ts
import { describe, expect, it } from "vitest";
import { midpointOf, roundCoord, roundGeometry } from "../src/geometry.js";

describe("roundCoord", () => {
  it("rounds to 5 decimals", () => {
    expect(roundCoord(18.0628753)).toBe(18.06288);
  });
});

describe("midpointOf", () => {
  it("Point → itself", () => {
    expect(midpointOf({ type: "Point", coordinates: [18, 59] })).toEqual({ lat: 59, lng: 18 });
  });
  it("LineString → midpoint by vertex-count center", () => {
    const mid = midpointOf({ type: "LineString", coordinates: [[18.0, 59.0], [18.0, 59.2]] });
    expect(mid.lat).toBeCloseTo(59.1, 5);
    expect(mid.lng).toBeCloseTo(18.0, 5);
  });
  it("MultiLineString → midpoint over all vertices", () => {
    const mid = midpointOf({
      type: "MultiLineString",
      coordinates: [[[18.0, 59.0], [18.0, 59.0]], [[18.0, 59.2], [18.0, 59.2]]],
    });
    expect(mid.lat).toBeCloseTo(59.1, 5);
  });
});

describe("roundGeometry", () => {
  it("rounds every coordinate of a LineString", () => {
    const g = roundGeometry({ type: "LineString", coordinates: [[18.0628753, 59.3330612]] });
    expect(g).toEqual({ type: "LineString", coordinates: [[18.06288, 59.33306]] });
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/geometry.test.ts --root packages/poller`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// packages/poller/src/geometry.ts
import type { ParkingGeometry } from "@cheap-park/tariff";

export function roundCoord(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

export function roundGeometry(g: ParkingGeometry): ParkingGeometry {
  if (g.type === "Point") {
    return { type: "Point", coordinates: [roundCoord(g.coordinates[0]), roundCoord(g.coordinates[1])] };
  }
  if (g.type === "LineString") {
    return { type: "LineString", coordinates: g.coordinates.map((c) => [roundCoord(c[0]), roundCoord(c[1])]) };
  }
  return {
    type: "MultiLineString",
    coordinates: g.coordinates.map((line) => line.map((c) => [roundCoord(c[0]), roundCoord(c[1])])),
  };
}

export function midpointOf(g: ParkingGeometry): { lat: number; lng: number } {
  if (g.type === "Point") return { lat: g.coordinates[1], lng: g.coordinates[0] };
  const pts: [number, number][] =
    g.type === "LineString" ? g.coordinates : g.coordinates.flat();
  let sumLng = 0, sumLat = 0;
  for (const [lng, lat] of pts) { sumLng += lng; sumLat += lat; }
  return { lat: roundCoord(sumLat / pts.length), lng: roundCoord(sumLng / pts.length) };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/geometry.test.ts --root packages/poller`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/poller/src/geometry.ts packages/poller/tests/geometry.test.ts
git commit -m "feat(poller): geometry midpoint + coordinate rounding"
```

---

### Task 10: Normalize Stockholm features (cars only)

**Files:**
- Create: `packages/poller/src/normalize-stockholm.ts`
- Test: `packages/poller/tests/normalize-stockholm.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/poller/tests/normalize-stockholm.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { normalizeStockholm } from "../src/normalize-stockholm.js";
import { resetStockholmRegistry } from "../src/tariff-templates-stockholm.js";
import type { RawStockholmFC } from "../src/fetch-stockholm.js";

const fc: RawStockholmFC = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[18.0628753, 59.3330612], [18.0625, 59.3330]] },
      properties: {
        VEHICLE: "fordon", STREET_NAME: "Sveavägen",
        PARKING_RATE: "taxa 2: 31 kr/tim vardagar 7-21 och dag före helgdag och helgdag 9-19, 20 kr/tim övrig tid, Boende: 1100 kr/månad eller 75 kr/dygn",
        CITATION: "0180 2021-05253",
      },
    },
    {
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[18.07, 59.33], [18.071, 59.331]] },
      properties: { VEHICLE: "motorcykel", STREET_NAME: "X", PARKING_RATE: "avgiftsfri", CITATION: "c2" },
    },
  ],
};

describe("normalizeStockholm", () => {
  beforeEach(() => resetStockholmRegistry());

  it("keeps only cars (VEHICLE=fordon)", () => {
    const out = normalizeStockholm(fc);
    expect(out).toHaveLength(1);
    expect(out[0]!.properties.name).toBe("Sveavägen");
  });

  it("builds a unified feature with prefixed id, city, vehicle, rulesText", () => {
    const f = normalizeStockholm(fc)[0]!;
    expect(f.properties.id).toBe("sthlm:0180 2021-05253");
    expect(f.properties.city).toBe("stockholm");
    expect(f.properties.vehicle).toBe("bilar");
    expect(f.properties.provider).toBe("Stockholms stad");
    expect(f.properties.tariffId).toBe("sthlm-taxa-2");
    expect(f.properties.rulesText).toContain("taxa 2");
    expect(f.properties.accessible).toBe(false);
    expect(f.properties.spaces).toBe(null);
    expect(f.properties.maxParkingMinutes).toBe(null);
  });

  it("rounds geometry to 5 decimals and preserves type", () => {
    const f = normalizeStockholm(fc)[0]!;
    expect(f.geometry.type).toBe("LineString");
    if (f.geometry.type === "LineString") {
      expect(f.geometry.coordinates[0]).toEqual([18.06288, 59.33306]);
    }
  });

  it("unknown rate → tariffId null but feature kept", () => {
    const weird: RawStockholmFC = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: { type: "LineString", coordinates: [[18, 59], [18.001, 59.001]] },
        properties: { VEHICLE: "fordon", STREET_NAME: "Z", PARKING_RATE: "taxa 99: weird", CITATION: "c3" },
      }],
    };
    const f = normalizeStockholm(weird)[0]!;
    expect(f.properties.tariffId).toBe(null);
    expect(f.properties.rulesText).toBe("taxa 99: weird");
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/normalize-stockholm.test.ts --root packages/poller`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// packages/poller/src/normalize-stockholm.ts
import type { ParkingFeature, ParkingGeometry } from "@cheap-park/tariff";
import type { RawStockholmFC, RawStockholmFeature } from "./fetch-stockholm.js";
import { matchStockholmTariff } from "./tariff-templates-stockholm.js";
import { roundGeometry } from "./geometry.js";

function asString(v: unknown): string {
  return v == null ? "" : String(v);
}

function toGeometry(raw: RawStockholmFeature["geometry"]): ParkingGeometry | null {
  if (!raw) return null;
  if (raw.type === "LineString") return { type: "LineString", coordinates: raw.coordinates as [number, number][] };
  if (raw.type === "MultiLineString") return { type: "MultiLineString", coordinates: raw.coordinates as [number, number][][] };
  if (raw.type === "Point") return { type: "Point", coordinates: raw.coordinates as [number, number] };
  return null;
}

export function normalizeStockholm(fc: RawStockholmFC): ParkingFeature[] {
  const out: ParkingFeature[] = [];
  for (const raw of fc.features) {
    if (asString(raw.properties["VEHICLE"]) !== "fordon") continue;
    const geom = toGeometry(raw.geometry);
    if (!geom) continue;

    const citation = asString(raw.properties["CITATION"]).trim();
    if (!citation) continue;

    const rate = asString(raw.properties["PARKING_RATE"]).trim();
    const tariffId = rate ? matchStockholmTariff(rate) : null;

    out.push({
      type: "Feature",
      geometry: roundGeometry(geom),
      properties: {
        id: `sthlm:${citation}`,
        city: "stockholm",
        vehicle: "bilar",
        name: asString(raw.properties["STREET_NAME"]) || citation,
        provider: "Stockholms stad",
        tariffId,
        rulesText: rate || "Inga regler tillgängliga",
        accessible: false, // cars-only feed; rörelsehindrad rows are excluded
        spaces: null,
        maxParkingMinutes: null,
      },
    });
  }
  // Dedup by id (citation can repeat across segments); first wins.
  const seen = new Set<string>();
  return out.filter((f) => {
    if (seen.has(f.properties.id)) return false;
    seen.add(f.properties.id);
    return true;
  }).sort((a, b) => a.properties.id.localeCompare(b.properties.id));
}
```

Note: the spec keeps line geometry per segment. Citations *can* repeat across multiple segments of the same regulation; dedup-by-id would collapse them to one feature. **Decision:** since multiple physical segments share one citation but are distinct map lines, change the id to include a positional suffix to preserve them. Replace the dedup block with a per-id counter:

```ts
  const counts = new Map<string, number>();
  return out.map((f) => {
    const base = f.properties.id;
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1);
    if (n > 0) f.properties.id = `${base}#${n}`;
    return f;
  }).sort((a, b) => a.properties.id.localeCompare(b.properties.id));
```

Use this counter version (not the dedup version) so no street segment is dropped. Update the test's expected id only if a fixture has duplicate citations — the fixture above has unique citations, so `sthlm:0180 2021-05253` stays correct.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/normalize-stockholm.test.ts --root packages/poller`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/poller/src/normalize-stockholm.ts packages/poller/tests/normalize-stockholm.test.ts
git commit -m "feat(poller): normalize Stockholm features (cars only, line geometry)"
```

---

### Task 11: Convert Gothenburg normalize to unified features

**Files:**
- Modify: `packages/poller/src/normalize.ts`
- Test: `packages/poller/tests/normalize.test.ts` (update)
- Modify: `packages/tariff/src/types.ts` (delete old `Parking`/`ParkingsSnapshot`)

- [ ] **Step 1: Update the test**

Open `packages/poller/tests/normalize.test.ts`. The current tests assert flat `Parking` objects (`.lat`, `.owner`, `.tariffId`, `.raw`). Rewrite assertions to the unified feature shape. Example for the core case:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { normalize } from "../src/normalize.js";
import { resetRegistry } from "../src/tariff-templates.js";

describe("normalize (Gothenburg → unified features)", () => {
  beforeEach(() => resetRegistry());

  const raw = {
    toll: [{
      Id: "1480 2006-00031", Name: "Sannaplan", Owner: "Stadsmiljöförvaltningen",
      Lat: 57.684255, Long: 11.915636, ParkingSpaces: 11,
      ParkingCost: "7 kr/tim 8-22 alla dagar. Övrig tid: 2 kr/tim",
      MaxParkingTime: "24 tim",
      MaxParkingTimeLimitation: "Tidsbegränsningen gäller vardag …",
      ExtraInfo: "Endast rörelsehindrade",
    }],
    time: [],
  };

  it("produces a Point feature with prefixed id and normalized props", () => {
    const out = normalize(raw as never);
    expect(out).toHaveLength(1);
    const f = out[0]!;
    expect(f.geometry).toEqual({ type: "Point", coordinates: [11.915636, 57.684255] });
    expect(f.properties.id).toBe("gbg:1480 2006-00031");
    expect(f.properties.city).toBe("goteborg");
    expect(f.properties.vehicle).toBe("bilar");
    expect(f.properties.provider).toBe("Stadsmiljöförvaltningen");
    expect(f.properties.spaces).toBe(11);
    expect(f.properties.accessible).toBe(true); // ExtraInfo matches rörelsehindrade
    expect(f.properties.rulesText).toContain("7 kr/tim");
    expect(f.properties.tariffId).not.toBe(null);
  });

  it("drops records without coordinates", () => {
    const out = normalize({ toll: [{ Id: "x" }], time: [] } as never);
    expect(out).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/normalize.test.ts --root packages/poller`
Expected: FAIL.

- [ ] **Step 3: Implement — normalize.ts**

```ts
// packages/poller/src/normalize.ts
import type { ParkingFeature } from "@cheap-park/tariff";
import type { RawParking } from "./fetch.js";
import { matchTariff, parseDurationMinutes } from "./tariff-templates.js";

const ACCESSIBLE_RE = /rörelsehindrade|handikapp|permit/i;

function asString(v: unknown): string {
  return v == null ? "" : String(v);
}
function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function rulesTextOf(raw: RawParking): string {
  const parts: string[] = [];
  for (const k of ["ParkingCost", "MaxParkingTimeLimitation", "ExtraInfo"]) {
    const v = raw[k];
    if (v != null && String(v) !== "") parts.push(String(v));
  }
  return parts.join("\n") || "Inga regler tillgängliga";
}

function toFeature(raw: RawParking): ParkingFeature | null {
  const lat = asNumber(raw.Lat);
  const lng = asNumber(raw.Long);
  if (lat == null || lng == null) return null;
  const id = asString(raw.Id);
  if (!id) return null;

  const cost = asString(raw["ParkingCost"]);
  const tariffId = matchTariff({ ParkingCost: cost, MaxParkingTime: raw["MaxParkingTime"] });
  const extra = asString(raw["ExtraInfo"]);

  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: {
      id: `gbg:${id}`,
      city: "goteborg",
      vehicle: "bilar",
      name: asString(raw.Name),
      provider: asString(raw.Owner),
      tariffId,
      rulesText: rulesTextOf(raw),
      accessible: ACCESSIBLE_RE.test(extra),
      spaces: asNumber(raw["ParkingSpaces"]) ?? 0,
      maxParkingMinutes: parseDurationMinutes(raw["MaxParkingTime"]),
    },
  };
}

export function normalize(input: { toll: RawParking[]; time: RawParking[] }): ParkingFeature[] {
  const seen = new Set<string>();
  const out: ParkingFeature[] = [];
  for (const r of [...input.toll, ...input.time]) {
    const f = toFeature(r);
    if (!f) continue;
    if (seen.has(f.properties.id)) continue;
    seen.add(f.properties.id);
    out.push(f);
  }
  return out.sort((a, b) => a.properties.id.localeCompare(b.properties.id));
}
```

- [ ] **Step 3b: Delete old types**

In `packages/tariff/src/types.ts`, delete the old `Parking` and `ParkingsSnapshot` type declarations (kept since Task 6). `TariffsSnapshot` stays.

- [ ] **Step 4: Run to verify pass + tariff build**

Run: `npx vitest run tests/normalize.test.ts --root packages/poller`
Then: `npm run build --workspace @cheap-park/tariff`
Expected: PASS; tariff build clean (no remaining `Parking` consumers in tariff).

- [ ] **Step 5: Commit**

```bash
git add packages/poller/src/normalize.ts packages/poller/tests/normalize.test.ts packages/tariff/src/types.ts
git commit -m "feat(poller): Gothenburg normalize emits unified GeoJSON features"
```

---

### Task 12: Per-city sanity gate

**Files:**
- Modify: `packages/poller/src/sanity.ts`
- Test: `packages/poller/tests/sanity.test.ts` (update)

- [ ] **Step 1: Update the test**

```ts
// packages/poller/tests/sanity.test.ts
import { describe, expect, it } from "vitest";
import { sanityCheckCity, sanityCheckAll } from "../src/sanity.js";

describe("sanityCheckCity", () => {
  it("ok when previous is 0 (bootstrap)", () => {
    expect(sanityCheckCity({ city: "stockholm", newCount: 5, lastCount: 0 }).ok).toBe(true);
  });
  it("ok at exactly 80% retained", () => {
    expect(sanityCheckCity({ city: "goteborg", newCount: 80, lastCount: 100 }).ok).toBe(true);
  });
  it("fails when more than 20% dropped", () => {
    const r = sanityCheckCity({ city: "goteborg", newCount: 79, lastCount: 100 });
    expect(r.ok).toBe(false);
  });
  it("fails when a city goes to zero", () => {
    expect(sanityCheckCity({ city: "stockholm", newCount: 0, lastCount: 100 }).ok).toBe(false);
  });
});

describe("sanityCheckAll", () => {
  it("ok only when every city passes", () => {
    const r = sanityCheckAll(
      { goteborg: 100, stockholm: 200 },
      { goteborg: 95, stockholm: 50 },
    );
    expect(r.ok).toBe(false); // stockholm dropped 75%
  });
  it("ok when all within threshold", () => {
    const r = sanityCheckAll(
      { goteborg: 100, stockholm: 200 },
      { goteborg: 95, stockholm: 190 },
    );
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/sanity.test.ts --root packages/poller`
Expected: FAIL — new exports missing.

- [ ] **Step 3: Implement**

```ts
// packages/poller/src/sanity.ts
import type { CityId } from "@cheap-park/tariff";

const MIN_RATIO = 0.8; // abort if a city drops more than 20%

export type SanityResult = { ok: true } | { ok: false; reason: string };

export function sanityCheckCity(args: {
  city: string; newCount: number; lastCount: number;
}): SanityResult {
  const { city, newCount, lastCount } = args;
  if (lastCount === 0) return { ok: true };
  if (newCount === 0) {
    return { ok: false, reason: `${city} dropped to 0 from ${lastCount}` };
  }
  const ratio = newCount / lastCount;
  if (ratio < MIN_RATIO) {
    return {
      ok: false,
      reason: `${city} dropped to ${newCount} from ${lastCount} (ratio ${ratio.toFixed(2)} < ${MIN_RATIO})`,
    };
  }
  return { ok: true };
}

export function sanityCheckAll(
  newCounts: Partial<Record<CityId, number>>,
  lastCounts: Partial<Record<CityId, number>>,
): SanityResult {
  for (const city of Object.keys(newCounts) as CityId[]) {
    const r = sanityCheckCity({
      city,
      newCount: newCounts[city] ?? 0,
      lastCount: lastCounts[city] ?? 0,
    });
    if (!r.ok) return r;
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/sanity.test.ts --root packages/poller`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/poller/src/sanity.ts packages/poller/tests/sanity.test.ts
git commit -m "feat(poller): per-city sanity gate (>20% drop aborts)"
```

---

### Task 13: Orchestrator — merge both cities, write parkings.geojson

**Files:**
- Modify: `packages/poller/src/main.ts`
- Test: `packages/poller/tests/main.test.ts` (rewrite)

- [ ] **Step 1: Rewrite the test**

```ts
// packages/poller/tests/main.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { runPoll } from "../src/main.js";
import { resetRegistry } from "../src/tariff-templates.js";
import { resetStockholmRegistry } from "../src/tariff-templates-stockholm.js";
import type { ParkingFeatureCollection } from "@cheap-park/tariff";

const gbgRaw = {
  toll: [{
    Id: "1", Name: "G", Owner: "Stad", Lat: 57.7, Long: 11.97, ParkingSpaces: 5,
    ParkingCost: "avgiftsfri", MaxParkingTime: "30 min",
  }],
  time: [],
};
const sthlmRaw = {
  type: "FeatureCollection" as const,
  features: [{
    type: "Feature" as const,
    geometry: { type: "LineString", coordinates: [[18.06, 59.33], [18.061, 59.331]] },
    properties: { VEHICLE: "fordon", STREET_NAME: "S", PARKING_RATE: "avgiftsfri", CITATION: "c1" },
  }],
};

function makeOpts(prev: ParkingFeatureCollection | null, written: Record<string, unknown>) {
  return {
    gbgAppId: "a", sthlmApiKey: "k",
    fetchGbg: async () => gbgRaw,
    fetchSthlm: async () => sthlmRaw,
    readPrevious: async () => prev,
    writeJson: async (path: string, data: unknown) => { written[path] = data; },
  };
}

describe("runPoll orchestrator", () => {
  beforeEach(() => { resetRegistry(); resetStockholmRegistry(); });

  it("merges both cities into one FeatureCollection with city metadata", async () => {
    const written: Record<string, unknown> = {};
    const res = await runPoll(makeOpts(null, written));
    expect(res.committed).toBe(true);
    const geojson = Object.entries(written).find(([p]) => p.endsWith("parkings.geojson"))![1] as ParkingFeatureCollection;
    expect(geojson.type).toBe("FeatureCollection");
    expect(geojson.features.map((f) => f.properties.city).sort()).toEqual(["goteborg", "stockholm"]);
    expect(geojson.cities.goteborg.timeZone).toBe("Europe/Stockholm");
    expect(geojson.cities.stockholm.holidayCalendar).toBe("SE");
  });

  it("aborts (keeps previous) when a city drops >20%", async () => {
    const prev: ParkingFeatureCollection = {
      type: "FeatureCollection", generatedAt: "x",
      cities: {} as never,
      features: [
        ...Array.from({ length: 10 }, (_, i) => ({
          type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [11, 57] as [number, number] },
          properties: { id: `gbg:${i}`, city: "goteborg" as const, vehicle: "bilar" as const, name: "", provider: "", tariffId: null, rulesText: "", accessible: false, spaces: null, maxParkingMinutes: null },
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [18, 59] as [number, number] },
          properties: { id: `sthlm:${i}`, city: "stockholm" as const, vehicle: "bilar" as const, name: "", provider: "", tariffId: null, rulesText: "", accessible: false, spaces: null, maxParkingMinutes: null },
        })),
      ],
    };
    const written: Record<string, unknown> = {};
    // gbg fetch returns just 1 (drop from 10) → abort
    const res = await runPoll(makeOpts(prev, written));
    expect(res.committed).toBe(false);
    expect(Object.keys(written)).toHaveLength(0); // nothing written
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/main.test.ts --root packages/poller`
Expected: FAIL.

- [ ] **Step 3: Implement**

Rewrite `packages/poller/src/main.ts`. Keep the `isMain` CLI block but wire two fetchers and write `parkings.geojson`.

```ts
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ParkingFeature, ParkingFeatureCollection, CityId, CityMeta, Tariff, TariffsSnapshot,
} from "@cheap-park/tariff";
import { fetchAllParkings, type RawParking } from "./fetch.js";
import { fetchStockholm, type RawStockholmFC } from "./fetch-stockholm.js";
import { normalize } from "./normalize.js";
import { normalizeStockholm } from "./normalize-stockholm.js";
import { sanityCheckAll } from "./sanity.js";
import { getRegisteredTariffs } from "./tariff-templates.js";
import { getStockholmTariffs } from "./tariff-templates-stockholm.js";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../../..");
const GEOJSON_PATH = resolve(REPO_ROOT, "apps/web/public/data/parkings.geojson");
const TARIFFS_PATH = resolve(REPO_ROOT, "apps/web/public/data/tariffs.json");
const SIZE_WARN_BYTES = 6 * 1024 * 1024;

const CITY_META: Record<CityId, CityMeta> = {
  goteborg: {
    source: "data.goteborg.se ParkingService v2.1",
    timeZone: "Europe/Stockholm", holidayCalendar: "SE", center: [11.9685, 57.7068],
  },
  stockholm: {
    source: "openparking.stockholm.se LTF-Tolken v1 (ptillaten)",
    timeZone: "Europe/Stockholm", holidayCalendar: "SE", center: [18.0686, 59.3293],
  },
};

export type RunOptions = {
  gbgAppId: string;
  sthlmApiKey: string;
  fetchGbg: (appId: string) => Promise<{ toll: RawParking[]; time: RawParking[] }>;
  fetchSthlm: (apiKey: string) => Promise<RawStockholmFC>;
  readPrevious: () => Promise<ParkingFeatureCollection | null>;
  writeJson: (path: string, data: unknown) => Promise<void>;
};

export type RunResult =
  | { committed: true; count: number }
  | { committed: false; reason: string };

function countByCity(features: ParkingFeature[]): Partial<Record<CityId, number>> {
  const out: Partial<Record<CityId, number>> = {};
  for (const f of features) out[f.properties.city] = (out[f.properties.city] ?? 0) + 1;
  return out;
}

export async function runPoll(opts: RunOptions): Promise<RunResult> {
  const [gbgRaw, sthlmRaw] = await Promise.all([
    opts.fetchGbg(opts.gbgAppId),
    opts.fetchSthlm(opts.sthlmApiKey),
  ]);

  const features: ParkingFeature[] = [...normalize(gbgRaw), ...normalizeStockholm(sthlmRaw)];

  const previous = await opts.readPrevious();
  const lastCounts = previous ? countByCity(previous.features) : {};
  const sanity = sanityCheckAll(countByCity(features), lastCounts);
  if (!sanity.ok) return { committed: false, reason: sanity.reason };

  const tariffs: Tariff[] = [...getRegisteredTariffs(), ...getStockholmTariffs()];
  const usedIds = new Set(features.map((f) => f.properties.tariffId).filter((x): x is string => !!x));
  const usedTariffs = tariffs.filter((t) => usedIds.has(t.id));

  const collection: ParkingFeatureCollection = {
    type: "FeatureCollection",
    generatedAt: new Date().toISOString(),
    cities: CITY_META,
    features,
  };
  const tariffsSnapshot: TariffsSnapshot = { tariffs: usedTariffs };

  await opts.writeJson(GEOJSON_PATH, collection);
  await opts.writeJson(TARIFFS_PATH, tariffsSnapshot);

  const bytes = Buffer.byteLength(JSON.stringify(collection));
  if (bytes > SIZE_WARN_BYTES) {
    console.warn(`WARN: parkings.geojson is ${(bytes / 1e6).toFixed(1)} MB (>6 MB); consider line simplification.`);
  }

  return { committed: true, count: features.length };
}

async function readPreviousFromDisk(): Promise<ParkingFeatureCollection | null> {
  try {
    const text = await readFile(GEOJSON_PATH, "utf8");
    return JSON.parse(text) as ParkingFeatureCollection;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function writeJsonToDisk(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

const isMain =
  typeof process.argv[1] === "string" && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const gbgAppId = process.env["GBG_APPID"];
  const sthlmApiKey = process.env["STHLM_TK_APIKEY"];
  if (!gbgAppId) { console.error("GBG_APPID env var is required"); process.exit(1); }
  if (!sthlmApiKey) { console.error("STHLM_TK_APIKEY env var is required"); process.exit(1); }

  runPoll({
    gbgAppId, sthlmApiKey,
    fetchGbg: fetchAllParkings,
    fetchSthlm: fetchStockholm,
    readPrevious: readPreviousFromDisk,
    writeJson: writeJsonToDisk,
  })
    .then((result) => {
      if (result.committed) console.log(`OK: wrote ${result.count} features`);
      else { console.error(`ABORT: ${result.reason}`); process.exit(2); }
    })
    .catch((err) => { console.error("FAIL:", err); process.exit(1); });
}
```

- [ ] **Step 4: Run tests + poller build**

Run: `npm test --workspace @cheap-park/poller`
Then: `npm run build --workspace @cheap-park/poller`
Expected: all poller tests PASS; build clean.

- [ ] **Step 5: Commit**

```bash
git add packages/poller/src/main.ts packages/poller/tests/main.test.ts
git commit -m "feat(poller): orchestrate Gothenburg + Stockholm into parkings.geojson"
```

---

### Task 14: Live smoke run of the poller

**Files:** none (manual verification + generated data commit)

- [ ] **Step 1: Run the poller against live APIs**

Run (PowerShell):
```powershell
$env:GBG_APPID = "<your-gbg-appid>"
$env:STHLM_TK_APIKEY = "ac12de3b-2716-4529-97fa-fd095a0135cd"
npm run poll --workspace @cheap-park/poller
```
Expected: `OK: wrote <N> features` where N is ~18000 (≈2600 Gothenburg + ≈15000 Stockholm). If it prints the 6 MB warning, note it but continue.

- [ ] **Step 2: Inspect output**

Run: `node -e "const d=require('./apps/web/public/data/parkings.geojson'); const c={}; d.features.forEach(f=>c[f.properties.city]=(c[f.properties.city]||0)+1); console.log(c); console.log('tariffs', require('./apps/web/public/data/tariffs.json').tariffs.map(t=>t.id))"`
Expected: counts for both cities; tariff ids include `sthlm-taxa-*` and the gbg ones.

- [ ] **Step 3: Remove the old parkings.json**

```bash
git rm apps/web/public/data/parkings.json
```

- [ ] **Step 4: Commit data + removal**

```bash
git add apps/web/public/data/parkings.geojson apps/web/public/data/tariffs.json
git commit -m "chore(data): first unified Gothenburg+Stockholm snapshot; drop parkings.json"
```

---

### Task 15: Update GitHub Actions workflow

**Files:**
- Modify: `.github/workflows/poll-data.yml`

- [ ] **Step 1: Add the secret to the run step**

In `.github/workflows/poll-data.yml`, find the "Run poller" step (around line 28-31) and add the Stockholm key alongside `GBG_APPID`:

```yaml
      - name: Run poller
        env:
          GBG_APPID: ${{ secrets.GBG_APPID }}
          STHLM_TK_APIKEY: ${{ secrets.STHLM_TK_APIKEY }}
        run: npm run poll --workspace @cheap-park/poller
```

- [ ] **Step 2: Verify the secret exists**

Confirm `STHLM_TK_APIKEY` is set at GitHub → repo Settings → Secrets and variables → Actions → Repository secrets. (The user added this manually.) No command needed; this is a checklist confirmation.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/poll-data.yml
git commit -m "ci(poller): pass STHLM_TK_APIKEY to the daily poll"
```

---

## Phase 3 — Web client

### Task 16: Client model + flatten

**Files:**
- Create: `apps/web/src/lib/client-model.ts`
- Test: `apps/web/src/tests/client-model.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/tests/client-model.test.ts
import { describe, expect, it } from "vitest";
import { flattenCollection } from "../lib/client-model.js";
import type { ParkingFeatureCollection } from "@cheap-park/tariff";

const fc: ParkingFeatureCollection = {
  type: "FeatureCollection",
  generatedAt: "2026-05-30T04:00:00Z",
  cities: {
    goteborg: { source: "g", timeZone: "Europe/Stockholm", holidayCalendar: "SE", center: [11.97, 57.71] },
    stockholm: { source: "s", timeZone: "Europe/Stockholm", holidayCalendar: "SE", center: [18.07, 59.33] },
  },
  features: [
    { type: "Feature", geometry: { type: "Point", coordinates: [11.92, 57.68] },
      properties: { id: "gbg:1", city: "goteborg", vehicle: "bilar", name: "G", provider: "P", tariffId: "t", rulesText: "r", accessible: true, spaces: 5, maxParkingMinutes: 30 } },
    { type: "Feature", geometry: { type: "LineString", coordinates: [[18.0, 59.0], [18.0, 59.2]] },
      properties: { id: "sthlm:1", city: "stockholm", vehicle: "bilar", name: "S", provider: "Q", tariffId: null, rulesText: "taxa", accessible: false, spaces: null, maxParkingMinutes: null } },
  ],
};

describe("flattenCollection", () => {
  it("derives displayPoint and attaches city ctx", () => {
    const out = flattenCollection(fc);
    const sthlm = out.find((p) => p.id === "sthlm:1")!;
    expect(sthlm.displayPoint.lat).toBeCloseTo(59.1, 5);
    expect(sthlm.displayPoint.lng).toBeCloseTo(18.0, 5);
    expect(sthlm.ctx).toEqual({ timeZone: "Europe/Stockholm", calendar: "SE" });
    expect(sthlm.geometry.type).toBe("LineString");

    const gbg = out.find((p) => p.id === "gbg:1")!;
    expect(gbg.displayPoint).toEqual({ lat: 57.68, lng: 11.92 });
    expect(gbg.accessible).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/tests/client-model.test.ts --root apps/web`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/lib/client-model.ts
import type {
  ParkingFeatureCollection, ParkingGeometry, CityId, EvalContext,
} from "@cheap-park/tariff";

export type ClientParking = {
  id: string;
  city: CityId;
  name: string;
  provider: string;
  geometry: ParkingGeometry;
  displayPoint: { lat: number; lng: number };
  tariffId: string | null;
  rulesText: string;
  accessible: boolean;
  spaces: number | null;
  maxParkingMinutes: number | null;
  ctx: EvalContext;
};

function midpoint(g: ParkingGeometry): { lat: number; lng: number } {
  if (g.type === "Point") return { lat: g.coordinates[1], lng: g.coordinates[0] };
  const pts = g.type === "LineString" ? g.coordinates : g.coordinates.flat();
  let lat = 0, lng = 0;
  for (const [x, y] of pts) { lng += x; lat += y; }
  return { lat: lat / pts.length, lng: lng / pts.length };
}

export function flattenCollection(fc: ParkingFeatureCollection): ClientParking[] {
  return fc.features.map((f) => {
    const meta = fc.cities[f.properties.city];
    return {
      id: f.properties.id,
      city: f.properties.city,
      name: f.properties.name,
      provider: f.properties.provider,
      geometry: f.geometry,
      displayPoint: midpoint(f.geometry),
      tariffId: f.properties.tariffId,
      rulesText: f.properties.rulesText,
      accessible: f.properties.accessible,
      spaces: f.properties.spaces,
      maxParkingMinutes: f.properties.maxParkingMinutes,
      ctx: { timeZone: meta.timeZone, calendar: meta.holidayCalendar },
    };
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/tests/client-model.test.ts --root apps/web`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/client-model.ts apps/web/src/tests/client-model.test.ts
git commit -m "feat(web): ClientParking model + flattenCollection"
```

---

### Task 17: Loader fetches parkings.geojson

**Files:**
- Modify: `apps/web/src/lib/data.ts`
- Test: `apps/web/src/tests/data.test.ts` (rewrite)

- [ ] **Step 1: Rewrite the test**

```ts
// apps/web/src/tests/data.test.ts
import { describe, expect, it, vi } from "vitest";
import { loadSnapshot, tariffFor } from "../lib/data.js";

const geojson = {
  type: "FeatureCollection",
  generatedAt: "2026-05-30T04:00:00Z",
  cities: { goteborg: { source: "g", timeZone: "Europe/Stockholm", holidayCalendar: "SE", center: [11.97, 57.71] } },
  features: [{
    type: "Feature", geometry: { type: "Point", coordinates: [11.97, 57.7] },
    properties: { id: "gbg:1", city: "goteborg", vehicle: "bilar", name: "T", provider: "P", tariffId: "t1", rulesText: "r", accessible: false, spaces: 5, maxParkingMinutes: 60 },
  }],
};
const tariffs = { tariffs: [{ id: "t1", name: "T1", rules: [] }] };

describe("loadSnapshot", () => {
  it("loads geojson + tariffs into a snapshot of ClientParking", async () => {
    const fetcher = vi.fn(async (url: string) =>
      new Response(JSON.stringify(url.includes("parkings.geojson") ? geojson : tariffs), { status: 200 }),
    ) as unknown as typeof fetch;
    const snap = await loadSnapshot({ basePath: "/data", fetcher });
    expect(snap.parkings).toHaveLength(1);
    expect(snap.parkings[0]!.ctx.timeZone).toBe("Europe/Stockholm");
    expect(snap.tariffs.get("t1")!.name).toBe("T1");
  });

  it("tariffFor resolves null tariffId to null", () => {
    const p = { tariffId: null } as never;
    expect(tariffFor(p, new Map())).toBe(null);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/tests/data.test.ts --root apps/web`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/lib/data.ts
import type { Tariff, TariffsSnapshot, ParkingFeatureCollection } from "@cheap-park/tariff";
import { flattenCollection, type ClientParking } from "./client-model.js";

export type Snapshot = {
  generatedAt: Date;
  sources: Record<string, string>;
  parkings: ClientParking[];
  tariffs: Map<string, Tariff>;
};

export type LoadOptions = { basePath: string; fetcher?: typeof fetch };

export async function loadSnapshot(opts: LoadOptions): Promise<Snapshot> {
  const f = opts.fetcher ?? fetch;
  const [pRes, tRes] = await Promise.all([
    f(`${opts.basePath}/parkings.geojson`),
    f(`${opts.basePath}/tariffs.json`),
  ]);
  if (!pRes.ok) throw new Error(`parkings.geojson: ${pRes.status} ${pRes.statusText}`);
  if (!tRes.ok) throw new Error(`tariffs.json: ${tRes.status} ${tRes.statusText}`);

  const fc = (await pRes.json()) as ParkingFeatureCollection;
  const tariffs = (await tRes.json()) as TariffsSnapshot;

  const sources: Record<string, string> = {};
  for (const [city, meta] of Object.entries(fc.cities)) sources[city] = meta.source;

  return {
    generatedAt: new Date(fc.generatedAt),
    sources,
    parkings: flattenCollection(fc),
    tariffs: new Map(tariffs.tariffs.map((t) => [t.id, t])),
  };
}

export function tariffFor(parking: ClientParking, tariffs: Map<string, Tariff>): Tariff | null {
  if (!parking.tariffId) return null;
  return tariffs.get(parking.tariffId) ?? null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/tests/data.test.ts --root apps/web`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/data.ts apps/web/src/tests/data.test.ts
git commit -m "feat(web): load unified parkings.geojson into ClientParking snapshot"
```

---

### Task 18: prices.ts threads ctx

**Files:**
- Modify: `apps/web/src/lib/prices.ts`
- Test: `apps/web/src/tests/prices.test.ts` (update)

- [ ] **Step 1: Update tests**

In `apps/web/src/tests/prices.test.ts`, import `EvalContext`, define `const SE = { timeZone: "Europe/Stockholm", calendar: "SE" } as const;`, and pass `SE` as the trailing arg to every `priceLabel`/`totalLabel`/`hourlyRate` call. Convert any local-time date literals to `...Z`.

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/tests/prices.test.ts --root apps/web`
Expected: FAIL — arity.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/lib/prices.ts
import { priceNow, totalCost } from "@cheap-park/tariff";
import type { Tariff, EvalContext } from "@cheap-park/tariff";

export function priceLabel(tariff: Tariff | null, now: Date, ctx: EvalContext): string {
  const rate = priceNow(tariff, now, ctx);
  if (rate === "n/a") return "N/A";
  if (rate === "free") return "Gratis";
  return `${rate} kr/h`;
}

export function totalLabel(tariff: Tariff | null, now: Date, durationMinutes: number, ctx: EvalContext): string {
  const result = totalCost(tariff, now, durationMinutes, ctx);
  if (result === "n/a") return "N/A";
  if (result.total === 0) return "Gratis";
  return `${Math.round(result.total)} kr`;
}

export function hourlyRate(tariff: Tariff | null, now: Date, ctx: EvalContext): number | null {
  const rate = priceNow(tariff, now, ctx);
  if (rate === "n/a") return null;
  if (rate === "free") return 0;
  return rate;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/tests/prices.test.ts --root apps/web`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/prices.ts apps/web/src/tests/prices.test.ts
git commit -m "feat(web): price labels take per-feature EvalContext"
```

---

### Task 19: filter.ts on ClientParking

**Files:**
- Modify: `apps/web/src/lib/filter.ts`
- Test: `apps/web/src/tests/filter.test.ts` (update)

- [ ] **Step 1: Update tests**

The current `filter.test.ts` builds `Parking` objects with `raw: { ExtraInfo }` and calls `priceNow(tariff, now)`. Update to `ClientParking`: replace `raw`-based accessibility with the `accessible` boolean field, and pass `ctx`/`now` as needed. Example helper:

```ts
import type { ClientParking } from "../lib/client-model.js";
const SE = { timeZone: "Europe/Stockholm", calendar: "SE" } as const;
function p(over: Partial<ClientParking>): ClientParking {
  return {
    id: "x", city: "goteborg", name: "n", provider: "pr",
    geometry: { type: "Point", coordinates: [11, 57] },
    displayPoint: { lat: 57, lng: 11 },
    tariffId: null, rulesText: "", accessible: false,
    spaces: null, maxParkingMinutes: null, ctx: SE, ...over,
  };
}
```

Change the accessible test to `p({ accessible: true })` vs `p({ accessible: false })` and assert the filter keeps/drops accordingly.

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/tests/filter.test.ts --root apps/web`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/lib/filter.ts
import type { Tariff } from "@cheap-park/tariff";
import { priceNow } from "@cheap-park/tariff";
import { tariffFor } from "./data.js";
import type { ClientParking } from "./client-model.js";
import type { AppState } from "./url-state.js";

export type FilterResult = { visible: ClientParking[]; dimmed: ClientParking[] };

function passesFilters(
  parking: ClientParking, tariffs: Map<string, Tariff>, state: AppState, now: Date,
): boolean {
  const tariff = tariffFor(parking, tariffs);
  const rate = priceNow(tariff, now, parking.ctx);

  if (state.filters.free && rate !== "free") return false;
  if (state.filters.accessible && !parking.accessible) return false;
  if (state.filters.longTerm) {
    const max = parking.maxParkingMinutes;
    if (max !== null && max < 360) return false;
  }
  if (state.filters.maxPricePerHour !== null) {
    if (rate === "n/a") return false;
    if (rate !== "free" && rate > state.filters.maxPricePerHour) return false;
  }
  return true;
}

export function applyFilters(
  parkings: ClientParking[], tariffs: Map<string, Tariff>, state: AppState, now: Date,
): FilterResult {
  const visible: ClientParking[] = [];
  const dimmed: ClientParking[] = [];
  for (const parking of parkings) {
    if (!passesFilters(parking, tariffs, state, now)) continue;
    const duration = state.durationMinutes;
    if (duration !== null && parking.maxParkingMinutes !== null && parking.maxParkingMinutes < duration) {
      dimmed.push(parking);
    } else {
      visible.push(parking);
    }
  }
  return { visible, dimmed };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/tests/filter.test.ts --root apps/web`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/filter.ts apps/web/src/tests/filter.test.ts
git commit -m "feat(web): filters operate on ClientParking + per-feature ctx"
```

---

### Task 20: Map source builder (computed tier/dimmed props)

**Files:**
- Create: `apps/web/src/lib/map-source.ts`
- Test: `apps/web/src/tests/map-source.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/tests/map-source.test.ts
import { describe, expect, it } from "vitest";
import { buildMapSource } from "../lib/map-source.js";
import type { ClientParking } from "../lib/client-model.js";
import type { Tariff } from "@cheap-park/tariff";

const SE = { timeZone: "Europe/Stockholm", calendar: "SE" } as const;
const t55: Tariff = { id: "t55", name: "55", rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 55 }] };
const t5: Tariff = { id: "t5", name: "5", rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 5 }] };
const tariffs = new Map([["t55", t55], ["t5", t5]]);

function cp(id: string, tariffId: string): ClientParking {
  return {
    id, city: "stockholm", name: id, provider: "p",
    geometry: { type: "Point", coordinates: [18, 59] }, displayPoint: { lat: 59, lng: 18 },
    tariffId, rulesText: "", accessible: false, spaces: null, maxParkingMinutes: null, ctx: SE,
  };
}

describe("buildMapSource", () => {
  it("emits a FeatureCollection with tier + dimmed + label props", () => {
    const visible = [cp("a", "t5"), cp("b", "t55")];
    const fc = buildMapSource(visible, [], tariffs, null, new Date("2026-05-27T11:00:00Z"));
    expect(fc.type).toBe("FeatureCollection");
    const a = fc.features.find((f) => f.properties.id === "a")!;
    const b = fc.features.find((f) => f.properties.id === "b")!;
    expect(a.properties.tier).toBe("green"); // cheapest
    expect(b.properties.tier).toBe("red");   // priciest
    expect(a.properties.dimmed).toBe(false);
    expect(a.properties.label).toBe("5 kr/h");
  });

  it("marks dimmed features", () => {
    const fc = buildMapSource([], [cp("c", "t5")], tariffs, null, new Date("2026-05-27T11:00:00Z"));
    expect(fc.features[0]!.properties.dimmed).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/tests/map-source.test.ts --root apps/web`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/lib/map-source.ts
import type { Tariff } from "@cheap-park/tariff";
import { tariffFor } from "./data.js";
import { hourlyRate, priceLabel, totalLabel } from "./prices.js";
import { tierForViewport, type Tier } from "./colors.js";
import type { ClientParking } from "./client-model.js";

export type MapFeatureProps = {
  id: string; tier: Tier; dimmed: boolean; label: string;
};
export type MapFeature = {
  type: "Feature";
  geometry: ClientParking["geometry"];
  properties: MapFeatureProps;
};
export type MapSource = { type: "FeatureCollection"; features: MapFeature[] };

export function buildMapSource(
  visible: ClientParking[],
  dimmed: ClientParking[],
  tariffs: Map<string, Tariff>,
  durationMinutes: number | null,
  now: Date,
): MapSource {
  const all = [...visible, ...dimmed];
  const dimmedIds = new Set(dimmed.map((p) => p.id));
  const rates = all.map((p) => hourlyRate(tariffFor(p, tariffs), now, p.ctx));

  return {
    type: "FeatureCollection",
    features: all.map((p, i) => {
      const tariff = tariffFor(p, tariffs);
      const label =
        durationMinutes !== null
          ? totalLabel(tariff, now, durationMinutes, p.ctx)
          : priceLabel(tariff, now, p.ctx);
      return {
        type: "Feature",
        geometry: p.geometry,
        properties: {
          id: p.id,
          tier: tierForViewport(rates, rates[i] ?? null),
          dimmed: dimmedIds.has(p.id),
          label,
        },
      };
    }),
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/tests/map-source.test.ts --root apps/web`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/map-source.ts apps/web/src/tests/map-source.test.ts
git commit -m "feat(web): map-source builder with computed tier/dimmed/label"
```

---

### Task 21: Nearest-city centering helper

**Files:**
- Modify: `apps/web/src/lib/geo.ts`
- Test: `apps/web/src/tests/geo.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/tests/geo.test.ts
import { describe, expect, it } from "vitest";
import { nearestCityCenter } from "../lib/geo.js";

const centers = {
  goteborg: [11.9685, 57.7068] as [number, number],
  stockholm: [18.0686, 59.3293] as [number, number],
};

describe("nearestCityCenter", () => {
  it("returns Gothenburg center when near Gothenburg", () => {
    expect(nearestCityCenter({ lat: 57.70, lng: 11.97 }, centers)).toEqual(centers.goteborg);
  });
  it("returns Stockholm center when near Stockholm", () => {
    expect(nearestCityCenter({ lat: 59.33, lng: 18.07 }, centers)).toEqual(centers.stockholm);
  });
  it("falls back to Gothenburg when no position", () => {
    expect(nearestCityCenter(null, centers)).toEqual(centers.goteborg);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/tests/geo.test.ts --root apps/web`
Expected: FAIL — `nearestCityCenter` not found.

- [ ] **Step 3: Implement (append to geo.ts)**

```ts
// append to apps/web/src/lib/geo.ts
export function nearestCityCenter(
  pos: { lat: number; lng: number } | null,
  centers: Record<string, [number, number]>,
): [number, number] {
  const fallback = centers["goteborg"] ?? Object.values(centers)[0]!;
  if (!pos) return fallback;
  let best = fallback;
  let bestD = Infinity;
  for (const c of Object.values(centers)) {
    const dLng = c[0] - pos.lng;
    const dLat = c[1] - pos.lat;
    const d = dLng * dLng + dLat * dLat; // squared planar distance is fine for nearest-of-two
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/tests/geo.test.ts --root apps/web`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/geo.ts apps/web/src/tests/geo.test.ts
git commit -m "feat(web): nearest-city centering helper"
```

---

### Task 22: MapView — data-driven layers + centering

**Files:**
- Modify: `apps/web/src/components/MapView.tsx`

This task has no unit test (it's React + MapLibre rendering, verified manually in Task 26). Keep the change tight and typed.

- [ ] **Step 1: Rewrite MapView to use Source/Layer**

Replace the body of `apps/web/src/components/MapView.tsx`. Key changes: props take `ClientParking`; build a runtime source via `buildMapSource`; render one `Source` with two `Layer`s (circle for points, line for lines); color by `tier` via a `match` expression; center on nearest city; handle clicks via `onClick` reading the top feature's `id`.

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Source, Layer, Marker, type MapRef, type MapLayerMouseEvent } from "react-map-gl/maplibre";
import type { StyleSpecification, ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Tariff } from "@cheap-park/tariff";
import type { ClientParking } from "../lib/client-model.js";
import { buildMapSource } from "../lib/map-source.js";
import { useGeolocation, nearestCityCenter } from "../lib/geo.js";
import "./MapView.css";

type Props = {
  visible: ClientParking[];
  dimmed: ClientParking[];
  tariffs: Map<string, Tariff>;
  durationMinutes: number | null;
  centers: Record<string, [number, number]>;
  onSelect: (parking: ClientParking) => void;
  onChangeDuration: () => void;
  onOpenFilters: () => void;
  onOpenList: () => void;
};

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap contributors</a>",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const TIER_COLOR: ExpressionSpecification = [
  "match", ["get", "tier"],
  "green", "#1a7f37",
  "yellow", "#bf8700",
  "red", "#cf222e",
  "#8c959f", // grey fallback
];

export function MapView({
  visible, dimmed, tariffs, durationMinutes, centers,
  onSelect, onChangeDuration, onOpenFilters, onOpenList,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const { state: geo, request: requestGeo } = useGeolocation();
  const [hasRequestedGeo, setHasRequestedGeo] = useState(false);
  const now = useMemo(() => new Date(), []);

  const byId = useMemo(() => {
    const m = new Map<string, ClientParking>();
    for (const p of [...visible, ...dimmed]) m.set(p.id, p);
    return m;
  }, [visible, dimmed]);

  const source = useMemo(
    () => buildMapSource(visible, dimmed, tariffs, durationMinutes, now),
    [visible, dimmed, tariffs, durationMinutes, now],
  );

  const initialCenter = useMemo(() => nearestCityCenter(null, centers), [centers]);

  useEffect(() => {
    if (!hasRequestedGeo) { requestGeo(); setHasRequestedGeo(true); }
  }, [hasRequestedGeo, requestGeo]);

  // Center on nearest city once we know the user's position.
  useEffect(() => {
    if (geo.status === "granted" && mapRef.current) {
      const c = nearestCityCenter({ lat: geo.lat, lng: geo.lng }, centers);
      mapRef.current.flyTo({ center: c, zoom: 13 });
    }
  }, [geo, centers]);

  const onMapClick = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return;
    const id = f.properties?.["id"] as string | undefined;
    if (id && byId.has(id)) onSelect(byId.get(id)!);
  };

  return (
    <div className="map-container">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: initialCenter[0], latitude: initialCenter[1], zoom: 12 }}
        mapStyle={OSM_STYLE}
        attributionControl={true}
        interactiveLayerIds={["parking-points", "parking-lines"]}
        onClick={onMapClick}
      >
        <Source id="parkings" type="geojson" data={source}>
          <Layer
            id="parking-lines"
            type="line"
            filter={["==", ["geometry-type"], "LineString"]}
            paint={{
              "line-color": TIER_COLOR,
              "line-width": 4,
              "line-opacity": ["case", ["get", "dimmed"], 0.3, 0.9],
            }}
          />
          <Layer
            id="parking-points"
            type="circle"
            filter={["==", ["geometry-type"], "Point"]}
            paint={{
              "circle-color": TIER_COLOR,
              "circle-radius": 6,
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 1.5,
              "circle-opacity": ["case", ["get", "dimmed"], 0.35, 1],
            }}
          />
        </Source>
        {geo.status === "granted" && (
          <Marker latitude={geo.lat} longitude={geo.lng} anchor="center">
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#1f6feb", border: "3px solid #fff", boxShadow: "0 0 0 4px rgba(31,111,235,0.25)" }} />
          </Marker>
        )}
      </Map>
      <div className="map-toolbar">
        <button className="map-chip" onClick={onChangeDuration}>
          {durationMinutes === null ? "Vet ej tid" : `Tid: ${Math.floor(durationMinutes / 60)} tim ${durationMinutes % 60} min`}
        </button>
        <button className="map-chip" onClick={onOpenFilters}>Filter</button>
      </div>
      <div className="map-fab-row">
        <button className="map-fab" onClick={onOpenList} aria-label="Lista">≡</button>
        <button className="map-fab" onClick={requestGeo} aria-label="Min position">◎</button>
      </div>
    </div>
  );
}
```

Note: MultiLineString features also match the LineString layer? No — `["geometry-type"]` returns `"MultiLineString"` for those. Add them by changing the line filter to:
```ts
filter={["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false]}
```
Use that match form so both line geometries render.

- [ ] **Step 2: Typecheck**

Run: `npm run build --workspace @cheap-park/web`
Expected: may fail later tasks' consumers; for now ensure MapView itself typechecks (App.tsx is updated in Task 24). If `tsc -b` errors only in App/ListView/DetailSheet, that's expected until those tasks land — proceed.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/MapView.tsx
git commit -m "feat(web): data-driven MapLibre layers + nearest-city centering"
```

---

### Task 23: DetailSheet + ListView on ClientParking

**Files:**
- Modify: `apps/web/src/components/DetailSheet.tsx`, `apps/web/src/components/ListView.tsx`

- [ ] **Step 1: Update DetailSheet**

In `apps/web/src/components/DetailSheet.tsx`:
- Change `Parking` import to `ClientParking` from `../lib/client-model.js`.
- `directionsUrl` uses `parking.displayPoint`:
  ```ts
  function directionsUrl(parking: ClientParking): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${parking.displayPoint.lat},${parking.displayPoint.lng}`;
  }
  ```
- Replace the `rulesText(parking)` helper that reads `parking.raw[...]` with `parking.rulesText` directly.
- `parking.owner` → `parking.provider`.
- Pass ctx to price labels: `priceLabel(tariff, now, parking.ctx)` and `totalLabel(tariff, now, durationMinutes, parking.ctx)`.
- `maxParkingLabel` is unchanged (uses `maxParkingMinutes`).
- For Stockholm, `spaces` is null — there's no spaces display in the current DetailSheet, so nothing to hide. (If a spaces line is added later, gate on `parking.spaces !== null`.)

- [ ] **Step 2: Update ListView**

In `apps/web/src/components/ListView.tsx`:
- Change `Parking` → `ClientParking`.
- `hourlyRate(tariffFor(a, tariffs), now)` → `hourlyRate(tariffFor(a, tariffs), now, a.ctx)` (both sort comparators).
- Price label calls take `parking.ctx`: `totalLabel(tariff, now, durationMinutes, parking.ctx)` / `priceLabel(tariff, now, parking.ctx)`.
- `parking.owner` → `parking.provider`.

- [ ] **Step 3: Typecheck**

Run: `npm run build --workspace @cheap-park/web`
Expected: only App.tsx errors remain (fixed in Task 24).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/DetailSheet.tsx apps/web/src/components/ListView.tsx
git commit -m "feat(web): DetailSheet + ListView on ClientParking (displayPoint, provider, rulesText, ctx)"
```

---

### Task 24: App.tsx wiring + stale-banner epoch guard

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Update App**

In `apps/web/src/App.tsx`:
- Change `import type { Parking } from "@cheap-park/tariff"` → `import type { ClientParking } from "./lib/client-model.js"`.
- `selected` state: `useState<ClientParking | null>(null)`.
- `isStale` guard against epoch/placeholder dates:
  ```ts
  function isStale(generatedAt: Date): boolean {
    const t = generatedAt.getTime();
    if (!Number.isFinite(t) || t <= 0) return false; // placeholder/epoch → not stale
    const ageDays = (Date.now() - t) / (24 * 3600 * 1000);
    return ageDays > STALE_DAYS;
  }
  ```
- Build a `centers` record from the snapshot and pass to MapView. Since `Snapshot` exposes `sources` but not centers, add `centers` to the `Snapshot` type (Task 17) — **correction:** include `cities` centers in the snapshot. Update `data.ts` `Snapshot` to also carry `centers: Record<string, [number, number]>` populated from `fc.cities[city].center`, and set it in `loadSnapshot`. Then in App:
  ```tsx
  <MapView
    visible={filtered.visible}
    dimmed={filtered.dimmed}
    tariffs={snapshot.tariffs}
    durationMinutes={state.durationMinutes}
    centers={snapshot.centers}
    onSelect={setSelected}
    onChangeDuration={() => setDurationOpen(true)}
    onOpenFilters={() => setFilterOpen(true)}
    onOpenList={() => setListOpen(true)}
  />
  ```
- `DetailSheet` `tariff` prop: `selected ? tariffFor(selected, snapshot.tariffs) : null` (unchanged signature).

- [ ] **Step 1b: Add centers to Snapshot (data.ts)**

Edit `apps/web/src/lib/data.ts`: add `centers: Record<string, [number, number]>` to `Snapshot`, and in `loadSnapshot` build it:
```ts
const centers: Record<string, [number, number]> = {};
for (const [city, meta] of Object.entries(fc.cities)) centers[city] = meta.center;
// return { ..., centers }
```
Add a line to `data.test.ts` asserting `snap.centers.goteborg` is defined.

- [ ] **Step 2: Full web build + tests**

Run: `npm test --workspace @cheap-park/web`
Then: `npm run build --workspace @cheap-park/web`
Expected: all web tests PASS; `tsc -b && vite build` succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/lib/data.ts apps/web/src/tests/data.test.ts
git commit -m "feat(web): wire ClientParking through App; epoch-guard stale banner; pass city centers"
```

---

### Task 25: Full workspace test + build gate

**Files:** none (verification)

- [ ] **Step 1: Run every package's tests**

Run: `npm test`
Expected: tariff, poller, web all green.

- [ ] **Step 2: Build everything**

Run: `npm run build`
Expected: all three packages build with no TypeScript errors.

- [ ] **Step 3: Commit (only if any incidental fixes were needed)**

```bash
git add -A
git commit -m "chore: green workspace test + build for multi-city"
```

---

### Task 26: Manual verification in the browser

**Files:** none (manual)

- [ ] **Step 1: Run the dev server**

Run: `npm run dev --workspace @cheap-park/web`
Open the printed localhost URL.

- [ ] **Step 2: Verify behaviors**

Confirm each:
- Map shows Gothenburg points AND Stockholm lines, colored by tier.
- Clicking a Stockholm line opens DetailSheet with street name, `taxa N` rules text, "Vägbeskrivning" link working (uses line midpoint).
- Clicking a Gothenburg point still works as before.
- Duration popup → totals update; line/point labels recompute.
- List view sorts by price; shows provider.
- Filters (free / handikapp / långtid / max-pris) behave; Stockholm has no accessible entries.
- Allow geolocation near Stockholm (or fake via devtools) → map centers on Stockholm; near Gothenburg → Gothenburg.
- No stale banner on fresh data.

- [ ] **Step 3: Note any defects**

If a behavior fails, file it as a follow-up task and fix before finishing. Otherwise proceed.

---

### Task 27: Update CLAUDE.md + README status

**Files:**
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1: Update status sections**

In `CLAUDE.md`, under "Status", note Stockholm is now live (Fas 1 multi-stad), add the LTF-Tolken data source under "Datakällor", and move the "Helgdagshantering" item out of "Nästa steg" (now implemented). Mention `STHLM_TK_APIKEY` secret next to `GBG_APPID`. In `README.md`, add Stockholm to the data sources and the `STHLM_TK_APIKEY` env var to the local-run instructions.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: Stockholm live (multi-city); holiday handling implemented"
```

---

## Self-Review Notes

- **Spec coverage:** timezone/locale (Tasks 1,3-6,16-20,23), dayClass+holidays (Tasks 2-3,8), unified GeoJSON schema (Task 6,11,13), Stockholm fetch/normalize/templates (Tasks 7-10), MultiLineString (Tasks 9,10,16,22), web model+displayPoint (Task 16,23), MapLibre coloring (Tasks 20,22), .json→.geojson migration + bootstrap (Tasks 13,14,17), per-city sanity >20% (Task 12-13), nearest-city centering (Tasks 21-22,24), Gothenburg holiday-template upgrade (see note below), totalCost optimization (Task 5), stale epoch-guard (Task 24), workflow secret (Task 15), tests throughout, docs (Task 27).
- **Gothenburg holiday-template upgrade:** the spec folds this in. It is **not** yet its own task because the existing `tariff-templates.ts` paid patterns (e.g. "7 kr/tim 8-22 alla dagar") do not currently encode "dag före helgdag" wording — they use `daysOfWeek`/all-day rules. Add **Task 11b** if, during Task 11, you find Gothenburg cost strings that reference helgdag: extend `parsePaidPattern` to emit `dayClasses`. If no such strings exist in live data, the upgrade is a no-op and the engine support (Tasks 2-5) is sufficient. Verify against live `parkings.geojson` rates in Task 14; if helgdag-referencing GBG strings exist, write the template upgrade + test before Task 25.
- **Type consistency:** `EvalContext = { timeZone, calendar }` is used identically in engine (`days.ts`) and web (`ClientParking.ctx`). `ParkingFeature`/`ParkingFeatureCollection`/`CityMeta`/`CityId`/`Vehicle` defined in Task 6, consumed in Tasks 11,13,16,17. `buildMapSource` signature matches its MapView call. `nearestCityCenter(pos, centers)` matches its two call sites.
- **Known sharp edge:** `wallClockParts` divides the local-day start in `total-cost.ts` by reconstructing midnight from decimal hour; this is correct for whole-hour rule edges (all real tariffs use whole hours). Sub-hour edges are out of scope.
