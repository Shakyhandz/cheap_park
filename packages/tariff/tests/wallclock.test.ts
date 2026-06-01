import { describe, expect, it } from "vitest";
import { wallClockParts } from "../src/wallclock.js";

describe("wallClockParts", () => {
  // 2026-05-30T11:31:00Z = 13:31 in Stockholm (CEST, +2), 14:31 in Helsinki (EEST, +3)
  const instant = new Date("2026-05-30T11:31:00Z");

  it("renders the instant in Stockholm time", () => {
    const p = wallClockParts(instant, "Europe/Stockholm");
    expect(p.year).toBe(2026);
    expect(p.month).toBe(5);
    expect(p.day).toBe(30);
    expect(p.hour).toBe(13.516666666666667); // 13 + 31/60
    expect(p.weekday).toBe(6); // Saturday
  });

  it("renders the same instant in Helsinki time", () => {
    const p = wallClockParts(instant, "Europe/Helsinki");
    expect(p.hour).toBeCloseTo(14.516666, 4);
    expect(p.weekday).toBe(6);
  });

  it("is independent of the host timezone (uses the named zone)", () => {
    // Midnight UTC on a Monday is still Monday 02:00 in Stockholm summer.
    const p = wallClockParts(new Date("2026-06-01T00:00:00Z"), "Europe/Stockholm");
    expect(p.weekday).toBe(1); // Monday
    expect(p.hour).toBe(2);
  });
});
