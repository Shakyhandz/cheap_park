import { describe, expect, it } from "vitest";
import { nearestCityCenter } from "../lib/geo.js";

const centers = {
  goteborg: [11.9685, 57.7068] as [number, number],
  stockholm: [18.0686, 59.3293] as [number, number],
};

describe("nearestCityCenter", () => {
  it("returns Gothenburg center when near Gothenburg", () => {
    expect(nearestCityCenter({ lat: 57.70, lng: 11.97 }, centers)).toEqual(centers.goteborg);
  });
  it("returns Stockholm center when near Stockholm", () => {
    expect(nearestCityCenter({ lat: 59.33, lng: 18.07 }, centers)).toEqual(centers.stockholm);
  });
  it("falls back to Gothenburg when no position", () => {
    expect(nearestCityCenter(null, centers)).toEqual(centers.goteborg);
  });
});
