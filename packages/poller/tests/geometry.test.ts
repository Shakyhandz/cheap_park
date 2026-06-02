import { describe, expect, it } from "vitest";
import { midpointOf, roundCoord, roundGeometry } from "../src/geometry.js";

describe("roundCoord", () => {
  it("rounds to 5 decimals", () => {
    expect(roundCoord(18.0628753)).toBe(18.06288);
  });
});

describe("midpointOf", () => {
  it("Point → itself", () => {
    expect(midpointOf({ type: "Point", coordinates: [18, 59] })).toEqual({ lat: 59, lng: 18 });
  });
  it("LineString → midpoint by vertex-count center", () => {
    const mid = midpointOf({ type: "LineString", coordinates: [[18.0, 59.0], [18.0, 59.2]] });
    expect(mid.lat).toBeCloseTo(59.1, 5);
    expect(mid.lng).toBeCloseTo(18.0, 5);
  });
  it("MultiLineString → midpoint over all vertices", () => {
    const mid = midpointOf({
      type: "MultiLineString",
      coordinates: [[[18.0, 59.0], [18.0, 59.0]], [[18.0, 59.2], [18.0, 59.2]]],
    });
    expect(mid.lat).toBeCloseTo(59.1, 5);
  });
});

describe("roundGeometry", () => {
  it("rounds every coordinate of a LineString", () => {
    const g = roundGeometry({ type: "LineString", coordinates: [[18.0628753, 59.3330612]] });
    expect(g).toEqual({ type: "LineString", coordinates: [[18.06288, 59.33306]] });
  });
});
