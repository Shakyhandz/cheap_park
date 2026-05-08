import { describe, expect, it } from "vitest";
import type { Tariff } from "@cheap-park/tariff";
import { priceLabel, totalLabel, hourlyRate } from "../lib/prices.js";

const flat20: Tariff = {
  id: "flat",
  name: "Flat",
  rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 20 }],
};

const free: Tariff = {
  id: "free",
  name: "Free",
  rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }],
};

const now = new Date("2026-05-11T14:00:00");

describe("priceLabel", () => {
  it("renders kr/h for paid tariff", () => {
    expect(priceLabel(flat20, now)).toBe("20 kr/h");
  });

  it("renders 'Gratis' for free tariff", () => {
    expect(priceLabel(free, now)).toBe("Gratis");
  });

  it("renders 'N/A' for missing tariff", () => {
    expect(priceLabel(null, now)).toBe("N/A");
  });
});

describe("totalLabel", () => {
  it("renders total kr for paid tariff over duration", () => {
    expect(totalLabel(flat20, now, 60)).toBe("20 kr");
  });

  it("renders 'Gratis' when total is 0", () => {
    expect(totalLabel(free, now, 60)).toBe("Gratis");
  });

  it("renders 'N/A' for missing tariff", () => {
    expect(totalLabel(null, now, 60)).toBe("N/A");
  });

  it("rounds to integer kr", () => {
    expect(totalLabel(flat20, now, 90)).toBe("30 kr");
  });
});

describe("hourlyRate", () => {
  it("returns numeric rate for paid tariff", () => {
    expect(hourlyRate(flat20, now)).toBe(20);
  });

  it("returns 0 for free tariff", () => {
    expect(hourlyRate(free, now)).toBe(0);
  });

  it("returns null for missing tariff", () => {
    expect(hourlyRate(null, now)).toBeNull();
  });
});
