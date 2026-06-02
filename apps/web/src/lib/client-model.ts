import type {
  ParkingFeatureCollection, ParkingGeometry, CityId, EvalContext,
} from "@cheap-park/tariff";

export type ClientParking = {
  id: string;
  city: CityId;
  name: string;
  provider: string;
  geometry: ParkingGeometry;
  displayPoint: { lat: number; lng: number };
  tariffId: string | null;
  rulesText: string;
  accessible: boolean;
  spaces: number | null;
  maxParkingMinutes: number | null;
  ctx: EvalContext;
};

function midpoint(g: ParkingGeometry): { lat: number; lng: number } {
  if (g.type === "Point") return { lat: g.coordinates[1], lng: g.coordinates[0] };
  const pts = g.type === "LineString" ? g.coordinates : g.coordinates.flat();
  let lat = 0, lng = 0;
  for (const [x, y] of pts) { lng += x; lat += y; }
  return { lat: lat / pts.length, lng: lng / pts.length };
}

export function flattenCollection(fc: ParkingFeatureCollection): ClientParking[] {
  return fc.features.map((f) => {
    const meta = fc.cities[f.properties.city];
    return {
      id: f.properties.id,
      city: f.properties.city,
      name: f.properties.name,
      provider: f.properties.provider,
      geometry: f.geometry,
      displayPoint: midpoint(f.geometry),
      tariffId: f.properties.tariffId,
      rulesText: f.properties.rulesText,
      accessible: f.properties.accessible,
      spaces: f.properties.spaces,
      maxParkingMinutes: f.properties.maxParkingMinutes,
      ctx: { timeZone: meta.timeZone, calendar: meta.holidayCalendar },
    };
  });
}
