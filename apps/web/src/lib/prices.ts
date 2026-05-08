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
