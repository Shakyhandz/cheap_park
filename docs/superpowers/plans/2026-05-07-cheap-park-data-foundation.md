# Cheap Park — Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data subsystem — tariff calculation library and a daily poller that fetches Göteborg parking data, normalizes it, and commits a JSON snapshot to the repo. After this plan, a daily-updated `parkings.json` exists in the repo even before any UI is built.

**Architecture:** npm workspaces monorepo with two packages: `packages/tariff` (pure TS library for tariff types + `priceNow()`/`totalCost()`) and `packages/poller` (Node script that calls `data.goteborg.se`, normalizes, and writes JSON to `apps/web/public/data/`). A GitHub Actions cron runs the poller daily at 04:00 UTC and commits the result.

**Tech Stack:** TypeScript, Node 20+, npm workspaces, vitest, undici (built-in `fetch`), GitHub Actions.

---

## File Structure

Files created in this plan:

- `package.json` — root, workspaces config
- `tsconfig.base.json` — shared compiler config
- `.editorconfig`
- `packages/tariff/package.json`, `tsconfig.json`, `vitest.config.ts`
- `packages/tariff/src/types.ts` — `Tariff`, `TariffRule`, `Parking`, `ParkingsSnapshot`
- `packages/tariff/src/days.ts` — weekday helpers
- `packages/tariff/src/price-now.ts` — `priceNow()`
- `packages/tariff/src/total-cost.ts` — `totalCost()`
- `packages/tariff/src/index.ts` — public exports
- `packages/tariff/tests/*.test.ts` — vitest unit tests
- `packages/poller/package.json`, `tsconfig.json`, `vitest.config.ts`
- `packages/poller/src/fetch.ts` — `fetchAllParkings()`
- `packages/poller/src/tariff-templates.ts` — `matchTariff()` regex matcher
- `packages/poller/src/normalize.ts` — API → our `Parking[]`
- `packages/poller/src/sanity.ts` — 90% threshold check
- `packages/poller/src/main.ts` — orchestrator entry point
- `packages/poller/tests/fixtures/api-sample.json` — captured API response for tests
- `packages/poller/tests/*.test.ts`
- `apps/web/public/data/parkings.json` — initial empty snapshot
- `apps/web/public/data/tariffs.json` — initial empty templates
- `.github/workflows/poll-data.yml` — daily cron

---

### Task 1: Initialize monorepo

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.editorconfig`
- Create: `apps/web/public/data/parkings.json`
- Create: `apps/web/public/data/tariffs.json`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "cheap_park",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "test": "npm test --workspaces --if-present",
    "build": "npm run build --workspaces --if-present"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "noUncheckedIndexedAccess": true
  }
}
```

- [ ] **Step 3: Create `.editorconfig`**

```
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

- [ ] **Step 4: Create initial empty data files**

Create `apps/web/public/data/parkings.json`:

```json
{
  "generatedAt": "1970-01-01T00:00:00Z",
  "source": "placeholder",
  "parkings": []
}
```

Create `apps/web/public/data/tariffs.json`:

```json
{
  "tariffs": []
}
```

- [ ] **Step 5: Install root devDependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` written, no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json .editorconfig apps/web/public/data/
git commit -m "chore: initialize monorepo with workspaces and seed data files"
```

---

### Task 2: Scaffold `packages/tariff`

**Files:**
- Create: `packages/tariff/package.json`
- Create: `packages/tariff/tsconfig.json`
- Create: `packages/tariff/vitest.config.ts`
- Create: `packages/tariff/src/index.ts` (empty for now)

- [ ] **Step 1: Create `packages/tariff/package.json`**

```json
{
  "name": "@cheap-park/tariff",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "tsc"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/tariff/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Create `packages/tariff/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Create empty `packages/tariff/src/index.ts`**

```ts
export {};
```

- [ ] **Step 5: Install workspace dependencies**

Run: `npm install`
Expected: `vitest` and `typescript` linked into `packages/tariff/node_modules/.bin/`.

- [ ] **Step 6: Verify vitest runs (no tests yet)**

Run: `npm test --workspace @cheap-park/tariff`
Expected: vitest exits with "No test files found" or similar — non-zero exit is OK here.

- [ ] **Step 7: Commit**

```bash
git add packages/tariff/
git commit -m "chore: scaffold tariff package"
```

---

### Task 3: Tariff types and days helper

**Files:**
- Create: `packages/tariff/src/types.ts`
- Create: `packages/tariff/src/days.ts`
- Create: `packages/tariff/tests/days.test.ts`

- [ ] **Step 1: Write the failing test for `days.ts`**

Create `packages/tariff/tests/days.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dayOfWeekFor, hourOf, ruleAppliesAt } from "../src/days.js";

describe("dayOfWeekFor", () => {
  it("returns 0 for Sunday", () => {
    expect(dayOfWeekFor(new Date("2026-05-10T12:00:00"))).toBe(0);
  });

  it("returns 1 for Monday", () => {
    expect(dayOfWeekFor(new Date("2026-05-11T12:00:00"))).toBe(1);
  });

  it("returns 6 for Saturday", () => {
    expect(dayOfWeekFor(new Date("2026-05-09T12:00:00"))).toBe(6);
  });
});

