import type { Parking, Tariff } from "@cheap-park/tariff";
import { priceNow } from "@cheap-park/tariff";
import { tariffFor } from "./data.js";
import type { AppState } from "./url-state.js";

const ACCESSIBLE_RE = /rörelsehindrade|handikapp|permit/i;

export type FilterResult = {
  visible: Parking[];
  dimmed: Parking[];
};

function isAccessible(parking: Parking): boolean {
  const extra = parking.raw["ExtraInfo"] ?? "";
  return ACCESSIBLE_RE.test(extra);
}

function passesFilters(
  parking: Parking,
  tariffs: Map<string, Tariff>,
  state: AppState,
  now: Date,
): boolean {
  const tariff = tariffFor(parking, tariffs);
  const rate = priceNow(tariff, now);

  if (state.filters.free && rate !== "free") return false;
  if (state.filters.accessible && !isAccessible(parking)) return false;
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
  parkings: Parking[],
  tariffs: Map<string, Tariff>,
  state: AppState,
  now: Date,
): FilterResult {
  const visible: Parking[] = [];
  const dimmed: Parking[] = [];

  for (const parking of parkings) {
    if (!passesFilters(parking, tariffs, state, now)) continue;

    const duration = state.durationMinutes;
    if (
      duration !== null &&
      parking.maxParkingMinutes !== null &&
      parking.maxParkingMinutes < duration
    ) {
      dimmed.push(parking);
    } else {
      visible.push(parking);
    }
  }

  return { visible, dimmed };
}
