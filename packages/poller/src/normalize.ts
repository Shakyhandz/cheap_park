import type { ParkingFeature } from "@cheap-park/tariff";
import type { RawParking } from "./fetch.js";
import { matchTariff, parseDurationMinutes } from "./tariff-templates.js";

const ACCESSIBLE_RE = /rörelsehindrade|handikapp|permit/i;

function asString(v: unknown): string {
  return v == null ? "" : String(v);
}
function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function rulesTextOf(raw: RawParking): string {
  const parts: string[] = [];
  for (const k of ["ParkingCost", "MaxParkingTimeLimitation", "ExtraInfo"]) {
    const v = raw[k];
    if (v != null && String(v) !== "") parts.push(String(v));
  }
  return parts.join("\n") || "Inga regler tillgängliga";
}

function toFeature(raw: RawParking): ParkingFeature | null {
  const lat = asNumber(raw.Lat);
  const lng = asNumber(raw.Long);
  if (lat == null || lng == null) return null;
  const id = asString(raw.Id);
  if (!id) return null;

  const cost = asString(raw["ParkingCost"]);
  const tariffId = matchTariff({ ParkingCost: cost, MaxParkingTime: raw["MaxParkingTime"] });
  const extra = asString(raw["ExtraInfo"]);

  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: {
      id: `gbg:${id}`,
      city: "goteborg",
      vehicle: "bilar",
      name: asString(raw.Name),
      provider: asString(raw.Owner),
      tariffId,
      rulesText: rulesTextOf(raw),
      accessible: ACCESSIBLE_RE.test(extra),
      spaces: asNumber(raw["ParkingSpaces"]) ?? 0,
      maxParkingMinutes: parseDurationMinutes(raw["MaxParkingTime"]),
    },
  };
}

export function normalize(input: { toll: RawParking[]; time: RawParking[] }): ParkingFeature[] {
  const seen = new Set<string>();
  const out: ParkingFeature[] = [];
  // Toll first so its records win on dedup.
  for (const r of [...input.toll, ...input.time]) {
    const f = toFeature(r);
    if (!f) continue;
    if (seen.has(f.properties.id)) continue;
    seen.add(f.properties.id);
    out.push(f);
  }
  return out.sort((a, b) => a.properties.id.localeCompare(b.properties.id));
}
