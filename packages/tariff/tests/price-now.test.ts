import { describe, expect, it } from "vitest";
import { priceNow } from "../src/price-now.js";
import type { Tariff } from "../src/types.js";

const weekdayPaidEvening: Tariff = {
  id: "test-A",
  name: "Centrum",
  rules: [
    { daysOfWeek: [1, 2, 3, 4, 5], hourStart: 9, hourEnd: 18, pricePerHour: 35 },
    { daysOfWeek: [1, 2, 3, 4, 5], hourStart: 18, hourEnd: 24, pricePerHour: 0 },
  ],
};

const allDayFree: Tariff = {
  id: "test-free",
  name: "Förort",
  rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }],
};

describe("priceNow", () => {
  it("returns hourly rate inside paid window", () => {
    expect(priceNow(weekdayPaidEvening, new Date("2026-05-11T14:00:00"))).toBe(35);
  });

  it("returns 'free' when active rule is 0 kr/h", () => {
    expect(priceNow(weekdayPaidEvening, new Date("2026-05-11T20:00:00"))).toBe("free");
  });

  it("returns 'free' on weekend (no rule applies)", () => {
    expect(priceNow(weekdayPaidEvening, new Date("2026-05-10T14:00:00"))).toBe("free");
  });

  it("returns 'n/a' when tariff is null", () => {
    expect(priceNow(null, new Date("2026-05-11T14:00:00"))).toBe("n/a");
  });

  it("matches all-days rule any day", () => {
    expect(priceNow(allDayFree, new Date("2026-05-09T03:00:00"))).toBe("free");
  });

  it("returns first matching rule when multiple match", () => {
    const overlap: Tariff = {
      id: "overlap",
      name: "Test",
      rules: [
        { daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 20 },
        { daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 99 },
      ],
    };
    expect(priceNow(overlap, new Date("2026-05-11T14:00:00"))).toBe(20);
  });
});
