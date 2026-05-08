import { describe, expect, it } from "vitest";
import { tierForViewport } from "../lib/colors.js";

describe("tierForViewport", () => {
  it("returns grey for null price (n/a)", () => {
    expect(tierForViewport([10, 20, 30], null)).toBe("grey");
  });

  it("returns green for 0 (free)", () => {
    expect(tierForViewport([10, 20, 30], 0)).toBe("green");
  });

  it("returns green when in bottom tertile", () => {
    expect(tierForViewport([10, 20, 30, 40, 50, 60], 15)).toBe("green");
  });

  it("returns yellow when in middle tertile", () => {
    expect(tierForViewport([10, 20, 30, 40, 50, 60], 35)).toBe("yellow");
  });

  it("returns red when in top tertile", () => {
    expect(tierForViewport([10, 20, 30, 40, 50, 60], 55)).toBe("red");
  });

  it("returns green when viewport has no numeric prices (only free / n/a)", () => {
    expect(tierForViewport([], 0)).toBe("green");
  });

  it("ignores nulls in the population", () => {
    expect(tierForViewport([null, 10, null, 50, null], 12)).toBe("green");
  });

  it("returns green for the cheapest single price", () => {
    expect(tierForViewport([42], 42)).toBe("green");
  });
});
