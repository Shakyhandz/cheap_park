import { describe, expect, it, beforeEach } from "vitest";
import { runPoll } from "../src/main.js";
import { resetRegistry } from "../src/tariff-templates.js";
import { resetStockholmRegistry } from "../src/tariff-templates-stockholm.js";
import type { ParkingFeatureCollection } from "@cheap-park/tariff";

const gbgRaw = {
  toll: [{
    Id: "1", Name: "G", Owner: "Stad", Lat: 57.7, Long: 11.97, ParkingSpaces: 5,
    ParkingCost: "avgiftsfri", MaxParkingTime: "30 min",
  }],
  time: [],
};
const sthlmRaw = {
  type: "FeatureCollection" as const,
  features: [{
    type: "Feature" as const,
    geometry: { type: "LineString", coordinates: [[18.06, 59.33], [18.061, 59.331]] },
    properties: { VEHICLE: "fordon", STREET_NAME: "S", PARKING_RATE: "avgiftsfri", CITATION: "c1" },
  }],
};

function makeOpts(prev: ParkingFeatureCollection | null, written: Record<string, unknown>) {
  return {
    gbgAppId: "a", sthlmApiKey: "k",
    fetchGbg: async () => gbgRaw,
    fetchSthlm: async () => sthlmRaw,
    readPrevious: async () => prev,
    writeJson: async (path: string, data: unknown) => { written[path] = data; },
  };
}

describe("runPoll orchestrator", () => {
  beforeEach(() => { resetRegistry(); resetStockholmRegistry(); });

  it("merges both cities into one FeatureCollection with city metadata", async () => {
    const written: Record<string, unknown> = {};
    const res = await runPoll(makeOpts(null, written));
    expect(res.committed).toBe(true);
    const geojson = Object.entries(written).find(([p]) => p.endsWith("parkings.geojson"))![1] as ParkingFeatureCollection;
    expect(geojson.type).toBe("FeatureCollection");
    expect(geojson.features.map((f) => f.properties.city).sort()).toEqual(["goteborg", "stockholm"]);
    expect(geojson.cities.goteborg.timeZone).toBe("Europe/Stockholm");
    expect(geojson.cities.stockholm.holidayCalendar).toBe("SE");
  });

  it("writes a tariffs.json containing the used tariff ids", async () => {
    const written: Record<string, unknown> = {};
    await runPoll(makeOpts(null, written));
    const tariffs = Object.entries(written).find(([p]) => p.endsWith("tariffs.json"))![1] as { tariffs: { id: string }[] };
    const ids = tariffs.tariffs.map((t) => t.id);
    expect(ids).toContain("sthlm-avgiftsfri");
  });

  it("aborts (keeps previous) when a city drops >20%", async () => {
    const mk = (city: "goteborg" | "stockholm", i: number) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [11, 57] as [number, number] },
      properties: { id: `${city}:${i}`, city, vehicle: "bilar" as const, name: "", provider: "", tariffId: null, rulesText: "", accessible: false, spaces: null, maxParkingMinutes: null },
    });
    const prev: ParkingFeatureCollection = {
      type: "FeatureCollection", generatedAt: "x",
      cities: {} as never,
      features: [
        ...Array.from({ length: 10 }, (_, i) => mk("goteborg", i)),
        ...Array.from({ length: 10 }, (_, i) => mk("stockholm", i)),
      ],
    };
    const written: Record<string, unknown> = {};
    // gbg fetch returns just 1 feature (drop from 10) → abort
    const res = await runPoll(makeOpts(prev, written));
    expect(res.committed).toBe(false);
    expect(Object.keys(written)).toHaveLength(0);
  });

  it("first run (no previous) is allowed to write", async () => {
    const written: Record<string, unknown> = {};
    const res = await runPoll(makeOpts(null, written));
    expect(res.committed).toBe(true);
  });
});
