import { describe, expect, it } from "vitest";
import type { Tariff } from "@cheap-park/tariff";
import { applyFilters } from "../lib/filter.js";
import { defaultState } from "../lib/url-state.js";
import type { ClientParking } from "../lib/client-model.js";

const tariffs = new Map<string, Tariff>([
  ["free", { id: "free", name: "Free", rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 0 }] }],
  ["paid20", { id: "paid20", name: "Paid 20", rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 20 }] }],
  ["paid60", { id: "paid60", name: "Paid 60", rules: [{ daysOfWeek: [], hourStart: 0, hourEnd: 24, pricePerHour: 60 }] }],
]);

const SE = { timeZone: "Europe/Stockholm", calendar: "SE" } as const;
const now = new Date("2026-05-11T12:00:00Z"); // 14:00 Stockholm

function p(over: Partial<ClientParking>): ClientParking {
  return {
    id: "x", city: "goteborg", name: "x", provider: "x",
    geometry: { type: "Point", coordinates: [11, 57] },
    displayPoint: { lat: 57, lng: 11 },
    tariffId: null, rulesText: "", accessible: false,
    spaces: null, maxParkingMinutes: null, ctx: SE, ...over,
  };
}

describe("applyFilters", () => {
  it("returns all parkings as visible when filters are default", () => {
    const list = [p({ id: "a" }), p({ id: "b" })];
    const result = applyFilters(list, tariffs, defaultState, now);
    expect(result.visible.length).toBe(2);
    expect(result.dimmed.length).toBe(0);
  });

  it("filters to only free when free=true", () => {
    const list = [p({ id: "free", tariffId: "free" }), p({ id: "paid", tariffId: "paid20" })];
    const state = { ...defaultState, filters: { ...defaultState.filters, free: true } };
    const result = applyFilters(list, tariffs, state, now);
    expect(result.visible.map((x) => x.id)).toEqual(["free"]);
  });

  it("filters by accessible field", () => {
    const list = [p({ id: "rh", accessible: true }), p({ id: "regular", accessible: false })];
    const state = { ...defaultState, filters: { ...defaultState.filters, accessible: true } };
    const result = applyFilters(list, tariffs, state, now);
    expect(result.visible.map((x) => x.id)).toEqual(["rh"]);
  });

  it("filters longTerm: keeps maxParkingMinutes >= 360 or null", () => {
    const list = [
      p({ id: "short", maxParkingMinutes: 30 }),
      p({ id: "long", maxParkingMinutes: 480 }),
      p({ id: "unlimited", maxParkingMinutes: null }),
    ];
    const state = { ...defaultState, filters: { ...defaultState.filters, longTerm: true } };
    const result = applyFilters(list, tariffs, state, now);
    expect(result.visible.map((x) => x.id).sort()).toEqual(["long", "unlimited"]);
  });

  it("filters maxPricePerHour: free passes, n/a hidden, numeric compared", () => {
    const list = [
      p({ id: "free", tariffId: "free" }),
      p({ id: "cheap", tariffId: "paid20" }),
      p({ id: "expensive", tariffId: "paid60" }),
      p({ id: "unknown", tariffId: null }),
    ];
    const state = { ...defaultState, filters: { ...defaultState.filters, maxPricePerHour: 30 } };
    const result = applyFilters(list, tariffs, state, now);
    expect(result.visible.map((x) => x.id).sort()).toEqual(["cheap", "free"]);
  });

  it("dims parkings whose maxParkingMinutes is less than userDuration", () => {
    const list = [p({ id: "short", maxParkingMinutes: 30 }), p({ id: "long", maxParkingMinutes: 240 })];
    const state = { ...defaultState, durationMinutes: 120 };
    const result = applyFilters(list, tariffs, state, now);
    expect(result.visible.map((x) => x.id)).toEqual(["long"]);
    expect(result.dimmed.map((x) => x.id)).toEqual(["short"]);
  });

  it("does not dim when duration is null", () => {
    const list = [p({ id: "short", maxParkingMinutes: 30 })];
    const result = applyFilters(list, tariffs, defaultState, now);
    expect(result.visible.length).toBe(1);
    expect(result.dimmed.length).toBe(0);
  });

  it("dimmed parkings still respect other filters (e.g., free)", () => {
    const list = [
      p({ id: "short-free", tariffId: "free", maxParkingMinutes: 30 }),
      p({ id: "short-paid", tariffId: "paid20", maxParkingMinutes: 30 }),
    ];
    const state = { ...defaultState, durationMinutes: 120, filters: { ...defaultState.filters, free: true } };
    const result = applyFilters(list, tariffs, state, now);
    expect(result.visible.length).toBe(0);
    expect(result.dimmed.map((x) => x.id)).toEqual(["short-free"]);
  });
});
