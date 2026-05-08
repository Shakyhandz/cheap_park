import { describe, expect, it } from "vitest";
import { normalize } from "../src/normalize.js";
import sample from "./fixtures/api-toll-sample.json";

describe("normalize", () => {
  it("produces one parking per input record", () => {
    const result = normalize({ toll: sample, time: [] });
    expect(result.length).toBe(2);
  });

  it("populates id, name, lat/lng", () => {
    const result = normalize({ toll: sample, time: [] });
    const p = result.find((x) => x.id === "P-1001");
    expect(p).toBeDefined();
    expect(p!.name).toBe("Test Street 1");
    expect(p!.lat).toBeCloseTo(57.7042);
    expect(p!.lng).toBeCloseTo(11.9678);
  });

  it("matches tariff for the 30-min pocket", () => {
    const result = normalize({ toll: [], time: sample });
    const p = result.find((x) => x.id === "P-1002");
    expect(p).toBeDefined();
    expect(p!.tariffId).toBe("free-30min");
    expect(p!.maxParkingMinutes).toBe(30);
  });

  it("filters out records missing coordinates", () => {
    const broken = [{ Id: "X", Name: "Broken" }];
    const result = normalize({ toll: broken as never, time: [] });
    expect(result.length).toBe(0);
  });

  it("dedupes on id (toll wins over time)", () => {
    const dup = [{ Id: "P-1001", Name: "Dup", Lat: 57.7, Long: 11.9 }];
    const result = normalize({ toll: sample, time: dup as never });
    expect(result.filter((x) => x.id === "P-1001").length).toBe(1);
  });

  it("preserves raw fields", () => {
    const result = normalize({ toll: sample, time: [] });
    const p = result.find((x) => x.id === "P-1001")!;
    expect(p.raw["ParkingCost"]).toContain("35 kr");
  });

  it("converts MaxParkingTime to number of minutes", () => {
    const result = normalize({ toll: sample, time: [] });
    const p = result.find((x) => x.id === "P-1001")!;
    expect(p.maxParkingMinutes).toBe(240);
  });
});
