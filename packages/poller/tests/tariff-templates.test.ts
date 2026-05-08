import { describe, expect, it } from "vitest";
import { matchTariff, KNOWN_TARIFFS } from "../src/tariff-templates.js";

describe("matchTariff", () => {
  it("matches free 30-min pocket from MaxParkingTime", () => {
    const result = matchTariff({ ParkingCost: "Avgiftsfri 30 min", MaxParkingTime: "30" });
    expect(result).toBe("free-30min");
  });

  it("matches free 10-min pocket", () => {
    const result = matchTariff({ ParkingCost: "Avgiftsfri 10 min", MaxParkingTime: "10" });
    expect(result).toBe("free-10min");
  });

  it("returns null on unknown pattern", () => {
    const result = matchTariff({ ParkingCost: "Esoteriskt nytt format" });
    expect(result).toBeNull();
  });

  it("returns null on missing ParkingCost", () => {
    expect(matchTariff({})).toBeNull();
  });
});

describe("KNOWN_TARIFFS", () => {
  it("includes free-30min template", () => {
    const t = KNOWN_TARIFFS.find((x) => x.id === "free-30min");
    expect(t).toBeDefined();
    expect(t!.rules[0]!.pricePerHour).toBe(0);
  });
});
