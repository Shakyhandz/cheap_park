import type { Tariff } from "@cheap-park/tariff";
import { priceNow } from "@cheap-park/tariff";
import { tariffFor } from "./data.js";
import type { ClientParking } from "./client-model.js";
import type { AppState } from "./url-state.js";

export type FilterResult = { visible: ClientParking[]; dimmed: ClientParking[] };

function passesFilters(
  parking: ClientParking, tariffs: Map<string, Tariff>, state: AppState, now: Date,
): boolean {
  const tariff = tariffFor(parking, tariffs);
  const rate = priceNow(tariff, now, parking.ctx);

  if (state.filters.free && rate !== "free") return false;
  if (state.filters.accessible && !parking.accessible) return false;
  if (state.filters.longTerm) {
    const max = parking.maxParkingMinutes;
    if (max !== null && max < 360) return false;
  }
  if (state.filters.maxPricePerHour !== null) {
    if (rate === "n/a") return false;
    if (rate !== "free" && rate > state.filters.maxPricePerHour) return false;
  }
  return true;
}

export function applyFilters(
  parkings: ClientParking[], tariffs: Map<string, Tariff>, state: AppState, now: Date,
): FilterResult {
  const visible: ClientParking[] = [];
  const dimmed: ClientParking[] = [];
  for (const parking of parkings) {
    if (!passesFilters(parking, tariffs, state, now)) continue;
    const duration = state.durationMinutes;
    if (duration !== null && parking.maxParkingMinutes !== null && parking.maxParkingMinutes < duration) {
      dimmed.push(parking);
    } else {
      visible.push(parking);
    }
  }
  return { visible, dimmed };
}
