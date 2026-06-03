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
  lastCounts: Partial<Record<CityId, number>>,
  newCounts: Partial<Record<CityId, number>>,
): SanityResult {
  for (const city of Object.keys(lastCounts) as CityId[]) {
    const r = sanityCheckCity({
      city,
      newCount: newCounts[city] ?? 0,
      lastCount: lastCounts[city] ?? 0,
    });
    if (!r.ok) return r;
  }
  return { ok: true };
}
