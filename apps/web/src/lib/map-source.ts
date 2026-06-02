import type { Tariff } from "@cheap-park/tariff";
import { tariffFor } from "./data.js";
import { hourlyRate, priceLabel, totalLabel } from "./prices.js";
import { tierForViewport, type Tier } from "./colors.js";
import type { ClientParking } from "./client-model.js";

export type MapFeatureProps = {
  id: string; tier: Tier; dimmed: boolean; label: string;
};
export type MapFeature = {
  type: "Feature";
  geometry: ClientParking["geometry"];
  properties: MapFeatureProps;
};
export type MapSource = { type: "FeatureCollection"; features: MapFeature[] };

export function buildMapSource(
  visible: ClientParking[],
  dimmed: ClientParking[],
  tariffs: Map<string, Tariff>,
  durationMinutes: number | null,
  now: Date,
): MapSource {
  const all = [...visible, ...dimmed];
  const dimmedIds = new Set(dimmed.map((p) => p.id));
  const rates = all.map((p) => hourlyRate(tariffFor(p, tariffs), now, p.ctx));

  return {
    type: "FeatureCollection",
    features: all.map((p, i) => {
      const tariff = tariffFor(p, tariffs);
      const label =
        durationMinutes !== null
          ? totalLabel(tariff, now, durationMinutes, p.ctx)
          : priceLabel(tariff, now, p.ctx);
      return {
        type: "Feature",
        geometry: p.geometry,
        properties: {
          id: p.id,
          tier: tierForViewport(rates, rates[i] ?? null),
          dimmed: dimmedIds.has(p.id),
          label,
        },
      };
    }),
  };
}
