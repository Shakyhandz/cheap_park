import { beforeEach, describe, expect, it } from "vitest";
import {
  matchTariff,
  parseDurationMinutes,
  resetRegistry,
  getRegisteredTariffs,
  KNOWN_TARIFFS,
} from "../src/tariff-templates.js";

describe("parseDurationMinutes", () => {
  it("parses plain number string", () => {
    expect(parseDurationMinutes("30")).toBe(30);
  });

  it("parses '30 min'", () => {
    expect(parseDurationMinutes("30 min")).toBe(30);
  });

  it("parses '2 tim'", () => {
    expect(parseDurationMinutes("2 tim")).toBe(120);
  });

  it("parses '1 tim 30 min'", () => {
    expect(parseDurationMinutes("1 tim 30 min")).toBe(90);
  });

  it("returns null for null/undefined", () => {
    expect(parseDurationMinutes(null)).toBeNull();
    expect(parseDurationMinutes(undefined)).toBeNull();
  });

  it("returns null for unparseable strings", () => {
    expect(parseDurationMinutes("forever")).toBeNull();
  });
});

describe("matchTariff", () => {
  beforeEach(() => resetRegistry());

  it("matches free 30-min pocket from explicit Avgiftsfri", () => {
    const result = matchTariff({ ParkingCost: "Avgiftsfri 30 min", MaxParkingTime: "30" });
    expect(result).toBe("free-30min");
  });

  it("matches free 10-min pocket", () => {
    const result = matchTariff({ ParkingCost: "Avgiftsfri 10 min", MaxParkingTime: "10" });
    expect(result).toBe("free-10min");
  });

  it("matches free pocket from empty cost + '30 min' MaxParkingTime", () => {
    const result = matchTariff({ ParkingCost: "", MaxParkingTime: "30 min" });
    expect(result).toBe("free-30min");
  });

  it("matches free pocket from empty cost + '2 tim' MaxParkingTime", () => {
    const result = matchTariff({ ParkingCost: "", MaxParkingTime: "2 tim" });
    expect(result).toBe("free-120min");
  });

  it("matches paid hourly pattern with off-hour rate", () => {
    const id = matchTariff({
      ParkingCost: "34 kr/tim 8-22 alla dagar. Övrig tid: 2 kr/tim",
    });
    expect(id).toBe("paid-h60-34-8-22-off2");
    const t = getRegisteredTariffs().find((x) => x.id === id);
    expect(t?.rules.length).toBe(3);
    expect(t?.rules[0]?.pricePerHour).toBe(34);
    expect(t?.rules[0]?.hourStart).toBe(8);
    expect(t?.rules[0]?.hourEnd).toBe(22);
  });

  it("matches paid 30-min pattern as doubled hourly rate", () => {
    const id = matchTariff({
      ParkingCost: "23 kr/30 min 8-22 alla dagar. Övrig tid: 2 kr/tim",
    });
    expect(id).toBe("paid-h30-23-8-22-off2");
    const t = getRegisteredTariffs().find((x) => x.id === id);
    expect(t?.rules[0]?.pricePerHour).toBe(46);
  });

  it("matches paid pattern with daily cap", () => {
    const id = matchTariff({
      ParkingCost: "8 kr/tim 8-22 alla dagar. Övrig tid: 2 kr/tim. Maxtaxa 50 kr/dag.",
    });
    expect(id).toBe("paid-h60-8-8-22-off2-cap50");
    const t = getRegisteredTariffs().find((x) => x.id === id);
    expect(t?.rules[0]?.maxPerDay).toBe(50);
  });

  it("matches paid pattern with daily cap and no off-hour", () => {
    const id = matchTariff({
      ParkingCost: "6 kr/tim 8-22 alla dagar, maxtaxa 30 kr/dag",
    });
    expect(id).toBe("paid-h60-6-8-22-off0-cap30");
    const t = getRegisteredTariffs().find((x) => x.id === id);
    expect(t?.rules.length).toBe(1);
    expect(t?.rules[0]?.maxPerDay).toBe(30);
  });

  it("returns null on unknown pattern", () => {
    const result = matchTariff({ ParkingCost: "Esoteriskt nytt format" });
    expect(result).toBeNull();
  });

  it("returns null on missing both ParkingCost and MaxParkingTime", () => {
    expect(matchTariff({})).toBeNull();
  });
});

describe("registry", () => {
  beforeEach(() => resetRegistry());

  it("getRegisteredTariffs returns matched tariffs sorted by id", () => {
    matchTariff({ ParkingCost: "34 kr/tim 8-22 alla dagar. Övrig tid: 2 kr/tim" });
    matchTariff({ ParkingCost: "Avgiftsfri 30 min", MaxParkingTime: "30" });
    const ids = getRegisteredTariffs().map((t) => t.id);
    expect(ids).toEqual(["free-30min", "paid-h60-34-8-22-off2"]);
  });

  it("KNOWN_TARIFFS proxies to the live registry", () => {
    matchTariff({ ParkingCost: "Avgiftsfri 15 min", MaxParkingTime: "15" });
    expect(KNOWN_TARIFFS.find((t) => t.id === "free-15min")).toBeDefined();
  });

  it("resetRegistry clears all entries", () => {
    matchTariff({ ParkingCost: "Avgiftsfri 30 min", MaxParkingTime: "30" });
    expect(getRegisteredTariffs().length).toBe(1);
    resetRegistry();
    expect(getRegisteredTariffs().length).toBe(0);
  });
});
