import type { Parking } from "@cheap-park/tariff";
import type { RawParking } from "./fetch.js";
import { matchTariff, parseDurationMinutes } from "./tariff-templates.js";

const RAW_FIELDS_TO_KEEP = [
  "ParkingCost",
  "ParkingCharge",
  "MaxParkingTime",
  "MaxParkingTimeLimitation",
  "ExtraInfo",
];

function asString(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toParking(raw: RawParking): Parking | null {
  const lat = asNumber(raw.Lat);
  const lng = asNumber(raw.Long);
  if (lat == null || lng == null) return null;

  const id = asString(raw.Id);
  if (!id) return null;

  const rawSubset: Record<string, string> = {};
  for (const key of RAW_FIELDS_TO_KEEP) {
    const v = raw[key];
    if (v != null) rawSubset[key] = asString(v);
  }

  // matchTariff expects ParkingCost+MaxParkingTime as strings
  const tariffId = matchTariff({
    ParkingCost: rawSubset["ParkingCost"],
    MaxParkingTime: rawSubset["MaxParkingTime"],
  });

  return {
    id,
    name: asString(raw.Name),
    owner: asString(raw.Owner),
    lat,
    lng,
    spaces: asNumber(raw["ParkingSpaces"]) ?? 0,
    tariffId,
    maxParkingMinutes: parseDurationMinutes(rawSubset["MaxParkingTime"]),
    raw: rawSubset,
  };
}

export function normalize(input: { toll: RawParking[]; time: RawParking[] }): Parking[] {
  const seen = new Set<string>();
  const out: Parking[] = [];

  // Toll first so its records win on dedup.
  for (const r of [...input.toll, ...input.time]) {
    const p = toParking(r);
    if (!p) continue;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }

  return out.sort((a, b) => a.id.localeCompare(b.id));
}
