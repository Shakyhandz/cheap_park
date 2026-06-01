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
