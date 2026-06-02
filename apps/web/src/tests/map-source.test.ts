import { describe, expect, it } from "vitest";
import { buildMapSource } from "../lib/map-source.js";
import type { ClientParking } from "../lib/client-model.js";
import type { Tariff } from "@cheap-park/tariff";

const SE = { timeZone: "Europe/Stockholm", calendar: "SE" } as const;
const t55: Tariff = { id: "t55", name: "55", rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 55 }] };
const t5: Tariff = { id: "t5", name: "5", rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 5 }] };
const tariffs = new Map([["t55", t55], ["t5", t5]]);

function cp(id: string, tariffId: string): ClientParking {
  return {
    id, city: "stockholm", name: id, provider: "p",
    geometry: { type: "Point", coordinates: [18, 59] }, displayPoint: { lat: 59, lng: 18 },
    tariffId, rulesText: "", accessible: false, spaces: null, maxParkingMinutes: null, ctx: SE,
  };
}

describe("buildMapSource", () => {
  it("emits a FeatureCollection with tier + dimmed + label props", () => {
    const visible = [cp("a", "t5"), cp("b", "t55")];
    const fc = buildMapSource(visible, [], tariffs, null, new Date("2026-05-27T11:00:00Z"));
    expect(fc.type).toBe("FeatureCollection");
    const a = fc.features.find((f) => f.properties.id === "a")!;
    const b = fc.features.find((f) => f.properties.id === "b")!;
    expect(a.properties.tier).toBe("green"); // cheapest
    expect(b.properties.tier).toBe("red");   // priciest
    expect(a.properties.dimmed).toBe(false);
    expect(a.properties.label).toBe("5 kr/h");
  });

  it("marks dimmed features", () => {
    const fc = buildMapSource([], [cp("c", "t5")], tariffs, null, new Date("2026-05-27T11:00:00Z"));
    expect(fc.features[0]!.properties.dimmed).toBe(true);
  });

  it("uses total label when a duration is given", () => {
    const fc = buildMapSource([cp("d", "t5")], [], tariffs, 120, new Date("2026-05-27T11:00:00Z"));
    expect(fc.features[0]!.properties.label).toBe("10 kr"); // 5 kr/h * 2h
  });
});
