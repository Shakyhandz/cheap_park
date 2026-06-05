export type Tier = "green" | "yellow" | "red" | "grey";

/**
 * The bottom/middle tertile cut points for a viewport's price population,
 * computed once so a whole feature collection can be classified in O(n) via
 * {@link tierForPrice} instead of re-sorting per feature.
 */
export type ViewportTiers = { t1: number; t2: number; hasNumbers: boolean };

export function computeViewportTiers(viewport: (number | null)[]): ViewportTiers {
  const numbers = viewport
    .filter((p): p is number => typeof p === "number" && p > 0)
    .sort((a, b) => a - b);

  if (numbers.length === 0) return { t1: 0, t2: 0, hasNumbers: false };

  const min = numbers[0]!;
  const max = numbers[numbers.length - 1]!;
  const range = max - min;
  return { t1: min + range / 3, t2: min + (range * 2) / 3, hasNumbers: true };
}

/**
 * Classifies `price` against precomputed tertile thresholds. `null` means n/a
 * (no tariff → grey); 0 means free (→ green).
 *
 * Tiers: green = bottom third or free; yellow = middle third; red = top third;
 * grey = unknown.
 */
export function tierForPrice(price: number | null, tiers: ViewportTiers): Tier {
  if (price === null) return "grey";
  if (price === 0) return "green";
  if (!tiers.hasNumbers) return "green";
  if (price <= tiers.t1) return "green";
  if (price <= tiers.t2) return "yellow";
  return "red";
}

/**
 * Returns the color tier for `price` relative to the population of `viewport`
 * prices. Convenience wrapper that recomputes thresholds each call — for bulk
 * classification prefer {@link computeViewportTiers} + {@link tierForPrice}.
 */
export function tierForViewport(viewport: (number | null)[], price: number | null): Tier {
  return tierForPrice(price, computeViewportTiers(viewport));
}
