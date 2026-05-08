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

  const min = numbers[0]!;
  const max = numbers[numbers.length - 1]!;
  const range = max - min;
  const t1 = min + range / 3;
  const t2 = min + (range * 2) / 3;

  if (price <= t1) return "green";
  if (price <= t2) return "yellow";
  return "red";
}
