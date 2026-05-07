import { describe, expect, it } from "vitest";
import { totalCost } from "../src/total-cost.js";
import type { Tariff } from "../src/types.js";

const weekdayPaidEvening: Tariff = {
  id: "test-A",
  name: "Centrum",
  rules: [
    { daysOfWeek: [1, 2, 3, 4, 5], hourStart: 9, hourEnd: 18, pricePerHour: 35 },
    { daysOfWeek: [1, 2, 3, 4, 5], hourStart: 18, hourEnd: 24, pricePerHour: 0 },
  ],
};

const flatRate: Tariff = {
  id: "flat",
  name: "Flat",
  rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 20 }],
};

const withDailyCap: Tariff = {
  id: "capped",
  name: "Capped",
  rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 20, maxPerDay: 100 }],
};

describe("totalCost", () => {
  it("returns 'n/a' when tariff is null", () => {
    expect(totalCost(null, new Date("2026-05-11T14:00:00"), 60)).toBe("n/a");
  });

  it("flat rate * duration", () => {
    const result = totalCost(flatRate, new Date("2026-05-11T14:00:00"), 60);
    if (result === "n/a") throw new Error("expected breakdown");
    expect(result.total).toBe(20);
    expect(result.breakdown.length).toBe(1);
  });

  it("segments across rule boundary (paid then free after 18:00)", () => {
    // Start 16:00, park 4h → 2h @ 35 (16-18) + 2h @ 0 (18-20) = 70 kr
    const result = totalCost(weekdayPaidEvening, new Date("2026-05-11T16:00:00"), 240);
    if (result === "n/a") throw new Error("expected breakdown");
    expect(result.total).toBe(70);
    expect(result.breakdown.length).toBe(2);
    expect(result.breakdown[0]?.rate).toBe(35);
    expect(result.breakdown[1]?.rate).toBe(0);
  });

  it("starts in free window, no charge", () => {
    const result = totalCost(weekdayPaidEvening, new Date("2026-05-11T19:00:00"), 60);
    if (result === "n/a") throw new Error("expected breakdown");
    expect(result.total).toBe(0);
  });

  it("crosses midnight to next day", () => {
    // Start 23:30 Mon, park 60 min → ends 00:30 Tue. Paid evening rule ends at 24, then no rule → free.
    // 30 min @ 0 (18-24 free rule on Mon) + 30 min @ 0 (after midnight, no rule = free) = 0 kr
    const result = totalCost(weekdayPaidEvening, new Date("2026-05-11T23:30:00"), 60);
    if (result === "n/a") throw new Error("expected breakdown");
    expect(result.total).toBe(0);
  });

  it("applies daily cap when total would exceed", () => {
    // Flat 20 kr/h for 8h = 160 kr, but cap = 100
    const result = totalCost(withDailyCap, new Date("2026-05-11T08:00:00"), 480);
    if (result === "n/a") throw new Error("expected breakdown");
    expect(result.total).toBe(100);
  });

  it("does not apply cap when total is below", () => {
    const result = totalCost(withDailyCap, new Date("2026-05-11T08:00:00"), 60);
    if (result === "n/a") throw new Error("expected breakdown");
    expect(result.total).toBe(20);
  });
});
