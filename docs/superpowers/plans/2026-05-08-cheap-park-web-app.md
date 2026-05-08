# Cheap Park — Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the mobile-first PWA web app that consumes the data foundation (parkings.json + tariffs.json), shows parking prices on a map of Göteborg, and lets users find the cheapest parking given a duration.

**Architecture:** Vite + React + TypeScript SPA in `apps/web/`. MapLibre GL JS renders an OpenStreetMap-tiled map with price-labeled pins (color-coded by viewport-relative tertile). Pure-function helpers in `src/lib/` (TDD) consume the `@cheap-park/tariff` package for price calculations. UI state (duration, filters) lives in URL query params. Hosted on GitHub Pages via an Actions workflow.

**Tech Stack:** Vite 5+, React 18, TypeScript 5.6+, MapLibre GL JS, react-map-gl/maplibre, vite-plugin-pwa, vitest (already in repo), GitHub Actions for deploy.

---

## File Structure

Files created in this plan:

- `apps/web/package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `.gitignore`
- `apps/web/src/main.tsx` — entry point
- `apps/web/src/App.tsx` — root component, routing/state orchestration
- `apps/web/src/styles.css` — global styles (CSS variables, reset, base typography)
- `apps/web/src/components/`:
  - `ParkingDuration.tsx` + `.css` — duration popup modal
  - `MapView.tsx` + `.css` — map + pins
  - `DetailSheet.tsx` + `.css` — bottom sheet on pin tap
  - `FilterSheet.tsx` + `.css` — filter modal
  - `ListView.tsx` + `.css` — list alternative to map
- `apps/web/src/lib/`:
  - `data.ts` — fetch parkings.json + tariffs.json, build tariff lookup
  - `colors.ts` — viewport-relative price tier
  - `filter.ts` — apply filters; query↔state
  - `url-state.ts` — encode/decode duration + filter state to URLSearchParams
  - `geo.ts` — geolocation with fallback
  - `prices.ts` — wrap `priceNow`/`totalCost` from tariff lib for the UI's needs
- `apps/web/src/tests/` — TDD tests for each lib file
- `apps/web/public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — PWA icons (placeholder generated)
- `.github/workflows/deploy-web.yml` — GitHub Pages deploy workflow

Files modified:

- `package.json` (root) — workspace globs already include `apps/*`; no change needed
- `CLAUDE.md` — append a "Deployment" section noting GitHub Pages URL

---

### Task 1: Scaffold `apps/web` with Vite + React + TS

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/.gitignore`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/styles.css`
- Create: `apps/web/src/vite-env.d.ts`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@cheap-park/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@cheap-park/tariff": "*",
    "maplibre-gl": "^4.7.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-map-gl": "^7.1.7"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "typescript": "^5.6.0",
    "vite": "^5.4.10",
    "vite-plugin-pwa": "^0.20.5",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client"]
  },
  "include": ["src/**/*"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create `apps/web/tsconfig.node.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create `apps/web/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/cheap_park/",
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    port: 5173,
  },
});
```

The `base: "/cheap_park/"` matches the GitHub Pages project subpath (`https://<user>.github.io/cheap_park/`). If using a custom domain or root deploy, change to `"/"`.

- [ ] **Step 5: Create `apps/web/index.html`**

```html
<!doctype html>
<html lang="sv">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0a0a0a" />
    <title>Cheap Park — Göteborg</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `apps/web/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing #root");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7: Create `apps/web/src/App.tsx`**

Stub for now — Task 14 wires up the real flow.

```tsx
export function App() {
  return (
    <main>
      <h1>Cheap Park</h1>
      <p>Loading…</p>
    </main>
  );
}
```

- [ ] **Step 8: Create `apps/web/src/styles.css`**

```css
:root {
  --bg: #f4f4f6;
  --fg: #0a0a0a;
  --muted: #666;
  --primary: #1f6feb;
  --green: #22a35a;
  --yellow: #f0a020;
  --red: #d2362f;
  --grey: #8a8a8a;
  --surface: #fff;
  color-scheme: light;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  padding: 0;
  height: 100%;
  -webkit-font-smoothing: antialiased;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  background: var(--bg);
  color: var(--fg);
}

main {
  padding: 16px;
}
```

- [ ] **Step 9: Create `apps/web/src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 10: Create `apps/web/.gitignore`**

```
dist/
*.log
```

- [ ] **Step 11: Install dependencies**

Run: `npm install` from `D:\src\cheap_park`
Expected: ~200+ packages added (react, vite, maplibre, etc.); no errors.

- [ ] **Step 12: Verify dev server starts**

Run: `npm run dev --workspace @cheap-park/web`
Expected: Vite prints `Local: http://localhost:5173/cheap_park/`. Open in browser, confirm "Cheap Park" + "Loading…" renders. Then Ctrl+C to stop.

- [ ] **Step 13: Verify build works**

Run: `npm run build --workspace @cheap-park/web`
Expected: `apps/web/dist/` populated with `index.html`, `assets/*.js`, `assets/*.css`. No tsc or vite errors.

- [ ] **Step 14: Commit**

```bash
git add apps/web/ package-lock.json
git commit -m "feat(web): scaffold Vite + React + TS app"
```

---

### Task 2: lib/data.ts — load and parse data snapshot

**Files:**
- Create: `apps/web/src/lib/data.ts`
- Create: `apps/web/src/tests/data.test.ts`
- Create: `apps/web/vitest.config.ts`

- [ ] **Step 1: Create `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/tests/**/*.test.ts", "src/tests/**/*.test.tsx"],
    environment: "happy-dom",
  },
});
```

Note: `happy-dom` is added as a dev dep in this step — install it now:

Run: `npm install --workspace @cheap-park/web --save-dev happy-dom@^15.0.0`

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/tests/data.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { loadSnapshot, tariffFor } from "../lib/data.js";
import type { Parking, Tariff } from "@cheap-park/tariff";

const sampleParkings = {
  generatedAt: "2026-05-08T04:00:00Z",
  source: "test",
  parkings: [
    {
      id: "P-1",
      name: "Test 1",
      owner: "Test",
      lat: 57.7,
      lng: 11.97,
      spaces: 5,
      tariffId: "free-30min",
      maxParkingMinutes: 30,
      raw: {},
    },
    {
      id: "P-2",
      name: "Test 2",
      owner: "Test",
      lat: 57.71,
      lng: 11.98,
      spaces: 3,
      tariffId: null,
      maxParkingMinutes: null,
      raw: {},
    },
  ],
};

const sampleTariffs = {
  tariffs: [
    {
      id: "free-30min",
      name: "Avgiftsfri 30 min",
      rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }],
    },
  ],
};

describe("loadSnapshot", () => {
  it("fetches and combines parkings + tariffs", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("parkings.json")) {
        return new Response(JSON.stringify(sampleParkings));
      }
      if (url.endsWith("tariffs.json")) {
        return new Response(JSON.stringify(sampleTariffs));
      }
      throw new Error(`unexpected url ${url}`);
    });
    const snap = await loadSnapshot({ basePath: "/data", fetcher: fetcher as typeof fetch });
    expect(snap.parkings.length).toBe(2);
    expect(snap.tariffs.size).toBe(1);
    expect(snap.tariffs.get("free-30min")?.name).toBe("Avgiftsfri 30 min");
    expect(snap.generatedAt.toISOString()).toBe("2026-05-08T04:00:00.000Z");
  });

  it("propagates fetch error", async () => {
    const fetcher = vi.fn(async () => new Response("err", { status: 500 }));
    await expect(
      loadSnapshot({ basePath: "/data", fetcher: fetcher as typeof fetch }),
    ).rejects.toThrow();
  });
});