describe("hourOf", () => {
  it("returns integer hour at top of hour", () => {
    expect(hourOf(new Date("2026-05-07T08:00:00"))).toBe(8);
  });

  it("returns decimal hour for half past", () => {
    expect(hourOf(new Date("2026-05-07T08:30:00"))).toBe(8.5);
  });

  it("returns 0 at midnight", () => {
    expect(hourOf(new Date("2026-05-07T00:00:00"))).toBe(0);
  });
});

describe("ruleAppliesAt", () => {
  const rule = { daysOfWeek: [1, 2, 3, 4, 5], hourStart: 8, hourEnd: 18, pricePerHour: 30 };

  it("matches inside window on weekday", () => {
    expect(ruleAppliesAt(rule, new Date("2026-05-11T12:00:00"))).toBe(true);
  });

  it("does not match outside hour window", () => {
    expect(ruleAppliesAt(rule, new Date("2026-05-11T19:00:00"))).toBe(false);
  });

  it("does not match on weekend", () => {
    expect(ruleAppliesAt(rule, new Date("2026-05-09T12:00:00"))).toBe(false);
  });

  it("matches all-day rule when daysOfWeek is empty", () => {
    const allDays = { ...rule, daysOfWeek: [] };
    expect(ruleAppliesAt(allDays, new Date("2026-05-09T12:00:00"))).toBe(true);
  });

  it("hourEnd is exclusive", () => {
    expect(ruleAppliesAt(rule, new Date("2026-05-11T18:00:00"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace @cheap-park/tariff`
Expected: FAIL with "Cannot find module '../src/days.js'" or similar.

- [ ] **Step 3: Create `packages/tariff/src/types.ts`**

```ts
export type TariffRule = {
  daysOfWeek: number[];      // 0=Sun..6=Sat. Empty = all days.
  hourStart: number;          // 0..24, decimal allowed
  hourEnd: number;            // 0..24, exclusive. 24 = end of day.
  pricePerHour: number;       // SEK per hour. 0 = free.
  maxPerDay?: number | null;  // SEK cap per calendar day, if any.
};

export type Tariff = {
  id: string;
  name: string;
  rules: TariffRule[];
};

export type Parking = {
  id: string;
  name: string;
  owner: string;
  lat: number;
  lng: number;
  spaces: number;
  tariffId: string | null;
  maxParkingMinutes: number | null;
  raw: Record<string, string>;
};

export type ParkingsSnapshot = {
  generatedAt: string;
  source: string;
  parkings: Parking[];
};

export type TariffsSnapshot = {
  tariffs: Tariff[];
};
```

- [ ] **Step 4: Create `packages/tariff/src/days.ts`**

```ts
import type { TariffRule } from "./types.js";

export function dayOfWeekFor(date: Date): number {
  return date.getDay();
}

export function hourOf(date: Date): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

export function ruleAppliesAt(rule: TariffRule, at: Date): boolean {
  const dow = dayOfWeekFor(at);
  const hour = hourOf(at);
  const dayMatches = rule.daysOfWeek.length === 0 || rule.daysOfWeek.includes(dow);
  const hourMatches = hour >= rule.hourStart && hour < rule.hourEnd;
  return dayMatches && hourMatches;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test --workspace @cheap-park/tariff`
Expected: 9 tests pass.

- [ ] **Step 6: Update `packages/tariff/src/index.ts`**

```ts
export * from "./types.js";
export { dayOfWeekFor, hourOf, ruleAppliesAt } from "./days.js";
```

- [ ] **Step 7: Commit**

```bash
git add packages/tariff/
git commit -m "feat(tariff): add types and weekday/hour helpers"
```

---

### Task 4: Implement `priceNow()`

**Files:**
- Create: `packages/tariff/src/price-now.ts`
- Create: `packages/tariff/tests/price-now.test.ts`
- Modify: `packages/tariff/src/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/tariff/tests/price-now.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { priceNow } from "../src/price-now.js";
import type { Tariff } from "../src/types.js";

const weekdayPaidEvening: Tariff = {
  id: "test-A",
  name: "Centrum",
  rules: [
    { daysOfWeek: [1, 2, 3, 4, 5], hourStart: 9, hourEnd: 18, pricePerHour: 35 },
    { daysOfWeek: [1, 2, 3, 4, 5], hourStart: 18, hourEnd: 24, pricePerHour: 0 },
  ],
};

const allDayFree: Tariff = {
  id: "test-free",
  name: "Förort",
  rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }],
};

describe("priceNow", () => {
  it("returns hourly rate inside paid window", () => {
    expect(priceNow(weekdayPaidEvening, new Date("2026-05-11T14:00:00"))).toBe(35);
  });

  it("returns 'free' when active rule is 0 kr/h", () => {
    expect(priceNow(weekdayPaidEvening, new Date("2026-05-11T20:00:00"))).toBe("free");
  });

  it("returns 'free' on weekend (no rule applies)", () => {
    expect(priceNow(weekdayPaidEvening, new Date("2026-05-10T14:00:00"))).toBe("free");
  });

  it("returns 'n/a' when tariff is null", () => {
    expect(priceNow(null, new Date("2026-05-11T14:00:00"))).toBe("n/a");
  });

  it("matches all-days rule any day", () => {
    expect(priceNow(allDayFree, new Date("2026-05-09T03:00:00"))).toBe("free");
  });

  it("returns first matching rule when multiple match", () => {
    const overlap: Tariff = {
      id: "overlap",
      name: "Test",
      rules: [
        { daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 20 },
        { daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 99 },
      ],
    };
    expect(priceNow(overlap, new Date("2026-05-11T14:00:00"))).toBe(20);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace @cheap-park/tariff`
Expected: FAIL with "Cannot find module '../src/price-now.js'".

- [ ] **Step 3: Implement `priceNow`**

Create `packages/tariff/src/price-now.ts`:

```ts
import { ruleAppliesAt } from "./days.js";
import type { Tariff } from "./types.js";

export type PriceNow = number | "free" | "n/a";

export function priceNow(tariff: Tariff | null, now: Date): PriceNow {
  if (!tariff) return "n/a";
  for (const rule of tariff.rules) {
    if (ruleAppliesAt(rule, now)) {
      return rule.pricePerHour === 0 ? "free" : rule.pricePerHour;
    }
  }
  return "free";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace @cheap-park/tariff`
Expected: all tests pass (15 total: 9 existing + 6 new).

- [ ] **Step 5: Re-export from index**

Update `packages/tariff/src/index.ts`:

```ts
export * from "./types.js";
export { dayOfWeekFor, hourOf, ruleAppliesAt } from "./days.js";
export { priceNow, type PriceNow } from "./price-now.js";
```

- [ ] **Step 6: Commit**

```bash
git add packages/tariff/
git commit -m "feat(tariff): implement priceNow"
```

---

### Task 5: Implement `totalCost()`

**Files:**
- Create: `packages/tariff/src/total-cost.ts`
- Create: `packages/tariff/tests/total-cost.test.ts`
- Modify: `packages/tariff/src/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/tariff/tests/total-cost.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { totalCost } from "../src/total-cost.js";
import type { Tariff } from "../src/types.js";

const weekdayPaidEvening: Tariff = {
  id: "test-A",
  name: "Centrum",
  rules: [
    { daysOfWeek: [1, 2, 3, 4, 5], hourStart: 9, hourEnd: 18, pricePerHour: 35 },
    { daysOfWeek: [1, 2, 3, 4, 5], hourStart: 18, hourEnd: 24, pricePerHour: 0 },
  ],
};

const flatRate: Tariff = {
  id: "flat",
  name: "Flat",
  rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 20 }],
};

const withDailyCap: Tariff = {
  id: "capped",
  name: "Capped",
  rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 20, maxPerDay: 100 }],
};

describe("totalCost", () => {
  it("returns 'n/a' when tariff is null", () => {
    expect(totalCost(null, new Date("2026-05-11T14:00:00"), 60)).toBe("n/a");
  });

  it("flat rate * duration", () => {
    const result = totalCost(flatRate, new Date("2026-05-11T14:00:00"), 60);
    if (result === "n/a") throw new Error("expected breakdown");
    expect(result.total).toBe(20);
    expect(result.breakdown.length).toBe(1);
  });

  it("segments across rule boundary (paid then free after 18:00)", () => {
    // Start 16:00, park 4h → 2h @ 35 (16-18) + 2h @ 0 (18-20) = 70 kr
    const result = totalCost(weekdayPaidEvening, new Date("2026-05-11T16:00:00"), 240);
    if (result === "n/a") throw new Error("expected breakdown");
    expect(result.total).toBe(70);
    expect(result.breakdown.length).toBe(2);
    expect(result.breakdown[0]?.rate).toBe(35);
    expect(result.breakdown[1]?.rate).toBe(0);
  });

  it("starts in free window, no charge", () => {
    const result = totalCost(weekdayPaidEvening, new Date("2026-05-11T19:00:00"), 60);
    if (result === "n/a") throw new Error("expected breakdown");
    expect(result.total).toBe(0);
  });

  it("crosses midnight to next day", () => {
    // Start 23:30 Mon, park 60 min → ends 00:30 Tue. Paid evening rule ends at 24, then no rule → free.
    // 30 min @ 0 (18-24 free rule on Mon) + 30 min @ 0 (after midnight, no rule = free) = 0 kr
    const result = totalCost(weekdayPaidEvening, new Date("2026-05-11T23:30:00"), 60);
    if (result === "n/a") throw new Error("expected breakdown");
    expect(result.total).toBe(0);
  });

  it("applies daily cap when total would exceed", () => {
    // Flat 20 kr/h for 8h = 160 kr, but cap = 100
    const result = totalCost(withDailyCap, new Date("2026-05-11T08:00:00"), 480);
    if (result === "n/a") throw new Error("expected breakdown");
    expect(result.total).toBe(100);
  });

  it("does not apply cap when total is below", () => {
    const result = totalCost(withDailyCap, new Date("2026-05-11T08:00:00"), 60);
    if (result === "n/a") throw new Error("expected breakdown");
    expect(result.total).toBe(20);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace @cheap-park/tariff`
Expected: FAIL with "Cannot find module '../src/total-cost.js'".

- [ ] **Step 3: Implement `totalCost`**

Create `packages/tariff/src/total-cost.ts`:

```ts
import { ruleAppliesAt } from "./days.js";
import type { Tariff, TariffRule } from "./types.js";

export type Segment = { from: Date; to: Date; rate: number };

export type TotalCostResult = { total: number; breakdown: Segment[] } | "n/a";

const MS_PER_HOUR = 3600 * 1000;

function findRule(tariff: Tariff, at: Date): TariffRule | null {
  for (const rule of tariff.rules) {
    if (ruleAppliesAt(rule, at)) return rule;
  }
  return null;
}

function nextBoundary(tariff: Tariff, from: Date, hardEnd: Date): Date {
  // Find the next time the active rule changes, capped at hardEnd.
  // Strategy: step minute-by-minute until rule changes. Coarse but correct.
  // For MVP: step 1 minute at a time. At ≤24 h durations, 1440 iterations max.
  const startRule = findRule(tariff, from);
  let cursor = new Date(from.getTime() + 60_000);
  while (cursor < hardEnd) {
    const ruleHere = findRule(tariff, cursor);
    if (ruleHere !== startRule) return cursor;
    cursor = new Date(cursor.getTime() + 60_000);
  }
  return hardEnd;
}

export function totalCost(
  tariff: Tariff | null,
  fromNow: Date,
  durationMinutes: number,
): TotalCostResult {
  if (!tariff) return "n/a";
  const end = new Date(fromNow.getTime() + durationMinutes * 60_000);
  const segments: Segment[] = [];
  let cursor = fromNow;

  while (cursor < end) {
    const rule = findRule(tariff, cursor);
    const segEnd = nextBoundary(tariff, cursor, end);
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace @cheap-park/tariff`
Expected: all 22 tests pass.

- [ ] **Step 5: Re-export from index**

Update `packages/tariff/src/index.ts`:

```ts
export * from "./types.js";
export { dayOfWeekFor, hourOf, ruleAppliesAt } from "./days.js";
export { priceNow, type PriceNow } from "./price-now.js";
export { totalCost, type TotalCostResult, type Segment } from "./total-cost.js";
```

- [ ] **Step 6: Commit**

```bash
git add packages/tariff/
git commit -m "feat(tariff): implement totalCost with rule segmentation and daily cap"
```

---

### Task 6: Scaffold `packages/poller`

**Files:**
- Create: `packages/poller/package.json`
- Create: `packages/poller/tsconfig.json`
- Create: `packages/poller/vitest.config.ts`
- Create: `packages/poller/src/index.ts`

- [ ] **Step 1: Create `packages/poller/package.json`**

```json
{
  "name": "@cheap-park/poller",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "tsc",
    "poll": "tsx src/main.ts"
  },
  "dependencies": {
    "@cheap-park/tariff": "*"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.20.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/poller/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "types": ["node"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Create `packages/poller/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Create `packages/poller/src/index.ts`**

```ts
export {};
```

- [ ] **Step 5: Install workspace dependencies**

Run: `npm install`
Expected: tsx, vitest, @types/node installed; `@cheap-park/tariff` symlinked.

- [ ] **Step 6: Commit**

```bash
git add packages/poller/
git commit -m "chore: scaffold poller package"
```

---

### Task 7: Implement `fetch.ts`

**Files:**
- Create: `packages/poller/src/fetch.ts`
- Create: `packages/poller/tests/fixtures/api-toll-sample.json`
- Create: `packages/poller/tests/fetch.test.ts`

- [ ] **Step 1: Create fixture file**

Create `packages/poller/tests/fixtures/api-toll-sample.json` with a small valid response shape:

```json
[
  {
    "Id": "P-1001",
    "Name": "Test Street 1",
    "Owner": "Parkering Göteborg",
    "ParkingSpaces": 5,
    "FreeSpaces": 0,
    "ParkingCost": "9-18 vard 35 kr/tim",
    "ParkingCharge": "35",
    "CurrentParkingCost": 35,
    "MaxParkingTime": "240",
    "MaxParkingTimeLimitation": "Mån-Fre 09-18",
    "ExtraInfo": "",
    "Lat": 57.7042,
    "Long": 11.9678,
    "WKT": "POINT(11.9678 57.7042)"
  },
  {
    "Id": "P-1002",
    "Name": "Test Street 2",
    "Owner": "Parkering Göteborg",
    "ParkingSpaces": 3,
    "ParkingCost": "Avgiftsfri 30 min",
    "MaxParkingTime": "30",
    "Lat": 57.7050,
    "Long": 11.9680
  }
]
```

- [ ] **Step 2: Write the failing test**

Create `packages/poller/tests/fetch.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchAllParkings } from "../src/fetch.js";
import sample from "./fixtures/api-toll-sample.json";

describe("fetchAllParkings", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("PublicTollParkings")) {
        return new Response(JSON.stringify(sample), { status: 200 });
      }
      if (u.includes("PublicTimeParkings")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      throw new Error(`unexpected url: ${u}`);
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns combined toll + time parkings", async () => {
    const result = await fetchAllParkings("test-appid");
    expect(result.toll.length).toBe(2);
    expect(result.time.length).toBe(0);
  });

  it("includes APPID in the request URL", async () => {
    await fetchAllParkings("MY-APPID");
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const urls = calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("MY-APPID"))).toBe(true);
  });

  it("throws on non-200 response", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("error", { status: 500 }),
    ) as typeof fetch;
    await expect(fetchAllParkings("test")).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test --workspace @cheap-park/poller`
Expected: FAIL with "Cannot find module '../src/fetch.js'".

- [ ] **Step 4: Implement `fetch.ts`**

Create `packages/poller/src/fetch.ts`:

```ts
const BASE = "https://data.goteborg.se/ParkingService/v2.1";
const FORMAT = "json";

// Bounding box covering all of Göteborg with margin.
const BBOX_LAT = 57.75;
const BBOX_LONG = 11.95;
const BBOX_RADIUS_M = 20000;

export type RawParking = Record<string, unknown> & {
  Id: string;
  Name?: string;
  Owner?: string;
  Lat?: number;
  Long?: number;
};

async function fetchEndpoint(path: string, appId: string): Promise<RawParking[]> {
  const url = `${BASE}/${path}/${encodeURIComponent(appId)}?latitude=${BBOX_LAT}&longitude=${BBOX_LONG}&radius=${BBOX_RADIUS_M}&format=${FORMAT}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as RawParking[];
}

export async function fetchAllParkings(appId: string): Promise<{
  toll: RawParking[];
  time: RawParking[];
}> {
  const [toll, time] = await Promise.all([
    fetchEndpoint("PublicTollParkings", appId),
    fetchEndpoint("PublicTimeParkings", appId),
  ]);
  return { toll, time };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test --workspace @cheap-park/poller`
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/poller/
git commit -m "feat(poller): fetch all public parkings from data.goteborg.se"
```

---

### Task 8: Implement `tariff-templates.ts`

**Files:**
- Create: `packages/poller/src/tariff-templates.ts`
- Create: `packages/poller/tests/tariff-templates.test.ts`

This is the seed of tariff matching. Start with a few hand-coded templates covering Göteborg's most common patterns. The calibration check (out of scope here, in plan 2) will tell us when we need more.

- [ ] **Step 1: Write the failing tests**

Create `packages/poller/tests/tariff-templates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { matchTariff, KNOWN_TARIFFS } from "../src/tariff-templates.js";

describe("matchTariff", () => {
  it("matches free 30-min pocket from MaxParkingTime", () => {
    const result = matchTariff({ ParkingCost: "Avgiftsfri 30 min", MaxParkingTime: "30" });
    expect(result).toBe("free-30min");
  });

  it("matches free 10-min pocket", () => {
    const result = matchTariff({ ParkingCost: "Avgiftsfri 10 min", MaxParkingTime: "10" });
    expect(result).toBe("free-10min");
  });

  it("returns null on unknown pattern", () => {
    const result = matchTariff({ ParkingCost: "Esoteriskt nytt format" });
    expect(result).toBeNull();
  });

  it("returns null on missing ParkingCost", () => {
    expect(matchTariff({})).toBeNull();
  });
});

describe("KNOWN_TARIFFS", () => {
  it("includes free-30min template", () => {
    const t = KNOWN_TARIFFS.find((x) => x.id === "free-30min");
    expect(t).toBeDefined();
    expect(t!.rules[0]!.pricePerHour).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace @cheap-park/poller`
Expected: FAIL "Cannot find module '../src/tariff-templates.js'".

- [ ] **Step 3: Implement `tariff-templates.ts`**

Create `packages/poller/src/tariff-templates.ts`:

```ts
import type { Tariff } from "@cheap-park/tariff";

export const KNOWN_TARIFFS: Tariff[] = [
  {
    id: "free-10min",
    name: "Avgiftsfri 10 min",
    rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }],
  },
  {
    id: "free-15min",
    name: "Avgiftsfri 15 min",
    rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }],
  },
  {
    id: "free-30min",
    name: "Avgiftsfri 30 min",
    rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }],
  },
];

type RawShape = { ParkingCost?: unknown; MaxParkingTime?: unknown };

export function matchTariff(raw: RawShape): string | null {
  const cost = typeof raw.ParkingCost === "string" ? raw.ParkingCost.toLowerCase() : "";
  const maxStr = typeof raw.MaxParkingTime === "string" ? raw.MaxParkingTime : "";

  if (!cost) return null;

  if (cost.includes("avgiftsfri")) {
    if (maxStr === "10") return "free-10min";
    if (maxStr === "15") return "free-15min";
    if (maxStr === "30") return "free-30min";
  }

  // TODO: add paid-zone templates when we capture real fixtures from the live API.
  // The plan for this lives in spec § "Tariff-täckning".

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace @cheap-park/poller`
Expected: all tests pass (3 fetch + 5 templates = 8).

- [ ] **Step 5: Commit**

```bash
git add packages/poller/
git commit -m "feat(poller): seed tariff templates with free-N-min patterns"
```

---

### Task 9: Implement `normalize.ts`

**Files:**
- Create: `packages/poller/src/normalize.ts`
- Create: `packages/poller/tests/normalize.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/poller/tests/normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalize } from "../src/normalize.js";
import sample from "./fixtures/api-toll-sample.json";

describe("normalize", () => {
  it("produces one parking per input record", () => {
    const result = normalize({ toll: sample, time: [] });
    expect(result.length).toBe(2);
  });

  it("populates id, name, lat/lng", () => {
    const result = normalize({ toll: sample, time: [] });
    const p = result.find((x) => x.id === "P-1001");
    expect(p).toBeDefined();
    expect(p!.name).toBe("Test Street 1");
    expect(p!.lat).toBeCloseTo(57.7042);
    expect(p!.lng).toBeCloseTo(11.9678);
  });

  it("matches tariff for the 30-min pocket", () => {
    const result = normalize({ toll: [], time: sample });
    const p = result.find((x) => x.id === "P-1002");
    expect(p).toBeDefined();
    expect(p!.tariffId).toBe("free-30min");
    expect(p!.maxParkingMinutes).toBe(30);
  });

  it("filters out records missing coordinates", () => {
    const broken = [{ Id: "X", Name: "Broken" }];
    const result = normalize({ toll: broken as never, time: [] });
    expect(result.length).toBe(0);
  });

  it("dedupes on id (toll wins over time)", () => {
    const dup = [{ Id: "P-1001", Name: "Dup", Lat: 57.7, Long: 11.9 }];
    const result = normalize({ toll: sample, time: dup as never });
    expect(result.filter((x) => x.id === "P-1001").length).toBe(1);
  });

  it("preserves raw fields", () => {
    const result = normalize({ toll: sample, time: [] });
    const p = result.find((x) => x.id === "P-1001")!;
    expect(p.raw["ParkingCost"]).toContain("35 kr");
  });

  it("converts MaxParkingTime to number of minutes", () => {
    const result = normalize({ toll: sample, time: [] });
    const p = result.find((x) => x.id === "P-1001")!;
    expect(p.maxParkingMinutes).toBe(240);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace @cheap-park/poller`
Expected: FAIL.

- [ ] **Step 3: Implement `normalize.ts`**

Create `packages/poller/src/normalize.ts`:

```ts
import type { Parking } from "@cheap-park/tariff";
import type { RawParking } from "./fetch.js";
import { matchTariff } from "./tariff-templates.js";

const RAW_FIELDS_TO_KEEP = [
  "ParkingCost",
  "ParkingCharge",
  "MaxParkingTime",
  "MaxParkingTimeLimitation",
  "ExtraInfo",
];

function asString(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toParking(raw: RawParking): Parking | null {
  const lat = asNumber(raw.Lat);
  const lng = asNumber(raw.Long);
  if (lat == null || lng == null) return null;

  const id = asString(raw.Id);
  if (!id) return null;

  const rawSubset: Record<string, string> = {};
  for (const key of RAW_FIELDS_TO_KEEP) {
    const v = raw[key];
    if (v != null) rawSubset[key] = asString(v);
  }

  // matchTariff expects ParkingCost+MaxParkingTime as strings
  const tariffId = matchTariff({
    ParkingCost: rawSubset["ParkingCost"],
    MaxParkingTime: rawSubset["MaxParkingTime"],
  });

  return {
    id,
    name: asString(raw.Name),
    owner: asString(raw.Owner),
    lat,
    lng,
    spaces: asNumber(raw["ParkingSpaces"]) ?? 0,
    tariffId,
    maxParkingMinutes: asNumber(rawSubset["MaxParkingTime"]),
    raw: rawSubset,
  };
}

export function normalize(input: { toll: RawParking[]; time: RawParking[] }): Parking[] {
  const seen = new Set<string>();
  const out: Parking[] = [];

  // Toll first so its records win on dedup.
  for (const r of [...input.toll, ...input.time]) {
    const p = toParking(r);
    if (!p) continue;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }

  return out.sort((a, b) => a.id.localeCompare(b.id));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace @cheap-park/poller`
Expected: all tests pass. Note: the test "matches tariff for the 30-min pocket" requires normalize to coerce numeric `MaxParkingTime` to string for `matchTariff` — confirm by inspecting test output if it fails. If matching fails on the fixture, update the fixture so `MaxParkingTime` is the string `"30"`.

- [ ] **Step 5: Commit**

```bash
git add packages/poller/
git commit -m "feat(poller): normalize raw API data to Parking[]"
```

---

### Task 10: Implement `sanity.ts`

**Files:**
- Create: `packages/poller/src/sanity.ts`
- Create: `packages/poller/tests/sanity.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/poller/tests/sanity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sanityCheck } from "../src/sanity.js";

describe("sanityCheck", () => {
  it("passes when count is equal", () => {
    expect(sanityCheck({ newCount: 100, lastCount: 100 })).toEqual({ ok: true });
  });

  it("passes when count grows", () => {
    expect(sanityCheck({ newCount: 110, lastCount: 100 })).toEqual({ ok: true });
  });

  it("passes when drop is exactly 10%", () => {
    expect(sanityCheck({ newCount: 90, lastCount: 100 })).toEqual({ ok: true });
  });

  it("fails when drop exceeds 10%", () => {
    const result = sanityCheck({ newCount: 89, lastCount: 100 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/dropped/i);
  });

  it("passes any value when lastCount is 0 (first run)", () => {
    expect(sanityCheck({ newCount: 5000, lastCount: 0 })).toEqual({ ok: true });
  });

  it("fails when newCount is 0 and lastCount is non-zero", () => {
    const result = sanityCheck({ newCount: 0, lastCount: 100 });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace @cheap-park/poller`
Expected: FAIL.

- [ ] **Step 3: Implement `sanity.ts`**

Create `packages/poller/src/sanity.ts`:

```ts
const MIN_RATIO = 0.9;

export type SanityResult = { ok: true } | { ok: false; reason: string };

export function sanityCheck(args: { newCount: number; lastCount: number }): SanityResult {
  const { newCount, lastCount } = args;
  if (lastCount === 0) return { ok: true };
  const ratio = newCount / lastCount;
  if (ratio < MIN_RATIO) {
    return {
      ok: false,
      reason: `count dropped to ${newCount} from ${lastCount} (ratio ${ratio.toFixed(2)} < ${MIN_RATIO})`,
    };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace @cheap-park/poller`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/poller/
git commit -m "feat(poller): add sanity check with 90% threshold"
```

---

### Task 11: Implement `main.ts` orchestrator

**Files:**
- Create: `packages/poller/src/main.ts`
- Create: `packages/poller/tests/main.test.ts`

The orchestrator is integration code: pulls inputs, calls the pure functions, writes JSON. Tests use a fake `runtime` to inject fetch + filesystem mocks.

- [ ] **Step 1: Write the failing test**

Create `packages/poller/tests/main.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { runPoll } from "../src/main.js";
import sample from "./fixtures/api-toll-sample.json";

describe("runPoll", () => {
  it("writes parkings.json with normalized data on success", async () => {
    const writes = new Map<string, string>();
    const result = await runPoll({
      appId: "test",
      readPrevious: async () => ({ parkings: [] }),
      writeJson: async (path, data) => {
        writes.set(path, JSON.stringify(data));
      },
      fetcher: async () => ({ toll: sample as never, time: [] }),
    });
    expect(result.committed).toBe(true);
    expect(writes.has("apps/web/public/data/parkings.json")).toBe(true);
    expect(writes.has("apps/web/public/data/tariffs.json")).toBe(true);
  });

  it("aborts without writing when sanity check fails", async () => {
    const writes = new Map<string, string>();
    const result = await runPoll({
      appId: "test",
      readPrevious: async () => ({ parkings: new Array(100).fill({ id: "x" }) }),
      writeJson: async (path, data) => {
        writes.set(path, JSON.stringify(data));
      },
      fetcher: async () => ({ toll: sample as never, time: [] }),
    });
    expect(result.committed).toBe(false);
    expect(writes.size).toBe(0);
    expect(result.reason).toMatch(/dropped/);
  });

  it("propagates fetcher errors", async () => {
    await expect(
      runPoll({
        appId: "test",
        readPrevious: async () => ({ parkings: [] }),
        writeJson: async () => {},
        fetcher: async () => {
          throw new Error("network down");
        },
      }),
    ).rejects.toThrow("network down");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace @cheap-park/poller`
Expected: FAIL.

- [ ] **Step 3: Implement `main.ts`**

Create `packages/poller/src/main.ts`:

```ts
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Parking, ParkingsSnapshot, TariffsSnapshot } from "@cheap-park/tariff";
import { fetchAllParkings, type RawParking } from "./fetch.js";
import { normalize } from "./normalize.js";
import { sanityCheck } from "./sanity.js";
import { KNOWN_TARIFFS } from "./tariff-templates.js";

const PARKINGS_PATH = "apps/web/public/data/parkings.json";
const TARIFFS_PATH = "apps/web/public/data/tariffs.json";
const SOURCE = "data.goteborg.se ParkingService v2.1";

export type RunOptions = {
  appId: string;
  readPrevious: () => Promise<{ parkings: { id: string }[] }>;
  writeJson: (path: string, data: unknown) => Promise<void>;
  fetcher: (appId: string) => Promise<{ toll: RawParking[]; time: RawParking[] }>;
};

export type RunResult =
  | { committed: true; count: number }
  | { committed: false; reason: string };

export async function runPoll(opts: RunOptions): Promise<RunResult> {
  const raw = await opts.fetcher(opts.appId);
  const parkings: Parking[] = normalize(raw);

  const previous = await opts.readPrevious();
  const sanity = sanityCheck({ newCount: parkings.length, lastCount: previous.parkings.length });
  if (!sanity.ok) return { committed: false, reason: sanity.reason };

  const usedTariffIds = new Set(parkings.map((p) => p.tariffId).filter((x): x is string => x !== null));
  const usedTariffs = KNOWN_TARIFFS.filter((t) => usedTariffIds.has(t.id));

  const snapshot: ParkingsSnapshot = {
    generatedAt: new Date().toISOString(),
    source: SOURCE,
    parkings,
  };
  const tariffs: TariffsSnapshot = { tariffs: usedTariffs };

  await opts.writeJson(PARKINGS_PATH, snapshot);
  await opts.writeJson(TARIFFS_PATH, tariffs);

  return { committed: true, count: parkings.length };
}

async function readPreviousFromDisk(): Promise<{ parkings: { id: string }[] }> {
  try {
    const text = await readFile(PARKINGS_PATH, "utf8");
    return JSON.parse(text);
  } catch {
    return { parkings: [] };
  }
}

async function writeJsonToDisk(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

import { fileURLToPath } from "node:url";

const isMain =
  typeof process.argv[1] === "string" && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const appId = process.env["GBG_APPID"];
  if (!appId) {
    console.error("GBG_APPID env var is required");
    process.exit(1);
  }

  runPoll({
    appId,
    readPrevious: readPreviousFromDisk,
    writeJson: writeJsonToDisk,
    fetcher: fetchAllParkings,
  })
    .then((result) => {
      if (result.committed) {
        console.log(`OK: wrote ${result.count} parkings`);
      } else {
        console.error(`ABORT: ${result.reason}`);
        process.exit(2);
      }
    })
    .catch((err) => {
      console.error("FAIL:", err);
      process.exit(1);
    });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace @cheap-park/poller`
Expected: all tests pass.

- [ ] **Step 5: Smoke test against real API (optional but recommended)**

Get an APPID from `https://data.goteborg.se/Account/Register.aspx` and store in your local environment.

PowerShell:
```powershell
$env:GBG_APPID = "your-appid-here"
npm run poll --workspace @cheap-park/poller
```

Expected: `OK: wrote N parkings` printed; `apps/web/public/data/parkings.json` updated with real data.

If this fails, the test suite is still passing — the smoke step is informational, not blocking. Document any failures (e.g., API rate limits, schema drift) before continuing.

- [ ] **Step 6: Commit**

```bash
git add packages/poller/
git commit -m "feat(poller): orchestrator that polls, normalizes, and writes JSON"
```

If you ran the smoke test and the data files updated, also commit them:

```bash
git add apps/web/public/data/
git commit -m "chore(data): first real snapshot from data.goteborg.se"
```

---

### Task 12: GitHub Actions cron workflow

**Files:**
- Create: `.github/workflows/poll-data.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/poll-data.yml`:

```yaml
name: Daily parking data poll

on:
  schedule:
    - cron: "0 4 * * *"  # 04:00 UTC every day
  workflow_dispatch:      # manual trigger from GitHub UI

permissions:
  contents: write

jobs:
  poll:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run poller
        env:
          GBG_APPID: ${{ secrets.GBG_APPID }}
        run: npm run poll --workspace @cheap-park/poller

      - name: Commit and push if data changed
        run: |
          git config user.name "cheap-park-bot"
          git config user.email "noreply@cheap-park.local"
          if [[ -n "$(git status --porcelain apps/web/public/data/)" ]]; then
            git add apps/web/public/data/
            git commit -m "chore(data): daily snapshot $(date -u +%Y-%m-%d)"
            git push
          else
            echo "No data changes — nothing to commit."
          fi
```

- [ ] **Step 2: Add a README note for the secret**

Create `packages/poller/README.md`:

```markdown
# @cheap-park/poller

Daily poller that fetches Göteborg parking data and writes a JSON snapshot
to `apps/web/public/data/`.

## Local development

1. Get an APPID from https://data.goteborg.se/Account/Register.aspx
2. Set the env var: `$env:GBG_APPID = "..."`
3. Run: `npm run poll --workspace @cheap-park/poller`

## CI

The poller runs daily at 04:00 UTC via `.github/workflows/poll-data.yml`.
The workflow needs a repository secret `GBG_APPID` to be configured at:
Settings → Secrets and variables → Actions → New repository secret.

If the API returns fewer than 90% of the previously-recorded parking count,
the run aborts and no commit is made — yesterday's snapshot remains live.
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/poll-data.yml packages/poller/README.md
git commit -m "ci: daily cron to poll Göteborg parking data and commit snapshot"
```

- [ ] **Step 4: Manual verification (after pushing to GitHub)**

After pushing to GitHub:

1. In the repo settings → Secrets, add `GBG_APPID`.
2. In the Actions tab, find "Daily parking data poll" → "Run workflow" → main → Run.
3. Watch the run; expected: green check, a new commit appears in main with the daily snapshot.

This step is verification, not implementation — it's the deploy-and-observe loop. If anything fails here, fix the workflow and push a new commit; this isn't part of TDD.

---

## Plan complete

After Task 12, the data foundation is operational:

- `apps/web/public/data/parkings.json` contains real Göteborg parking data
- The cron updates it daily, gated by sanity check
- `packages/tariff` provides `priceNow()` and `totalCost()` ready for the web app to consume

Next plan covers building the web app on top of this contract.
