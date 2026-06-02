import type { ParkingGeometry } from "@cheap-park/tariff";

export function roundCoord(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

export function roundGeometry(g: ParkingGeometry): ParkingGeometry {
  if (g.type === "Point") {
    return { type: "Point", coordinates: [roundCoord(g.coordinates[0]), roundCoord(g.coordinates[1])] };
  }
  if (g.type === "LineString") {
    return { type: "LineString", coordinates: g.coordinates.map((c) => [roundCoord(c[0]), roundCoord(c[1])]) };
  }
  return {
    type: "MultiLineString",
    coordinates: g.coordinates.map((line) => line.map((c) => [roundCoord(c[0]), roundCoord(c[1])])),
  };
}

export function midpointOf(g: ParkingGeometry): { lat: number; lng: number } {
  if (g.type === "Point") return { lat: g.coordinates[1], lng: g.coordinates[0] };
  const pts: [number, number][] =
    g.type === "LineString" ? g.coordinates : g.coordinates.flat();
  let sumLng = 0, sumLat = 0;
  for (const [lng, lat] of pts) { sumLng += lng; sumLat += lat; }
  return { lat: roundCoord(sumLat / pts.length), lng: roundCoord(sumLng / pts.length) };
}
