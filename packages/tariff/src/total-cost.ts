import { ruleAppliesAt, type EvalContext } from "./days.js";
import { wallClockParts, instantForZonedTime } from "./wallclock.js";
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
 * Earliest boundary strictly after `from`, capped at `hardEnd`, where the
 * active rule changes. Candidates are every rule hourStart/hourEnd today plus
 * the next local midnight (covers weekday + day-class transitions).
 */
function nextBoundary(tariff: Tariff, from: Date, hardEnd: Date, ctx: EvalContext): Date {
  const wc = wallClockParts(from, ctx.timeZone);
  // Resolve every candidate boundary through the zone's actual offset rather
  // than adding hours to a presumed-24h local day. This is DST-correct: on a
  // fall-back/spring-forward day the local day is 23 or 25 real hours, so a
  // "07:00 local" boundary must be looked up via instantForZonedTime.
  const hours = new Set<number>([24]); // next local midnight
  for (const rule of tariff.rules) {
    hours.add(rule.hourStart);
    hours.add(rule.hourEnd);
  }
  const candidates: number[] = [];
  for (const h of hours) {
    candidates.push(
      instantForZonedTime(ctx.timeZone, wc.year, wc.month, wc.day, h).getTime(),
    );
  }

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

  // Note: despite the field name `maxPerDay`, this cap is applied once to
  // the entire session total, not per calendar day. Multi-day durations
  // will be undercapped. Per-day enforcement is out of scope for MVP.
  const cap = tariff.rules.find((r) => r.maxPerDay != null)?.maxPerDay ?? null;
  if (cap != null && total > cap) total = cap;

  return { total: Math.round(total * 100) / 100, breakdown: segments };
}