describe("tariffFor", () => {
  const tariffs = new Map<string, Tariff>([
    [
      "free-30min",
      {
        id: "free-30min",
        name: "Free 30",
        rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }],
      },
    ],
  ]);

  it("returns tariff when parking has matching id", () => {
    const p = { tariffId: "free-30min" } as Parking;
    expect(tariffFor(p, tariffs)?.id).toBe("free-30min");
  });

  it("returns null when tariffId is null", () => {
    const p = { tariffId: null } as Parking;
    expect(tariffFor(p, tariffs)).toBeNull();
  });

  it("returns null when tariffId is unknown", () => {
    const p = { tariffId: "missing" } as Parking;
    expect(tariffFor(p, tariffs)).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test --workspace @cheap-park/web`
Expected: FAIL with "Cannot find module '../lib/data.js'".

- [ ] **Step 4: Implement `lib/data.ts`**

Create `apps/web/src/lib/data.ts`:

```ts
import type { Parking, Tariff, ParkingsSnapshot, TariffsSnapshot } from "@cheap-park/tariff";

export type Snapshot = {
  generatedAt: Date;
  source: string;
  parkings: Parking[];
  tariffs: Map<string, Tariff>;
};

export type LoadOptions = {
  basePath: string;
  fetcher?: typeof fetch;
};

export async function loadSnapshot(opts: LoadOptions): Promise<Snapshot> {
  const f = opts.fetcher ?? fetch;
  const [parkingsRes, tariffsRes] = await Promise.all([
    f(`${opts.basePath}/parkings.json`),
    f(`${opts.basePath}/tariffs.json`),
  ]);

  if (!parkingsRes.ok) {
    throw new Error(`parkings.json: ${parkingsRes.status} ${parkingsRes.statusText}`);
  }
  if (!tariffsRes.ok) {
    throw new Error(`tariffs.json: ${tariffsRes.status} ${tariffsRes.statusText}`);
  }

  const parkings = (await parkingsRes.json()) as ParkingsSnapshot;
  const tariffs = (await tariffsRes.json()) as TariffsSnapshot;

  return {
    generatedAt: new Date(parkings.generatedAt),
    source: parkings.source,
    parkings: parkings.parkings,
    tariffs: new Map(tariffs.tariffs.map((t) => [t.id, t])),
  };
}

export function tariffFor(parking: Parking, tariffs: Map<string, Tariff>): Tariff | null {
  if (!parking.tariffId) return null;
  return tariffs.get(parking.tariffId) ?? null;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test --workspace @cheap-park/web`
Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add snapshot loader and tariff lookup"
```

---

### Task 3: lib/prices.ts — UI-facing price wrappers

**Files:**
- Create: `apps/web/src/lib/prices.ts`
- Create: `apps/web/src/tests/prices.test.ts`

This wraps `priceNow` and `totalCost` from `@cheap-park/tariff` and adds UI-formatting helpers.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/tests/prices.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Tariff } from "@cheap-park/tariff";
import { priceLabel, totalLabel, hourlyRate } from "../lib/prices.js";

const flat20: Tariff = {
  id: "flat",
  name: "Flat",
  rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 20 }],
};

const free: Tariff = {
  id: "free",
  name: "Free",
  rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }],
};

const now = new Date("2026-05-11T14:00:00");

describe("priceLabel", () => {
  it("renders kr/h for paid tariff", () => {
    expect(priceLabel(flat20, now)).toBe("20 kr/h");
  });

  it("renders 'Gratis' for free tariff", () => {
    expect(priceLabel(free, now)).toBe("Gratis");
  });

  it("renders 'N/A' for missing tariff", () => {
    expect(priceLabel(null, now)).toBe("N/A");
  });
});

describe("totalLabel", () => {
  it("renders total kr for paid tariff over duration", () => {
    expect(totalLabel(flat20, now, 60)).toBe("20 kr");
  });

  it("renders 'Gratis' when total is 0", () => {
    expect(totalLabel(free, now, 60)).toBe("Gratis");
  });

  it("renders 'N/A' for missing tariff", () => {
    expect(totalLabel(null, now, 60)).toBe("N/A");
  });

  it("rounds to integer kr", () => {
    expect(totalLabel(flat20, now, 90)).toBe("30 kr");
  });
});

