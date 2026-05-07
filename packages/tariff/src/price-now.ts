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
