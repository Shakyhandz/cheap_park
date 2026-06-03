import { describe, expect, it } from "vitest";
import { normalize } from "../src/normalize.js";
import sample from "./fixtures/api-toll-sample.json";

describe("normalize (Gothenburg → unified features)", () => {
  it("produces one feature per input record", () => {
    const result = normalize({ toll: sample as never, time: [] });
    expect(result.length).toBe(2);
  });

  it("emits a Point feature with prefixed id, city, provider, geometry", () => {
    const result = normalize({ toll: sample as never, time: [] });
    const p = result.find((x) => x.properties.id === "gbg:P-1001");
    expect(p).toBeDefined();
    expect(p!.properties.name).toBe("Test Street 1");
    expect(p!.properties.city).toBe("goteborg");
    expect(p!.properties.vehicle).toBe("bilar");
    expect(p!.properties.provider).toBe("Parkering Göteborg");
    expect(p!.geometry).toEqual({ type: "Point", coordinates: [11.9678, 57.7042] });
  });

  it("matches tariff for the 30-min pocket", () => {
    const result = normalize({ toll: [], time: sample as never });
    const p = result.find((x) => x.properties.id === "gbg:P-1002");
    expect(p).toBeDefined();
    expect(p!.properties.tariffId).toBe("free-30min");
    expect(p!.properties.maxParkingMinutes).toBe(30);
  });

  it("filters out records missing coordinates", () => {
    const broken = [{ Id: "X", Name: "Broken" }];
    const result = normalize({ toll: broken as never, time: [] });
    expect(result.length).toBe(0);
  });

  it("dedupes on id (toll wins over time)", () => {
    const dup = [{ Id: "P-1001", Name: "Dup", Lat: 57.7, Long: 11.9 }];
    const result = normalize({ toll: sample as never, time: dup as never });
    expect(result.filter((x) => x.properties.id === "gbg:P-1001").length).toBe(1);
  });

  it("builds rulesText from raw cost/limitation/extra fields", () => {
    const result = normalize({ toll: sample as never, time: [] });
    const p = result.find((x) => x.properties.id === "gbg:P-1001")!;
    expect(p.properties.rulesText).toContain("35 kr");
  });

  it("converts MaxParkingTime to number of minutes", () => {
    const result = normalize({ toll: sample as never, time: [] });
    const p = result.find((x) => x.properties.id === "gbg:P-1001")!;
    expect(p.properties.maxParkingMinutes).toBe(240);
  });

  it("derives accessible from ExtraInfo regex", () => {
    const acc = [{ Id: "A", Name: "Acc", Lat: 57.7, Long: 11.9, ExtraInfo: "Endast rörelsehindrade" }];
    const result = normalize({ toll: acc as never, time: [] });
    expect(result[0]!.properties.accessible).toBe(true);
  });
});