describe("hourlyRate", () => {
  it("returns numeric rate for paid tariff", () => {
    expect(hourlyRate(flat20, now)).toBe(20);
  });

  it("returns 0 for free tariff", () => {
    expect(hourlyRate(free, now)).toBe(0);
  });

  it("returns null for missing tariff", () => {
    expect(hourlyRate(null, now)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace @cheap-park/web`
Expected: FAIL "Cannot find module '../lib/prices.js'".

- [ ] **Step 3: Implement `lib/prices.ts`**

Create `apps/web/src/lib/prices.ts`:

```ts
import { priceNow, totalCost } from "@cheap-park/tariff";
import type { Tariff } from "@cheap-park/tariff";

export function priceLabel(tariff: Tariff | null, now: Date): string {
  const rate = priceNow(tariff, now);
  if (rate === "n/a") return "N/A";
  if (rate === "free") return "Gratis";
  return `${rate} kr/h`;
}

export function totalLabel(tariff: Tariff | null, now: Date, durationMinutes: number): string {
  const result = totalCost(tariff, now, durationMinutes);
  if (result === "n/a") return "N/A";
  if (result.total === 0) return "Gratis";
  return `${Math.round(result.total)} kr`;
}

export function hourlyRate(tariff: Tariff | null, now: Date): number | null {
  const rate = priceNow(tariff, now);
  if (rate === "n/a") return null;
  if (rate === "free") return 0;
  return rate;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace @cheap-park/web`
Expected: 5 + 10 = 15 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add UI-facing price label helpers"
```

---

### Task 4: lib/colors.ts — viewport-relative price tier

**Files:**
- Create: `apps/web/src/lib/colors.ts`
- Create: `apps/web/src/tests/colors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/tests/colors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { tierForViewport } from "../lib/colors.js";

describe("tierForViewport", () => {
  it("returns grey for null price (n/a)", () => {
    expect(tierForViewport([10, 20, 30], null)).toBe("grey");
  });

  it("returns green for 0 (free)", () => {
    expect(tierForViewport([10, 20, 30], 0)).toBe("green");
  });

  it("returns green when in bottom tertile", () => {
    expect(tierForViewport([10, 20, 30, 40, 50, 60], 15)).toBe("green");
  });

  it("returns yellow when in middle tertile", () => {
    expect(tierForViewport([10, 20, 30, 40, 50, 60], 35)).toBe("yellow");
  });

  it("returns red when in top tertile", () => {
    expect(tierForViewport([10, 20, 30, 40, 50, 60], 55)).toBe("red");
  });

  it("returns green when viewport has no numeric prices (only free / n/a)", () => {
    expect(tierForViewport([], 0)).toBe("green");
  });

  it("ignores nulls in the population", () => {
    expect(tierForViewport([null, 10, null, 50, null], 12)).toBe("green");
  });

  it("returns green for the cheapest single price", () => {
    expect(tierForViewport([42], 42)).toBe("green");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace @cheap-park/web`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/colors.ts`**

Create `apps/web/src/lib/colors.ts`:

```ts
export type Tier = "green" | "yellow" | "red" | "grey";

/**
 * Returns the color tier for `price` relative to the population of `viewport`
 * prices currently visible. `null` means n/a (no tariff). 0 means free.
 *
 * Tiers: green = bottom third or free; yellow = middle third; red = top third;
 * grey = unknown.
 */
export function tierForViewport(viewport: (number | null)[], price: number | null): Tier {
  if (price === null) return "grey";
  if (price === 0) return "green";

  const numbers = viewport
    .filter((p): p is number => typeof p === "number" && p > 0)
    .sort((a, b) => a - b);

  if (numbers.length === 0) return "green";

  const t1Idx = Math.floor(numbers.length / 3);
  const t2Idx = Math.floor((numbers.length * 2) / 3);
  const t1 = numbers[t1Idx] ?? numbers[numbers.length - 1] ?? 0;
  const t2 = numbers[t2Idx] ?? numbers[numbers.length - 1] ?? 0;

  if (price <= t1) return "green";
  if (price <= t2) return "yellow";
  return "red";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace @cheap-park/web`
Expected: 15 + 8 = 23 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add viewport-relative price tier function"
```

---

### Task 5: lib/url-state.ts — encode/decode app state to URL

**Files:**
- Create: `apps/web/src/lib/url-state.ts`
- Create: `apps/web/src/tests/url-state.test.ts`

App state shape:
```
{
  durationMinutes: number | null   // null = "Vet ej"
  filters: {
    free: boolean
    accessible: boolean
    longTerm: boolean
    maxPricePerHour: number | null
  }
}
```

URL params: `?duration=60&free=1&accessible=1&long=1&max=30`. Omitted = default.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/tests/url-state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readState, writeState, defaultState } from "../lib/url-state.js";

describe("readState", () => {
  it("returns default when params empty", () => {
    expect(readState(new URLSearchParams())).toEqual(defaultState);
  });

  it("parses duration", () => {
    const s = readState(new URLSearchParams("duration=60"));
    expect(s.durationMinutes).toBe(60);
  });

  it("treats invalid duration as null", () => {
    const s = readState(new URLSearchParams("duration=abc"));
    expect(s.durationMinutes).toBeNull();
  });

  it("parses filter booleans", () => {
    const s = readState(new URLSearchParams("free=1&accessible=1&long=1"));
    expect(s.filters.free).toBe(true);
    expect(s.filters.accessible).toBe(true);
    expect(s.filters.longTerm).toBe(true);
  });

  it("parses max price", () => {
    const s = readState(new URLSearchParams("max=30"));
    expect(s.filters.maxPricePerHour).toBe(30);
  });
});

describe("writeState", () => {
  it("returns empty string for default state", () => {
    expect(writeState(defaultState).toString()).toBe("");
  });

  it("encodes duration", () => {
    const params = writeState({ ...defaultState, durationMinutes: 120 });
    expect(params.get("duration")).toBe("120");
  });

  it("encodes filters as 1 when true", () => {
    const params = writeState({
      ...defaultState,
      filters: { free: true, accessible: false, longTerm: true, maxPricePerHour: null },
    });
    expect(params.get("free")).toBe("1");
    expect(params.get("accessible")).toBeNull();
    expect(params.get("long")).toBe("1");
  });

  it("encodes max price", () => {
    const params = writeState({
      ...defaultState,
      filters: { ...defaultState.filters, maxPricePerHour: 25 },
    });
    expect(params.get("max")).toBe("25");
  });

  it("round-trips arbitrary state", () => {
    const original = {
      durationMinutes: 90,
      filters: { free: true, accessible: false, longTerm: true, maxPricePerHour: 40 },
    };
    const params = writeState(original);
    expect(readState(params)).toEqual(original);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace @cheap-park/web`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/url-state.ts`**

Create `apps/web/src/lib/url-state.ts`:

```ts
export type FilterState = {
  free: boolean;
  accessible: boolean;
  longTerm: boolean;
  maxPricePerHour: number | null;
};

export type AppState = {
  durationMinutes: number | null;
  filters: FilterState;
};

export const defaultState: AppState = {
  durationMinutes: null,
  filters: {
    free: false,
    accessible: false,
    longTerm: false,
    maxPricePerHour: null,
  },
};

function parseInt10(v: string | null): number | null {
  if (v === null) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function parseBool(v: string | null): boolean {
  return v === "1";
}

export function readState(params: URLSearchParams): AppState {
  return {
    durationMinutes: parseInt10(params.get("duration")),
    filters: {
      free: parseBool(params.get("free")),
      accessible: parseBool(params.get("accessible")),
      longTerm: parseBool(params.get("long")),
      maxPricePerHour: parseInt10(params.get("max")),
    },
  };
}

export function writeState(state: AppState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.durationMinutes !== null) p.set("duration", String(state.durationMinutes));
  if (state.filters.free) p.set("free", "1");
  if (state.filters.accessible) p.set("accessible", "1");
  if (state.filters.longTerm) p.set("long", "1");
  if (state.filters.maxPricePerHour !== null) p.set("max", String(state.filters.maxPricePerHour));
  return p;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace @cheap-park/web`
Expected: 23 + 11 = 34 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/
git commit -m "feat(web): URL state encoding for duration and filters"
```

---

### Task 6: lib/filter.ts — apply filters to parkings list

**Files:**
- Create: `apps/web/src/lib/filter.ts`
- Create: `apps/web/src/tests/filter.test.ts`

Filter rules:
- `free`: only parkings whose current rate is "free" (priceNow returns "free")
- `accessible`: parking's `raw.ExtraInfo` matches /rörelsehindrade|handikapp|permit/i
- `longTerm`: maxParkingMinutes >= 360 OR null (unlimited)
- `maxPricePerHour`: priceNow numeric value <= max; "free" passes; "n/a" filtered out
- Auto-dim correctness: parkings with maxParkingMinutes < userDuration are returned with `dimmed: true`

The filter returns `{ visible: Parking[], dimmed: Parking[] }` separately, so the UI can render them differently.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/tests/filter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Parking, Tariff } from "@cheap-park/tariff";
import { applyFilters } from "../lib/filter.js";
import { defaultState } from "../lib/url-state.js";

const tariffs = new Map<string, Tariff>([
  [
    "free",
    { id: "free", name: "Free", rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }] },
  ],
  [
    "paid20",
    { id: "paid20", name: "Paid 20", rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 20 }] },
  ],
  [
    "paid60",
    { id: "paid60", name: "Paid 60", rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 60 }] },
  ],
]);

const now = new Date("2026-05-11T14:00:00");

function p(over: Partial<Parking>): Parking {
  return {
    id: "x",
    name: "x",
    owner: "x",
    lat: 0,
    lng: 0,
    spaces: 1,
    tariffId: null,
    maxParkingMinutes: null,
    raw: {},
    ...over,
  };
}

describe("applyFilters", () => {
  it("returns all parkings as visible when filters are default", () => {
    const list = [p({ id: "a" }), p({ id: "b" })];
    const result = applyFilters(list, tariffs, defaultState, now);
    expect(result.visible.length).toBe(2);
    expect(result.dimmed.length).toBe(0);
  });

  it("filters to only free when free=true", () => {
    const list = [
      p({ id: "free", tariffId: "free" }),
      p({ id: "paid", tariffId: "paid20" }),
    ];
    const state = { ...defaultState, filters: { ...defaultState.filters, free: true } };
    const result = applyFilters(list, tariffs, state, now);
    expect(result.visible.map((x) => x.id)).toEqual(["free"]);
  });

  it("filters by accessible (ExtraInfo substring match)", () => {
    const list = [
      p({ id: "rh", raw: { ExtraInfo: "Endast rörelsehindrade" } }),
      p({ id: "regular", raw: { ExtraInfo: "Vanlig parkering" } }),
    ];
    const state = { ...defaultState, filters: { ...defaultState.filters, accessible: true } };
    const result = applyFilters(list, tariffs, state, now);
    expect(result.visible.map((x) => x.id)).toEqual(["rh"]);
  });

  it("filters longTerm: keeps maxParkingMinutes >= 360 or null", () => {
    const list = [
      p({ id: "short", maxParkingMinutes: 30 }),
      p({ id: "long", maxParkingMinutes: 480 }),
      p({ id: "unlimited", maxParkingMinutes: null }),
    ];
    const state = { ...defaultState, filters: { ...defaultState.filters, longTerm: true } };
    const result = applyFilters(list, tariffs, state, now);
    expect(result.visible.map((x) => x.id).sort()).toEqual(["long", "unlimited"]);
  });

  it("filters maxPricePerHour: free passes, n/a hidden, numeric compared", () => {
    const list = [
      p({ id: "free", tariffId: "free" }),
      p({ id: "cheap", tariffId: "paid20" }),
      p({ id: "expensive", tariffId: "paid60" }),
      p({ id: "unknown", tariffId: null }),
    ];
    const state = {
      ...defaultState,
      filters: { ...defaultState.filters, maxPricePerHour: 30 },
    };
    const result = applyFilters(list, tariffs, state, now);
    expect(result.visible.map((x) => x.id).sort()).toEqual(["cheap", "free"]);
  });

  it("dims parkings whose maxParkingMinutes is less than userDuration", () => {
    const list = [
      p({ id: "short", maxParkingMinutes: 30 }),
      p({ id: "long", maxParkingMinutes: 240 }),
    ];
    const state = { ...defaultState, durationMinutes: 120 };
    const result = applyFilters(list, tariffs, state, now);
    expect(result.visible.map((x) => x.id)).toEqual(["long"]);
    expect(result.dimmed.map((x) => x.id)).toEqual(["short"]);
  });

  it("does not dim when duration is null", () => {
    const list = [p({ id: "short", maxParkingMinutes: 30 })];
    const result = applyFilters(list, tariffs, defaultState, now);
    expect(result.visible.length).toBe(1);
    expect(result.dimmed.length).toBe(0);
  });

  it("dimmed parkings still respect other filters (e.g., free)", () => {
    const list = [
      p({ id: "short-free", tariffId: "free", maxParkingMinutes: 30 }),
      p({ id: "short-paid", tariffId: "paid20", maxParkingMinutes: 30 }),
    ];
    const state = {
      ...defaultState,
      durationMinutes: 120,
      filters: { ...defaultState.filters, free: true },
    };
    const result = applyFilters(list, tariffs, state, now);
    // Both fail "long enough", but only short-free passes "free" filter
    expect(result.visible.length).toBe(0);
    expect(result.dimmed.map((x) => x.id)).toEqual(["short-free"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace @cheap-park/web`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/filter.ts`**

Create `apps/web/src/lib/filter.ts`:

```ts
import type { Parking, Tariff } from "@cheap-park/tariff";
import { priceNow } from "@cheap-park/tariff";
import { tariffFor } from "./data.js";
import type { AppState } from "./url-state.js";

const ACCESSIBLE_RE = /rörelsehindrade|handikapp|permit/i;

export type FilterResult = {
  visible: Parking[];
  dimmed: Parking[];
};

function isAccessible(parking: Parking): boolean {
  const extra = parking.raw["ExtraInfo"] ?? "";
  return ACCESSIBLE_RE.test(extra);
}

function passesFilters(
  parking: Parking,
  tariffs: Map<string, Tariff>,
  state: AppState,
  now: Date,
): boolean {
  const tariff = tariffFor(parking, tariffs);
  const rate = priceNow(tariff, now);

  if (state.filters.free && rate !== "free") return false;
  if (state.filters.accessible && !isAccessible(parking)) return false;
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
  parkings: Parking[],
  tariffs: Map<string, Tariff>,
  state: AppState,
  now: Date,
): FilterResult {
  const visible: Parking[] = [];
  const dimmed: Parking[] = [];

  for (const parking of parkings) {
    if (!passesFilters(parking, tariffs, state, now)) continue;

    const duration = state.durationMinutes;
    if (
      duration !== null &&
      parking.maxParkingMinutes !== null &&
      parking.maxParkingMinutes < duration
    ) {
      dimmed.push(parking);
    } else {
      visible.push(parking);
    }
  }

  return { visible, dimmed };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace @cheap-park/web`
Expected: 34 + 8 = 42 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/
git commit -m "feat(web): filter parkings with auto-dim for too-short max time"
```

---

### Task 7: lib/geo.ts — geolocation hook

**Files:**
- Create: `apps/web/src/lib/geo.ts`

Default location is Brunnsparken (Göteborg city centre). Hook returns current state plus a request function. Geolocation is requested lazily (not on app load — caller decides when).

- [ ] **Step 1: Implement `lib/geo.ts`**

Create `apps/web/src/lib/geo.ts`:

```ts
import { useCallback, useState } from "react";

export const BRUNNSPARKEN = { lat: 57.7068, lng: 11.9685 } as const;

export type GeoState =
  | { status: "unknown"; lat: number; lng: number }
  | { status: "granted"; lat: number; lng: number }
  | { status: "denied"; lat: number; lng: number; reason: string };

export function useGeolocation(): { state: GeoState; request: () => void } {
  const [state, setState] = useState<GeoState>({ status: "unknown", ...BRUNNSPARKEN });

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState({ status: "denied", ...BRUNNSPARKEN, reason: "geolocation not supported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({ status: "granted", lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setState({ status: "denied", ...BRUNNSPARKEN, reason: err.message });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  return { state, request };
}
```

This file has no unit tests — testing browser geolocation properly requires a heavy mock. The behavior is a thin wrapper, manually verified in dev.

- [ ] **Step 2: Verify it compiles**

Run: `npm run build --workspace @cheap-park/web`
Expected: builds without TypeScript errors. (Tests have not changed; do not re-run.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/
git commit -m "feat(web): geolocation hook with Brunnsparken fallback"
```

---

### Task 8: ParkingDuration component

**Files:**
- Create: `apps/web/src/components/ParkingDuration.tsx`
- Create: `apps/web/src/components/ParkingDuration.css`

Modal popup with a slider (15 min – 8 tim) and a "Vet ej" button. Renders as a fixed-position overlay with a backdrop. Calls back with the chosen duration (number of minutes, or null for "Vet ej").

- [ ] **Step 1: Create `apps/web/src/components/ParkingDuration.css`**

```css
.duration-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
}

.duration-card {
  background: var(--surface);
  border-radius: 18px;
  padding: 24px 20px;
  width: 100%;
  max-width: 360px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
}

.duration-card h2 {
  margin: 0 0 4px;
  font-size: 22px;
  font-weight: 600;
}

.duration-value {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-align: center;
  margin: 8px 0 4px;
}

.duration-target {
  font-size: 13px;
  color: var(--muted);
  text-align: center;
  margin-bottom: 16px;
}

.duration-slider {
  width: 100%;
  margin: 8px 0;
}

.duration-bounds {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--muted);
}

.duration-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.duration-actions button {
  border: none;
  font-size: 16px;
  font-weight: 600;
  padding: 14px;
  border-radius: 12px;
  cursor: pointer;
}

.duration-show {
  background: var(--fg);
  color: #fff;
}

.duration-unknown {
  background: transparent;
  color: var(--muted);
  border: 1px solid #ddd !important;
}
```

- [ ] **Step 2: Implement `ParkingDuration.tsx`**

Create `apps/web/src/components/ParkingDuration.tsx`:

```tsx
import { useMemo, useState } from "react";
import "./ParkingDuration.css";

type Props = {
  initialMinutes: number | null;
  onChoose: (minutes: number | null) => void;
};

const MIN_MINUTES = 15;
const MAX_MINUTES = 480;

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} tim`;
  return `${h} tim ${m} min`;
}

function targetTime(minutes: number, now: Date): string {
  const target = new Date(now.getTime() + minutes * 60_000);
  return target.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

export function ParkingDuration({ initialMinutes, onChoose }: Props) {
  const [minutes, setMinutes] = useState<number>(initialMinutes ?? 60);
  const now = useMemo(() => new Date(), []);

  return (
    <div className="duration-overlay" role="dialog" aria-modal="true">
      <div className="duration-card">
        <h2>Hur länge ska du parkera?</h2>
        <div className="duration-value">{formatDuration(minutes)}</div>
        <div className="duration-target">till {targetTime(minutes, now)}</div>
        <input
          className="duration-slider"
          type="range"
          min={MIN_MINUTES}
          max={MAX_MINUTES}
          step={15}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.currentTarget.value))}
          aria-label="Parkeringstid i minuter"
        />
        <div className="duration-bounds">
          <span>15 min</span>
          <span>4 tim</span>
          <span>8 tim</span>
        </div>
        <div className="duration-actions">
          <button className="duration-show" onClick={() => onChoose(minutes)}>
            Visa parkeringar
          </button>
          <button className="duration-unknown" onClick={() => onChoose(null)}>
            Vet ej
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build --workspace @cheap-park/web`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add apps/web/
git commit -m "feat(web): ParkingDuration modal with slider and 'Vet ej'"
```

---

### Task 9: DetailSheet component

**Files:**
- Create: `apps/web/src/components/DetailSheet.tsx`
- Create: `apps/web/src/components/DetailSheet.css`

Bottom sheet that slides up when a parking pin is tapped. Shows: name, current rate, total cost (if duration set), max parking time, raw text fallback, and a "Vägbeskrivning" button that opens the device's maps app.

- [ ] **Step 1: Create `apps/web/src/components/DetailSheet.css`**

```css
.detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  pointer-events: none;
}

.detail-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  pointer-events: auto;
  opacity: 0;
  transition: opacity 0.15s;
}

.detail-overlay.open .detail-backdrop {
  opacity: 1;
}

.detail-sheet {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--surface);
  border-radius: 18px 18px 0 0;
  padding: 16px 20px env(safe-area-inset-bottom, 16px);
  pointer-events: auto;
  transform: translateY(100%);
  transition: transform 0.2s ease-out;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.15);
}

.detail-overlay.open .detail-sheet {
  transform: translateY(0);
}

.detail-handle {
  width: 36px;
  height: 4px;
  background: #ccc;
  border-radius: 2px;
  margin: 0 auto 12px;
}

.detail-name {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 4px;
}

.detail-owner {
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 16px;
}

.detail-prices {
  display: flex;
  gap: 16px;
  padding: 12px;
  background: #f6f6f8;
  border-radius: 12px;
  margin-bottom: 16px;
}

.detail-price-block {
  flex: 1;
}

.detail-price-block .label {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--muted);
  letter-spacing: 0.05em;
}

.detail-price-block .value {
  font-size: 22px;
  font-weight: 700;
}

.detail-rules {
  font-size: 13px;
  color: #444;
  margin-bottom: 12px;
  white-space: pre-line;
}

.detail-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.detail-actions button,
.detail-actions a {
  flex: 1;
  text-align: center;
  text-decoration: none;
  padding: 12px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 15px;
  border: none;
  cursor: pointer;
}

.detail-actions .primary {
  background: var(--fg);
  color: #fff;
}

.detail-actions .secondary {
  background: #eee;
  color: var(--fg);
}
```

- [ ] **Step 2: Implement `DetailSheet.tsx`**

Create `apps/web/src/components/DetailSheet.tsx`:

```tsx
import { useEffect } from "react";
import type { Parking, Tariff } from "@cheap-park/tariff";
import { priceLabel, totalLabel } from "../lib/prices.js";
import "./DetailSheet.css";

type Props = {
  parking: Parking | null;
  tariff: Tariff | null;
  durationMinutes: number | null;
  onClose: () => void;
};

function directionsUrl(parking: Parking): string {
  // Cross-platform "open in maps" — Apple/Google Maps both accept this query.
  return `https://www.google.com/maps/dir/?api=1&destination=${parking.lat},${parking.lng}`;
}

function maxParkingLabel(parking: Parking): string {
  if (parking.maxParkingMinutes === null) return "Ingen begränsning";
  const h = Math.floor(parking.maxParkingMinutes / 60);
  const m = parking.maxParkingMinutes % 60;
  if (h === 0) return `Max ${m} min`;
  if (m === 0) return `Max ${h} tim`;
  return `Max ${h} tim ${m} min`;
}

function rulesText(parking: Parking): string {
  const parts: string[] = [];
  const cost = parking.raw["ParkingCost"];
  const limit = parking.raw["MaxParkingTimeLimitation"];
  const extra = parking.raw["ExtraInfo"];
  if (cost) parts.push(cost);
  if (limit) parts.push(limit);
  if (extra) parts.push(extra);
  return parts.join("\n") || "Inga regler tillgängliga";
}

export function DetailSheet({ parking, tariff, durationMinutes, onClose }: Props) {
  useEffect(() => {
    if (!parking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [parking, onClose]);

  const open = parking !== null;
  const now = new Date();

  return (
    <div className={`detail-overlay${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-sheet" role="dialog" aria-modal="true">
        <div className="detail-handle" />
        {parking && (
          <>
            <h3 className="detail-name">{parking.name || parking.id}</h3>
            <div className="detail-owner">{parking.owner}</div>

            <div className="detail-prices">
              <div className="detail-price-block">
                <div className="label">Just nu</div>
                <div className="value">{priceLabel(tariff, now)}</div>
              </div>
              {durationMinutes !== null && (
                <div className="detail-price-block">
                  <div className="label">Total</div>
                  <div className="value">{totalLabel(tariff, now, durationMinutes)}</div>
                </div>
              )}
            </div>

            <div className="detail-rules">
              <strong>{maxParkingLabel(parking)}</strong>
              {"\n"}
              {rulesText(parking)}
            </div>

            <div className="detail-actions">
              <button className="secondary" onClick={onClose}>
                Stäng
              </button>
              <a className="primary" href={directionsUrl(parking)} target="_blank" rel="noopener">
                Vägbeskrivning
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build --workspace @cheap-park/web`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add apps/web/
git commit -m "feat(web): DetailSheet bottom sheet for parking details"
```

---

### Task 10: FilterSheet component

**Files:**
- Create: `apps/web/src/components/FilterSheet.tsx`
- Create: `apps/web/src/components/FilterSheet.css`

Bottom sheet (same overlay pattern as DetailSheet) with three checkboxes and a max-price slider.

- [ ] **Step 1: Create `apps/web/src/components/FilterSheet.css`**

```css
.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid #eee;
}

.filter-row:last-child {
  border-bottom: none;
}

.filter-row label {
  font-size: 16px;
  font-weight: 500;
}

.filter-row input[type="checkbox"] {
  width: 22px;
  height: 22px;
}

.filter-slider-row {
  padding: 14px 0;
}

.filter-slider-row .label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.filter-slider-row .max-value {
  font-weight: 600;
}

.filter-slider-row input[type="range"] {
  width: 100%;
}

.filter-buttons {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.filter-buttons button {
  flex: 1;
  padding: 12px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 15px;
  border: none;
  cursor: pointer;
}

.filter-buttons .reset {
  background: #eee;
}

.filter-buttons .apply {
  background: var(--fg);
  color: #fff;
}
```

- [ ] **Step 2: Implement `FilterSheet.tsx`**

Create `apps/web/src/components/FilterSheet.tsx`:

```tsx
import { useState } from "react";
import "./DetailSheet.css"; // reuses overlay/backdrop/sheet styles
import "./FilterSheet.css";
import type { FilterState } from "../lib/url-state.js";

type Props = {
  open: boolean;
  initial: FilterState;
  onApply: (next: FilterState) => void;
  onClose: () => void;
};

const MAX_DEFAULT = 60;
const MAX_MIN = 5;
const MAX_MAX = 200;

export function FilterSheet({ open, initial, onApply, onClose }: Props) {
  const [state, setState] = useState<FilterState>(initial);

  return (
    <div className={`detail-overlay${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-sheet" role="dialog" aria-modal="true">
        <div className="detail-handle" />
        <h3 className="detail-name">Filter</h3>

        <div className="filter-row">
          <label htmlFor="f-free">Endast avgiftsfri</label>
          <input
            id="f-free"
            type="checkbox"
            checked={state.free}
            onChange={(e) => setState({ ...state, free: e.currentTarget.checked })}
          />
        </div>

        <div className="filter-row">
          <label htmlFor="f-acc">Handikapp</label>
          <input
            id="f-acc"
            type="checkbox"
            checked={state.accessible}
            onChange={(e) => setState({ ...state, accessible: e.currentTarget.checked })}
          />
        </div>

        <div className="filter-row">
          <label htmlFor="f-long">Endast långtid (≥6 tim)</label>
          <input
            id="f-long"
            type="checkbox"
            checked={state.longTerm}
            onChange={(e) => setState({ ...state, longTerm: e.currentTarget.checked })}
          />
        </div>

        <div className="filter-slider-row">
          <div className="label-row">
            <span>Max pris per timme</span>
            <span className="max-value">
              {state.maxPricePerHour === null ? "Av" : `${state.maxPricePerHour} kr`}
            </span>
          </div>
          <input
            type="range"
            min={MAX_MIN}
            max={MAX_MAX}
            step={5}
            value={state.maxPricePerHour ?? MAX_DEFAULT}
            onChange={(e) => setState({ ...state, maxPricePerHour: Number(e.currentTarget.value) })}
            aria-label="Max pris per timme"
          />
          {state.maxPricePerHour !== null && (
            <button
              style={{
                marginTop: 8,
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                fontSize: 13,
                cursor: "pointer",
              }}
              onClick={() => setState({ ...state, maxPricePerHour: null })}
            >
              Stäng av max-pris
            </button>
          )}
        </div>

        <div className="filter-buttons">
          <button
            className="reset"
            onClick={() => {
              setState({
                free: false,
                accessible: false,
                longTerm: false,
                maxPricePerHour: null,
              });
            }}
          >
            Återställ
          </button>
          <button className="apply" onClick={() => onApply(state)}>
            Visa
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build --workspace @cheap-park/web`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/
git commit -m "feat(web): FilterSheet with 3 toggles and max-price slider"
```

---

### Task 11: ListView component

**Files:**
- Create: `apps/web/src/components/ListView.tsx`
- Create: `apps/web/src/components/ListView.css`

Vertical list of parkings sorted by current rate (cheapest first). Tapping a row opens DetailSheet via callback.

- [ ] **Step 1: Create `apps/web/src/components/ListView.css`**

```css
.list-view {
  height: 100%;
  overflow-y: auto;
  padding: 0 16px;
}

.list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid #eee;
  cursor: pointer;
}

.list-row.dimmed {
  opacity: 0.45;
}

.list-row .name {
  font-weight: 500;
  font-size: 15px;
}

.list-row .meta {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}

.list-row .price {
  font-weight: 700;
  font-size: 16px;
  text-align: right;
}

.list-row .price.green {
  color: var(--green);
}
.list-row .price.yellow {
  color: var(--yellow);
}
.list-row .price.red {
  color: var(--red);
}
.list-row .price.grey {
  color: var(--grey);
}
```

- [ ] **Step 2: Implement `ListView.tsx`**

Create `apps/web/src/components/ListView.tsx`:

```tsx
import type { Parking, Tariff } from "@cheap-park/tariff";
import { priceLabel, totalLabel, hourlyRate } from "../lib/prices.js";
import { tariffFor } from "../lib/data.js";
import { tierForViewport } from "../lib/colors.js";
import "./ListView.css";

type Props = {
  visible: Parking[];
  dimmed: Parking[];
  tariffs: Map<string, Tariff>;
  durationMinutes: number | null;
  onSelect: (parking: Parking) => void;
};

export function ListView({ visible, dimmed, tariffs, durationMinutes, onSelect }: Props) {
  const now = new Date();

  // Sort visible by hourly rate, ascending. null/n/a goes last.
  const sortedVisible = [...visible].sort((a, b) => {
    const ra = hourlyRate(tariffFor(a, tariffs), now);
    const rb = hourlyRate(tariffFor(b, tariffs), now);
    if (ra === null && rb === null) return 0;
    if (ra === null) return 1;
    if (rb === null) return -1;
    return ra - rb;
  });
  const sortedDimmed = [...dimmed].sort((a, b) => {
    const ra = hourlyRate(tariffFor(a, tariffs), now) ?? Infinity;
    const rb = hourlyRate(tariffFor(b, tariffs), now) ?? Infinity;
    return ra - rb;
  });

  const all = [...sortedVisible, ...sortedDimmed];
  const allRates = all.map((p) => hourlyRate(tariffFor(p, tariffs), now));

  return (
    <div className="list-view">
      {all.map((parking, i) => {
        const tariff = tariffFor(parking, tariffs);
        const rate = allRates[i] ?? null;
        const tier = tierForViewport(allRates, rate);
        const dim = sortedDimmed.includes(parking);
        return (
          <div
            key={parking.id}
            className={`list-row${dim ? " dimmed" : ""}`}
            onClick={() => onSelect(parking)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelect(parking);
            }}
          >
            <div>
              <div className="name">{parking.name || parking.id}</div>
              <div className="meta">{parking.owner}</div>
            </div>
            <div className={`price ${tier}`}>
              {durationMinutes !== null
                ? totalLabel(tariff, now, durationMinutes)
                : priceLabel(tariff, now)}
            </div>
          </div>
        );
      })}
      {all.length === 0 && (
        <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
          Inga parkeringar matchar dina filter.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build --workspace @cheap-park/web`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/
git commit -m "feat(web): ListView with price sorting and tier colors"
```

---

### Task 12: MapView component

**Files:**
- Create: `apps/web/src/components/MapView.tsx`
- Create: `apps/web/src/components/MapView.css`

The map renders all parkings as label-style markers. Color tier is computed per-render from the visible viewport. Tap on a marker fires `onSelect`. Below: filter button, list-view toggle, current duration chip.

- [ ] **Step 1: Create `apps/web/src/components/MapView.css`**

```css
.map-container {
  position: relative;
  height: 100%;
  width: 100%;
}

.map-container .maplibregl-map {
  height: 100%;
}

.parking-pin {
  background: var(--surface);
  color: var(--fg);
  padding: 4px 10px;
  border-radius: 16px;
  font-weight: 600;
  font-size: 12px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
  border: 1px solid #ddd;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.parking-pin.green {
  background: var(--green);
  color: #fff;
  border-color: var(--green);
}
.parking-pin.yellow {
  background: var(--yellow);
  color: #fff;
  border-color: var(--yellow);
}
.parking-pin.red {
  background: var(--red);
  color: #fff;
  border-color: var(--red);
}
.parking-pin.grey {
  background: #eaeaea;
  color: #555;
  border-color: #ccc;
}
.parking-pin.dimmed {
  opacity: 0.45;
}

.map-toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  z-index: 10;
}

.map-chip {
  background: var(--surface);
  border: none;
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  cursor: pointer;
}

.map-fab-row {
  position: absolute;
  bottom: 16px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;
}

.map-fab {
  background: var(--surface);
  border: none;
  width: 44px;
  height: 44px;
  border-radius: 22px;
  font-size: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  cursor: pointer;
}
```

- [ ] **Step 2: Implement `MapView.tsx`**

Create `apps/web/src/components/MapView.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/maplibre";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Parking, Tariff } from "@cheap-park/tariff";
import { tariffFor } from "../lib/data.js";
import { hourlyRate, priceLabel, totalLabel } from "../lib/prices.js";
import { tierForViewport, type Tier } from "../lib/colors.js";
import { BRUNNSPARKEN, useGeolocation } from "../lib/geo.js";
import "./MapView.css";

type Props = {
  visible: Parking[];
  dimmed: Parking[];
  tariffs: Map<string, Tariff>;
  durationMinutes: number | null;
  onSelect: (parking: Parking) => void;
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
      attribution: "&copy; OpenStreetMap",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

function tierClassFor(tier: Tier): string {
  return tier;
}

export function MapView({
  visible,
  dimmed,
  tariffs,
  durationMinutes,
  onSelect,
  onChangeDuration,
  onOpenFilters,
  onOpenList,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const { state: geo, request: requestGeo } = useGeolocation();
  const [hasRequestedGeo, setHasRequestedGeo] = useState(false);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    if (!hasRequestedGeo) {
      requestGeo();
      setHasRequestedGeo(true);
    }
  }, [hasRequestedGeo, requestGeo]);

  useEffect(() => {
    if (geo.status === "granted" && mapRef.current) {
      mapRef.current.flyTo({ center: [geo.lng, geo.lat], zoom: 15 });
    }
  }, [geo]);

  const all = [...visible, ...dimmed];
  const dimmedIds = new Set(dimmed.map((p) => p.id));
  const allRates = all.map((p) => hourlyRate(tariffFor(p, tariffs), now));

  return (
    <div className="map-container">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: BRUNNSPARKEN.lng,
          latitude: BRUNNSPARKEN.lat,
          zoom: 14,
        }}
        mapStyle={OSM_STYLE}
        attributionControl={true}
      >
        {all.map((parking, i) => {
          const tariff = tariffFor(parking, tariffs);
          const rate = allRates[i] ?? null;
          const tier = tierForViewport(allRates, rate);
          const isDim = dimmedIds.has(parking.id);
          const label =
            durationMinutes !== null
              ? totalLabel(tariff, now, durationMinutes)
              : priceLabel(tariff, now);
          return (
            <Marker key={parking.id} latitude={parking.lat} longitude={parking.lng} anchor="center">
              <button
                className={`parking-pin ${tierClassFor(tier)}${isDim ? " dimmed" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(parking);
                }}
                aria-label={`${parking.name} — ${label}`}
              >
                {label}
              </button>
            </Marker>
          );
        })}
        {geo.status === "granted" && (
          <Marker latitude={geo.lat} longitude={geo.lng} anchor="center">
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#1f6feb",
                border: "3px solid #fff",
                boxShadow: "0 0 0 4px rgba(31,111,235,0.25)",
              }}
            />
          </Marker>
        )}
      </Map>
      <div className="map-toolbar">
        <button className="map-chip" onClick={onChangeDuration}>
          {durationMinutes === null
            ? "Vet ej tid"
            : `Tid: ${Math.floor(durationMinutes / 60)} tim ${durationMinutes % 60} min`}
        </button>
        <button className="map-chip" onClick={onOpenFilters}>
          Filter
        </button>
      </div>
      <div className="map-fab-row">
        <button className="map-fab" onClick={onOpenList} aria-label="Lista">
          ≡
        </button>
        <button className="map-fab" onClick={requestGeo} aria-label="Min position">
          ◎
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build --workspace @cheap-park/web`
Expected: clean. May warn about bundle size — fine.

- [ ] **Step 4: Commit**

```bash
git add apps/web/
git commit -m "feat(web): MapView with MapLibre + price-tier markers"
```

---

### Task 13: Wire it together in App.tsx

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`

`App.tsx` orchestrates: load data → show duration popup → show map → handle filter/detail/list overlays.

- [ ] **Step 1: Update `apps/web/src/styles.css`** — add fullscreen layout for the map

Append to existing `apps/web/src/styles.css`:

```css
.app-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.app-loading,
.app-error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 24px;
  text-align: center;
}

.app-error button {
  margin-top: 12px;
  padding: 10px 20px;
  background: var(--fg);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.stale-banner {
  background: var(--yellow);
  color: #000;
  padding: 8px 12px;
  font-size: 13px;
  text-align: center;
}
```

Also remove the existing `main { padding: 16px; }` rule — the app layout takes the full viewport now.

- [ ] **Step 2: Implement `App.tsx`**

Replace `apps/web/src/App.tsx`:

```tsx
import { useEffect, useState, useCallback } from "react";
import type { Parking } from "@cheap-park/tariff";
import { loadSnapshot, tariffFor, type Snapshot } from "./lib/data.js";
import { readState, writeState, defaultState, type AppState } from "./lib/url-state.js";
import { applyFilters, type FilterResult } from "./lib/filter.js";
import { ParkingDuration } from "./components/ParkingDuration.js";
import { MapView } from "./components/MapView.js";
import { DetailSheet } from "./components/DetailSheet.js";
import { FilterSheet } from "./components/FilterSheet.js";
import { ListView } from "./components/ListView.js";

const DATA_BASE = `${import.meta.env.BASE_URL}data`;
const STALE_DAYS = 7;

function isStale(generatedAt: Date): boolean {
  const ageDays = (Date.now() - generatedAt.getTime()) / (24 * 3600 * 1000);
  return ageDays > STALE_DAYS;
}

function pushUrlState(state: AppState) {
  const params = writeState(state);
  const queryString = params.toString();
  const url = queryString ? `?${queryString}` : window.location.pathname;
  window.history.replaceState(null, "", url);
}

export function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<AppState>(() =>
    readState(new URLSearchParams(window.location.search)),
  );

  // Show duration popup on first open if not already in URL
  const [durationOpen, setDurationOpen] = useState(() => {
    const initial = readState(new URLSearchParams(window.location.search));
    return initial.durationMinutes === null && !window.location.search.includes("duration");
  });

  const [filterOpen, setFilterOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [selected, setSelected] = useState<Parking | null>(null);

  useEffect(() => {
    loadSnapshot({ basePath: DATA_BASE })
      .then(setSnapshot)
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    pushUrlState(state);
  }, [state]);

  const onChooseDuration = useCallback((minutes: number | null) => {
    setState((s) => ({ ...s, durationMinutes: minutes }));
    setDurationOpen(false);
  }, []);

  const onApplyFilters = useCallback((filters: AppState["filters"]) => {
    setState((s) => ({ ...s, filters }));
    setFilterOpen(false);
  }, []);

  if (error) {
    return (
      <div className="app-shell">
        <div className="app-error">
          <h2>Kunde inte ladda data</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Försök igen</button>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="app-shell">
        <div className="app-loading">Laddar parkeringar…</div>
      </div>
    );
  }

  const filtered: FilterResult = applyFilters(snapshot.parkings, snapshot.tariffs, state, new Date());

  return (
    <div className="app-shell">
      {isStale(snapshot.generatedAt) && (
        <div className="stale-banner">
          Data senast uppdaterad {snapshot.generatedAt.toLocaleDateString("sv-SE")} — kan vara inaktuell.
        </div>
      )}
      {listOpen ? (
        <ListView
          visible={filtered.visible}
          dimmed={filtered.dimmed}
          tariffs={snapshot.tariffs}
          durationMinutes={state.durationMinutes}
          onSelect={(p) => {
            setSelected(p);
            setListOpen(false);
          }}
        />
      ) : (
        <MapView
          visible={filtered.visible}
          dimmed={filtered.dimmed}
          tariffs={snapshot.tariffs}
          durationMinutes={state.durationMinutes}
          onSelect={setSelected}
          onChangeDuration={() => setDurationOpen(true)}
          onOpenFilters={() => setFilterOpen(true)}
          onOpenList={() => setListOpen(true)}
        />
      )}

      {durationOpen && (
        <ParkingDuration initialMinutes={state.durationMinutes} onChoose={onChooseDuration} />
      )}

      <FilterSheet
        open={filterOpen}
        initial={state.filters}
        onApply={onApplyFilters}
        onClose={() => setFilterOpen(false)}
      />

      <DetailSheet
        parking={selected}
        tariff={selected ? tariffFor(selected, snapshot.tariffs) : null}
        durationMinutes={state.durationMinutes}
        onClose={() => setSelected(null)}
      />

      {listOpen && (
        <button
          onClick={() => setListOpen(false)}
          style={{
            position: "fixed",
            top: 12,
            right: 12,
            zIndex: 50,
            padding: "8px 14px",
            borderRadius: 20,
            background: "var(--surface)",
            border: "none",
            fontSize: 14,
            fontWeight: 600,
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            cursor: "pointer",
          }}
        >
          Karta
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run dev server and smoke-test manually**

Run: `npm run dev --workspace @cheap-park/web`
Open: http://localhost:5173/cheap_park/

Verify in browser:
1. Duration popup appears on first load.
2. Drag the slider — value updates ("1 tim", "1 tim 30 min", etc.); target time updates.
3. Click "Visa parkeringar" — popup closes, map appears with pins.
4. Pins are colored — should see green/yellow/red labels (assuming the data has tariffed parkings; if all data is `tariffId: null`, all will be grey "N/A").
5. Click a pin — DetailSheet slides up showing rate, total, max time, raw rules.
6. Tap "Filter" chip — FilterSheet opens. Toggle "Endast avgiftsfri" → "Visa". Map should update.
7. Tap ≡ button — list view appears, sorted cheapest-first.
8. Tap "Karta" button (top-right) — back to map.
9. Tap "Tid: …" chip — duration popup re-opens, can change duration.
10. Click "Vet ej" in duration popup — pins now show "X kr/h" instead of total.

Document any visual issues but don't try to fix them in this task — note them for follow-up.

Stop dev server (Ctrl+C).

- [ ] **Step 4: Verify build still works**

Run: `npm run build --workspace @cheap-park/web`
Expected: clean. Bundle size warning (>500 KB JS) is expected with maplibre — accept.

- [ ] **Step 5: Commit**

```bash
git add apps/web/
git commit -m "feat(web): wire App.tsx — orchestrate data, popup, map, sheets"
```

---

### Task 14: PWA manifest, service worker, and icons

**Files:**
- Create: `apps/web/public/icons/icon-192.png` (placeholder)
- Create: `apps/web/public/icons/icon-512.png` (placeholder)
- Create: `apps/web/public/icons/apple-touch-icon.png` (placeholder)
- Modify: `apps/web/vite.config.ts` to add PWA plugin
- Modify: `apps/web/index.html` to reference apple-touch-icon

- [ ] **Step 1: Generate placeholder icons**

These are temporary plain-color PNGs. Real icons should be designed later.

Run from repo root:

```bash
node -e "
const fs = require('node:fs');
const path = require('node:path');
const dir = 'apps/web/public/icons';
fs.mkdirSync(dir, { recursive: true });

// Smallest possible solid-color PNG (1x1 then upscaled by browser/PWA tooling).
// 1x1 dark blue PNG, base64.
const png = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63646060000000050001a4af0c170000000049454e44ae426082',
  'hex'
);

for (const name of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
  fs.writeFileSync(path.join(dir, name), png);
}
console.log('icons written');
"
```

These are 1×1 pixel placeholders. The PWA install prompt will accept them; the home-screen icon will be a tiny blob until real icons are added. Acceptable for MVP.

- [ ] **Step 2: Update `apps/web/vite.config.ts` to enable PWA**

Replace `apps/web/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Cheap Park",
        short_name: "Cheap Park",
        description: "Hitta billigaste parkeringen i Göteborg",
        theme_color: "#0a0a0a",
        background_color: "#f4f4f6",
        display: "standalone",
        start_url: "/cheap_park/",
        scope: "/cheap_park/",
        lang: "sv",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,json}"],
        runtimeCaching: [
          {
            urlPattern: /\/data\/.*\.json$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "parking-data",
              expiration: { maxAgeSeconds: 7 * 24 * 3600 },
            },
          },
        ],
      },
    }),
  ],
  base: "/cheap_park/",
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    port: 5173,
  },
});
```

- [ ] **Step 3: Update `apps/web/index.html` to reference apple-touch-icon**

Replace `apps/web/index.html`:

```html
<!doctype html>
<html lang="sv">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/cheap_park/icons/icon-192.png" />
    <link rel="apple-touch-icon" href="/cheap_park/icons/apple-touch-icon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0a0a0a" />
    <meta name="description" content="Hitta billigaste parkeringen i Göteborg" />
    <title>Cheap Park — Göteborg</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Verify build produces manifest + service worker**

