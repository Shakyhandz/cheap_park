import type { Tariff } from "@cheap-park/tariff";

export const KNOWN_TARIFFS: Tariff[] = [
  {
    id: "free-10min",
    name: "Avgiftsfri 10 min",
    rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }],
  },
  {
    id: "free-15min",
    name: "Avgiftsfri 15 min",
    rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }],
  },
  {
    id: "free-30min",
    name: "Avgiftsfri 30 min",
    rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }],
  },
];

type RawShape = { ParkingCost?: unknown; MaxParkingTime?: unknown };

export function matchTariff(raw: RawShape): string | null {
  const cost = typeof raw.ParkingCost === "string" ? raw.ParkingCost.toLowerCase() : "";
  const maxStr = typeof raw.MaxParkingTime === "string" ? raw.MaxParkingTime : "";

  if (!cost) return null;

  if (cost.includes("avgiftsfri")) {
    if (maxStr === "10") return "free-10min";
    if (maxStr === "15") return "free-15min";
    if (maxStr === "30") return "free-30min";
  }

  // TODO: add paid-zone templates when we capture real fixtures from the live API.
  // The plan for this lives in spec § "Tariff-täckning".

  return null;
}
