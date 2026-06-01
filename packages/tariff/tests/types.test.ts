import { describe, expect, it } from "vitest";
import type {
  ParkingFeature, ParkingFeatureCollection, CityMeta, CityId, Vehicle,
} from "../src/types.js";

describe("unified GeoJSON types", () => {
  it("a Point feature compiles and round-trips", () => {
    const f: ParkingFeature = {
      type: "Feature",
      geometry: { type: "Point", coordinates: [11.92, 57.68] },
      properties: {
        id: "gbg:1", city: "goteborg", vehicle: "bilar", name: "X",
        provider: "Y", tariffId: "t1", rulesText: "…", accessible: false,
        spaces: 10, maxParkingMinutes: 30,
      },
    };
    const fc: ParkingFeatureCollection = {
      type: "FeatureCollection",
      generatedAt: "2026-05-30T04:00:00Z",
      cities: {
        goteborg: { source: "s", timeZone: "Europe/Stockholm", holidayCalendar: "SE", center: [11.97, 57.71] },
      } as Record<CityId, CityMeta>,
      features: [f],
    };
    expect(fc.features[0]!.properties.city).toBe("goteborg");
    const v: Vehicle = "bilar";
    expect(v).toBe("bilar");
  });
});