Run: `npm run build --workspace @cheap-park/web`
Then: `ls apps/web/dist/`
Expected to see: `manifest.webmanifest`, `sw.js`, `registerSW.js`, `index.html`, `assets/*`, `icons/*`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/
git commit -m "feat(web): PWA manifest, service worker, placeholder icons"
```

---

### Task 15: Deploy to GitHub Pages

**Files:**
- Create: `.github/workflows/deploy-web.yml`
- Modify: `CLAUDE.md` (append deployment note)

The workflow builds the web app on push to main and deploys to GitHub Pages.

- [ ] **Step 1: Create the deploy workflow**

Create `.github/workflows/deploy-web.yml`:

```yaml
name: Deploy web app to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - "apps/web/**"
      - "packages/tariff/**"
      - ".github/workflows/deploy-web.yml"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run lib tests
        run: npm test --workspace @cheap-park/web

      - name: Build web app
        run: npm run build --workspace @cheap-park/web

      - name: Copy data into build output
        run: |
          mkdir -p apps/web/dist/data
          cp apps/web/public/data/parkings.json apps/web/dist/data/parkings.json
          cp apps/web/public/data/tariffs.json apps/web/dist/data/tariffs.json

      - uses: actions/upload-pages-artifact@v3
        with:
          path: apps/web/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

