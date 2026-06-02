import { describe, expect, it } from "vitest";
import { flattenCollection } from "../lib/client-model.js";
import type { ParkingFeatureCollection } from "@cheap-park/tariff";

const fc: ParkingFeatureCollection = {
  type: "FeatureCollection",
  generatedAt: "2026-05-30T04:00:00Z",
  cities: {
    goteborg: { source: "g", timeZone: "Europe/Stockholm", holidayCalendar: "SE", center: [11.97, 57.71] },
    stockholm: { source: "s", timeZone: "Europe/Stockholm", holidayCalendar: "SE", center: [18.07, 59.33] },
  },
  features: [
    { type: "Feature", geometry: { type: "Point", coordinates: [11.92, 57.68] },
      properties: { id: "gbg:1", city: "goteborg", vehicle: "bilar", name: "G", provider: "P", tariffId: "t", rulesText: "r", accessible: true, spaces: 5, maxParkingMinutes: 30 } },
    { type: "Feature", geometry: { type: "LineString", coordinates: [[18.0, 59.0], [18.0, 59.2]] },
      properties: { id: "sthlm:1", city: "stockholm", vehicle: "bilar", name: "S", provider: "Q", tariffId: null, rulesText: "taxa", accessible: false, spaces: null, maxParkingMinutes: null } },
  ],
};

describe("flattenCollection", () => {
  it("derives displayPoint and attaches city ctx", () => {
    const out = flattenCollection(fc);
    const sthlm = out.find((p) => p.id === "sthlm:1")!;
    expect(sthlm.displayPoint.lat).toBeCloseTo(59.1, 5);
    expect(sthlm.displayPoint.lng).toBeCloseTo(18.0, 5);
    expect(sthlm.ctx).toEqual({ timeZone: "Europe/Stockholm", calendar: "SE" });
    expect(sthlm.geometry.type).toBe("LineString");

    const gbg = out.find((p) => p.id === "gbg:1")!;
    expect(gbg.displayPoint).toEqual({ lat: 57.68, lng: 11.92 });
    expect(gbg.accessible).toBe(true);
  });
});
