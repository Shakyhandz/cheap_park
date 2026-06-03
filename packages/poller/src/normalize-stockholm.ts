import type { ParkingFeature, ParkingGeometry } from "@cheap-park/tariff";
import type { RawStockholmFC, RawStockholmFeature } from "./fetch-stockholm.js";
import { matchStockholmTariff } from "./tariff-templates-stockholm.js";
import { roundGeometry } from "./geometry.js";

function asString(v: unknown): string {
  return v == null ? "" : String(v);
}

function toGeometry(raw: RawStockholmFeature["geometry"]): ParkingGeometry | null {
  if (!raw) return null;
  if (raw.type === "LineString") return { type: "LineString", coordinates: raw.coordinates as [number, number][] };
  if (raw.type === "MultiLineString") return { type: "MultiLineString", coordinates: raw.coordinates as [number, number][][] };
  if (raw.type === "Point") return { type: "Point", coordinates: raw.coordinates as [number, number] };
  return null;
}

export function normalizeStockholm(fc: RawStockholmFC): ParkingFeature[] {
  const out: ParkingFeature[] = [];
  for (const raw of fc.features) {
    if (asString(raw.properties["VEHICLE"]) !== "fordon") continue;
    const geom = toGeometry(raw.geometry);
    if (!geom) continue;

    const citation = asString(raw.properties["CITATION"]).trim();
    if (!citation) continue;

    const rate = asString(raw.properties["PARKING_RATE"]).trim();
    const tariffId = rate ? matchStockholmTariff(rate) : null;

    out.push({
      type: "Feature",
      geometry: roundGeometry(geom),
      properties: {
        id: `sthlm:${citation}`,
        city: "stockholm",
        vehicle: "bilar",
        name: asString(raw.properties["STREET_NAME"]) || citation,
        provider: "Stockholms stad",
        tariffId,
        rulesText: rate || "Inga regler tillgängliga",
        accessible: false, // cars-only feed; rörelsehindrad rows are excluded
        spaces: null,
        maxParkingMinutes: null,
      },
    });
  }
  // Preserve every segment: citations can repeat across segments of one regulation.
  // Append a positional suffix to later duplicates so no street segment is dropped.
  const counts = new Map<string, number>();
  return out
    .map((f) => {
      const base = f.properties.id;
      const n = counts.get(base) ?? 0;
      counts.set(base, n + 1);
      if (n > 0) f.properties.id = `${base}#${n}`;
      return f;
    })
    .sort((a, b) => a.properties.id.localeCompare(b.properties.id));
}