Note: `actions/upload-pages-artifact@v3` and `actions/deploy-pages@v4` are stable. `vite-plugin-pwa` already copies `public/` into `dist/`, so the explicit `cp` step is redundant in normal builds — but it's defensive against any plugin path quirks.

- [ ] **Step 2: Append deployment note to `CLAUDE.md`**

Append to `D:\src\cheap_park\CLAUDE.md`:

```markdown
## Deployment

Webbappen deployas till GitHub Pages via `.github/workflows/deploy-web.yml`
vid push till `main` som rör `apps/web/**` eller `packages/tariff/**`.

Live-URL: https://shakyhandz.github.io/cheap_park/

För att aktivera Pages första gången:
1. Repo Settings → Pages → Source: "GitHub Actions"
2. Pusha en commit som triggar workflow:en (eller kör Actions → "Deploy web app to GitHub Pages" → Run workflow)
3. Första körningen tar ~1–2 min, sedan är sajten live
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-web.yml CLAUDE.md
git commit -m "ci: deploy web app to GitHub Pages on push to main"
```

- [ ] **Step 4: Verify after pushing**

This step is verification, not implementation. After this branch merges to main:

1. Push the branch to origin.
2. Repo Settings → Pages → confirm Source = "GitHub Actions".
3. Actions tab → "Deploy web app to GitHub Pages" → wait for first run to complete.
4. Visit https://shakyhandz.github.io/cheap_park/ — should show the duration popup.
5. Test full flow per Task 13 Step 3 (smoke test list) on a real mobile device.

If anything fails here, fix the workflow and push a new commit. This is the deploy-and-observe loop.

---

### Task 16: Manual smoke test guide

**Files:**
- Create: `apps/web/README.md`

Documents how to develop locally and what to verify before each deploy.

- [ ] **Step 1: Create `apps/web/README.md`**

Create `D:\src\cheap_park\apps\web\README.md`:

```markdown
# @cheap-park/web

Mobil PWA som visar parkeringspriser i Göteborg på en karta.

## Local development

```sh
npm install
npm run dev --workspace @cheap-park/web
```

Öppna http://localhost:5173/cheap_park/ — appen körs mot
`apps/web/public/data/parkings.json` (snapshot:en som poller-cron:en
committar dagligen).

## Tests

```sh
npm test --workspace @cheap-park/web
```

Tester ligger i `src/tests/` och täcker `lib/`-funktioner.
UI-komponenter testas manuellt (smoke-listan nedan).

## Manual smoke test (innan PR / deploy)

Öppna i mobil-Chrome / mobil-Safari (eller dev tools mobil-emulator).
Klicka igenom:

1. **Duration popup** öppnas vid första laddningen.
2. **Slider** funkar — minutvärde + måltid uppdateras.
3. **"Visa parkeringar"** stänger popup → karta renderas med pins.
4. **Pin-färger** är gröna/gula/röda relativt zoom-nivån (eller grå för N/A).
5. **Tap på pin** → DetailSheet visar pris, regler, vägbeskrivnings-knapp.
6. **"Vägbeskrivning"** öppnar Google Maps i ny flik med rätt koordinater.
7. **Filter-chip** öppnar FilterSheet → toggle "avgiftsfri" → "Visa" filtrerar kartan.
8. **≡-knapp** byter till listvy, sorterad billigast först.
9. **"Karta"-knapp** byter tillbaka till kartan.
10. **"Tid:"-chip** öppnar duration-popup; "Vet ej" visar timpris istället för totalkostnad.
11. **Stale-banner** visas om data är >7 dagar gammal (kan testas genom att tillfälligt sätta `parkings.json:generatedAt` till ett gammalt datum lokalt).

## Build

```sh
npm run build --workspace @cheap-park/web
```

Output i `apps/web/dist/`. Auto-deployas till GitHub Pages via
`.github/workflows/deploy-web.yml` vid push till `main`.

## Architecture notes

- **State:** URL query (`?duration=60&free=1&max=30`) är källan. Back-button
  fungerar förutsägbart, delningslänkar bevarar filter.
- **Data:** Statisk JSON från `/data/parkings.json` + `/data/tariffs.json`,
  cacheas av service worker (StaleWhileRevalidate, 7 dagars TTL).
- **Map:** MapLibre GL JS + raw OpenStreetMap-tiles. Inga API-nycklar.
- **Pris-tier (grön/gul/röd):** beräknas relativt nuvarande viewport-prisbild,
  inte absoluta tröskelvärden. Centrum = allt rött funkar inte → vi vill att
  färgen säger något oavsett zonnivå.
- **Geolocation:** lazy via `useGeolocation` hook. Avslag faller tillbaka
  till Brunnsparken-koordinaten.
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/README.md
git commit -m "docs(web): development guide and manual smoke test list"
```

---

## Plan complete

After Task 16, the web app is:

- Deployed to GitHub Pages at `https://shakyhandz.github.io/cheap_park/`
- Consuming `parkings.json` + `tariffs.json` daily snapshots
- Supporting the full UX per the spec (duration popup, map, filter, list, detail sheet)
- A PWA installable to home screen
- Responsive enough for mobile devices

Outstanding items deferred per spec:
- Real designed PWA icons (placeholders are 1×1 PNGs)
- Adress-sökruta (fas 1.5)
- Helgdagar i tariff-modellen (fas 1.5)
- P-hus från privata operatörer (fas 2)
- Beläggning / lediga platser (fas 2)
- Native iOS/Android via Capacitor (fas 3)
