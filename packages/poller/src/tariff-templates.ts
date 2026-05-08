import type { Tariff, TariffRule } from "@cheap-park/tariff";

type RawShape = { ParkingCost?: unknown; MaxParkingTime?: unknown };

// Lazy registry of tariffs encountered during a poll. Populated by matchTariff
// as each parking is processed; read by main.ts when assembling tariffs.json.
const REGISTRY = new Map<string, Tariff>();

export function getRegisteredTariffs(): Tariff[] {
  return [...REGISTRY.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function resetRegistry(): void {
  REGISTRY.clear();
}

/**
 * Parse a duration string into minutes. Accepts:
 *   - plain number string ("30") → 30
 *   - "30 min" → 30
 *   - "2 tim" → 120
 *   - "1 tim 30 min" → 90
 *   - number → returned as-is
 */
export function parseDurationMinutes(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim().toLowerCase();
  if (s === "") return null;

  const both = s.match(/^(\d+)\s*tim\s+(\d+)\s*min$/);
  if (both) return parseInt(both[1]!, 10) * 60 + parseInt(both[2]!, 10);

  const tim = s.match(/^(\d+)\s*tim$/);
  if (tim) return parseInt(tim[1]!, 10) * 60;

  const min = s.match(/^(\d+)\s*min$/);
  if (min) return parseInt(min[1]!, 10);

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function freePocketTariff(minutes: number): Tariff {
  return {
    id: `free-${minutes}min`,
    name: `Avgiftsfri ${minutes} min`,
    rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }],
  };
}

function paidTariff(args: {
  rawRate: number;
  isHalfHour: boolean;
  dayStart: number;
  dayEnd: number;
  offRate: number;
  cap: number | null;
}): Tariff {
  const { rawRate, isHalfHour, dayStart, dayEnd, offRate, cap } = args;
  const peakRate = isHalfHour ? rawRate * 2 : rawRate;
  const granularity = isHalfHour ? "h30" : "h60";
  const id = `paid-${granularity}-${rawRate}-${dayStart}-${dayEnd}-off${offRate}${cap !== null ? `-cap${cap}` : ""}`;

  const rateLabel = isHalfHour ? `${rawRate} kr/30 min` : `${rawRate} kr/h`;
  const offLabel = offRate > 0 ? `, övrigt ${offRate} kr/h` : "";
  const capLabel = cap !== null ? `, max ${cap} kr/dygn` : "";
  const name = `${rateLabel} ${dayStart}-${dayEnd}${offLabel}${capLabel}`;

  const peakRule: TariffRule = {
    daysOfWeek: [],
    hourStart: dayStart,
    hourEnd: dayEnd,
    pricePerHour: peakRate,
    ...(cap !== null ? { maxPerDay: cap } : {}),
  };
  const rules: TariffRule[] = [peakRule];

  if (offRate > 0) {
    if (dayStart > 0) {
      rules.push({
        daysOfWeek: [],
        hourStart: 0,
        hourEnd: dayStart,
        pricePerHour: offRate,
      });
    }
    if (dayEnd < 24) {
      rules.push({
        daysOfWeek: [],
        hourStart: dayEnd,
        hourEnd: 24,
        pricePerHour: offRate,
      });
    }
  }

  return { id, name, rules };
}

function parsePaidPattern(cost: string): Tariff | null {
  const hourly = cost.match(/^(\d+)\s*kr\/tim\s+(\d+)-(\d+)/i);
  const halfHour = cost.match(/^(\d+)\s*kr\/30\s*min\s+(\d+)-(\d+)/i);
  if (!hourly && !halfHour) return null;

  const m = hourly ?? halfHour!;
  const rawRate = parseInt(m[1]!, 10);
  const dayStart = parseInt(m[2]!, 10);
  const dayEnd = parseInt(m[3]!, 10);

  const offMatch = cost.match(/övrig tid:?\s*(\d+)\s*kr\/tim/i);
  const offRate = offMatch ? parseInt(offMatch[1]!, 10) : 0;

  const capMatch = cost.match(/maxtaxa\s+(\d+)\s*kr\/dag/i);
  const cap = capMatch ? parseInt(capMatch[1]!, 10) : null;

  return paidTariff({
    rawRate,
    isHalfHour: !!halfHour,
    dayStart,
    dayEnd,
    offRate,
    cap,
  });
}

export function matchTariff(raw: RawShape): string | null {
  const cost = typeof raw.ParkingCost === "string" ? raw.ParkingCost : "";
  const maxMinutes = parseDurationMinutes(raw.MaxParkingTime);

  // Free pocket from explicit "Avgiftsfri" cost
  if (cost.toLowerCase().includes("avgiftsfri") && maxMinutes !== null) {
    const t = freePocketTariff(maxMinutes);
    REGISTRY.set(t.id, t);
    return t.id;
  }

  // Free pocket from PublicTimeParkings (empty cost + numeric maxtime)
  if (!cost && maxMinutes !== null) {
    const t = freePocketTariff(maxMinutes);
    REGISTRY.set(t.id, t);
    return t.id;
  }

  // Paid hourly / 30-min patterns
  const paid = parsePaidPattern(cost);
  if (paid) {
    REGISTRY.set(paid.id, paid);
    return paid.id;
  }

  return null;
}

/**
 * Backwards-compatible export: list of tariffs registered so far. Updated as
 * matchTariff runs. Equivalent to getRegisteredTariffs() but exposed as a
 * getter property to match the old static-array import surface.
 */
export const KNOWN_TARIFFS = new Proxy([] as Tariff[], {
  get(_target, prop) {
    const tariffs = getRegisteredTariffs();
    if (prop === "length") return tariffs.length;
    if (prop === Symbol.iterator) return tariffs[Symbol.iterator].bind(tariffs);
    if (typeof prop === "string" && /^\d+$/.test(prop)) {
      return tariffs[parseInt(prop, 10)];
    }
    const value = (tariffs as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(tariffs) : value;
  },
});
