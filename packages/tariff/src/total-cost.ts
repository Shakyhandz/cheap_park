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
