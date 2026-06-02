import { describe, expect, it, beforeEach } from "vitest";
import { normalizeStockholm } from "../src/normalize-stockholm.js";
import { resetStockholmRegistry } from "../src/tariff-templates-stockholm.js";
import type { RawStockholmFC } from "../src/fetch-stockholm.js";

const fc: RawStockholmFC = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[18.0628753, 59.3330612], [18.0625, 59.3330]] },
      properties: {
        VEHICLE: "fordon", STREET_NAME: "Sveavägen",
        PARKING_RATE: "taxa 2: 31 kr/tim vardagar 7-21 och dag före helgdag och helgdag 9-19, 20 kr/tim övrig tid, Boende: 1100 kr/månad eller 75 kr/dygn",
        CITATION: "0180 2021-05253",
      },
    },
    {
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[18.07, 59.33], [18.071, 59.331]] },
      properties: { VEHICLE: "motorcykel", STREET_NAME: "X", PARKING_RATE: "avgiftsfri", CITATION: "c2" },
    },
  ],
};

describe("normalizeStockholm", () => {
  beforeEach(() => resetStockholmRegistry());

  it("keeps only cars (VEHICLE=fordon)", () => {
    const out = normalizeStockholm(fc);
    expect(out).toHaveLength(1);
    expect(out[0]!.properties.name).toBe("Sveavägen");
  });

  it("builds a unified feature with prefixed id, city, vehicle, rulesText", () => {
    const f = normalizeStockholm(fc)[0]!;
    expect(f.properties.id).toBe("sthlm:0180 2021-05253");
    expect(f.properties.city).toBe("stockholm");
    expect(f.properties.vehicle).toBe("bilar");
    expect(f.properties.provider).toBe("Stockholms stad");
    expect(f.properties.tariffId).toBe("sthlm-taxa-2");
    expect(f.properties.rulesText).toContain("taxa 2");
    expect(f.properties.accessible).toBe(false);
    expect(f.properties.spaces).toBe(null);
    expect(f.properties.maxParkingMinutes).toBe(null);
  });

  it("rounds geometry to 5 decimals and preserves type", () => {
    const f = normalizeStockholm(fc)[0]!;
    expect(f.geometry.type).toBe("LineString");
    if (f.geometry.type === "LineString") {
      expect(f.geometry.coordinates[0]).toEqual([18.06288, 59.33306]);
    }
  });

  it("unknown rate → tariffId null but feature kept", () => {
    const weird: RawStockholmFC = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: { type: "LineString", coordinates: [[18, 59], [18.001, 59.001]] },
        properties: { VEHICLE: "fordon", STREET_NAME: "Z", PARKING_RATE: "taxa 99: weird", CITATION: "c3" },
      }],
    };
    const f = normalizeStockholm(weird)[0]!;
    expect(f.properties.tariffId).toBe(null);
    expect(f.properties.rulesText).toBe("taxa 99: weird");
  });

  it("preserves multiple segments sharing a citation via positional suffix", () => {
    const dup: RawStockholmFC = {
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: { type: "LineString", coordinates: [[18, 59], [18.001, 59]] },
          properties: { VEHICLE: "fordon", STREET_NAME: "Dup", PARKING_RATE: "avgiftsfri", CITATION: "dupcit" } },
        { type: "Feature", geometry: { type: "LineString", coordinates: [[18.1, 59.1], [18.101, 59.1]] },
          properties: { VEHICLE: "fordon", STREET_NAME: "Dup", PARKING_RATE: "avgiftsfri", CITATION: "dupcit" } },
      ],
    };
    const out = normalizeStockholm(dup);
    expect(out).toHaveLength(2);
    const ids = out.map((f) => f.properties.id).sort();
    expect(ids).toEqual(["sthlm:dupcit", "sthlm:dupcit#1"]);
  });
});
