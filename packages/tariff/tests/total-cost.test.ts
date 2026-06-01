import { describe, expect, it } from "vitest";
import { totalCost } from "../src/total-cost.js";
import type { EvalContext } from "../src/days.js";
import type { Tariff } from "../src/types.js";

const SE: EvalContext = { timeZone: "Europe/Stockholm", calendar: "SE" };

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
    // 14:00 Stockholm Mon = 12:00Z
    expect(totalCost(null, new Date("2026-05-11T12:00:00Z"), 60, SE)).toBe("n/a");
  });

  it("flat rate * duration", () => {
    // 14:00 Stockholm Mon = 12:00Z
    const result = totalCost(flatRate, new Date("2026-05-11T12:00:00Z"), 60, SE);
    if (result === "n/a") throw new Error("expected breakdown");
    expect(result.total).toBe(20);
    expect(result.breakdown.length).toBe(1);
  });

  it("segments across rule boundary (paid then free after 18:00)", () => {
    // Start 16:00 Stockholm Mon = 14:00Z, park 4h → 2h @ 35 (16-18) + 2h @ 0 (18-20) = 70 kr
    const result = totalCost(weekdayPaidEvening, new Date("2026-05-11T14:00:00Z"), 240, SE);
    if (result === "n/a") throw new Error("expected breakdown");
    expect(result.total).toBe(70);
    expect(result.breakdown.length).toBe(2);
    expect(result.breakdown[0]?.rate).toBe(35);
    expect(result.breakdown[1]?.rate).toBe(0);
  });

  it("starts in free window, no charge", () => {
    // 19:00 Stockholm Mon = 17:00Z
    const result = totalCost(weekdayPaidEvening, new Date("2026-05-11T17:00:00Z"), 60, SE);
    if (result === "n/a") throw new Error("expected breakdown");
    expect(result.total).toBe(0);
  });

  it("crosses midnight to next day", () => {
    // 23:30 Stockholm Mon = 21:30Z, +60min → 22:30Z = 00:30 Stockholm Tue
    // Midnight Stockholm (00:00 Tue) = 22:00Z
    // 30 min @ 0 (18-24 free rule on Mon) + 30 min @ 0 (after midnight, no rule = free) = 0 kr
    const result = totalCost(weekdayPaidEvening, new Date("2026-05-11T21:30:00Z"), 60, SE);
    if (result === "n/a") throw new Error("expected breakdown");
    expect(result.total).toBe(0);
    expect(result.breakdown.length).toBe(2);
    expect(result.breakdown[0]?.rate).toBe(0);
    expect(result.breakdown[1]?.rate).toBe(0);
  });

  it("applies daily cap when total would exceed", () => {
    // Flat 20 kr/h for 8h = 160 kr, but cap = 100
    // 08:00 Stockholm = 06:00Z
    const result = totalCost(withDailyCap, new Date("2026-05-11T06:00:00Z"), 480, SE);
    if (result === "n/a") throw new Error("expected breakdown");
    expect(result.total).toBe(100);
  });

  it("does not apply cap when total is below", () => {
    // 08:00 Stockholm = 06:00Z
    const result = totalCost(withDailyCap, new Date("2026-05-11T06:00:00Z"), 60, SE);
    if (result === "n/a") throw new Error("expected breakdown");
    expect(result.total).toBe(20);
  });

  it("splits across a rule boundary (Taxa 1: flat 55/h all day)", () => {
    const taxa1: Tariff = {
      id: "taxa1",
      name: "Taxa 1",
      rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 55 }],
    };
    const r = totalCost(taxa1, new Date("2026-05-27T11:00:00Z"), 120, SE);
    if (r !== "n/a") expect(r.total).toBe(110);
  });

  it("crosses a daytime→evening price change (Taxa 2 vardag)", () => {
    const taxa2: Tariff = {
      id: "taxa2",
      name: "Taxa 2",
      rules: [
        { daysOfWeek: [], dayClasses: ["vardag"], hourStart: 7, hourEnd: 21, pricePerHour: 31 },
        { daysOfWeek: [], dayClasses: ["vardag"], hourStart: 0, hourEnd: 7, pricePerHour: 20 },
        { daysOfWeek: [], dayClasses: ["vardag"], hourStart: 21, hourEnd: 24, pricePerHour: 20 },
      ],
    };
    // Wed 20:00 Stockholm (18:00Z) for 2h → 1h @31 (20-21) + 1h @20 (21-22) = 51
    const r = totalCost(taxa2, new Date("2026-05-27T18:00:00Z"), 120, SE);
    if (r !== "n/a") expect(r.total).toBe(51);
  });
});
