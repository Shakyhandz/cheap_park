import { describe, expect, it } from "vitest";
import { readState, writeState, defaultState } from "../lib/url-state.js";

describe("readState", () => {
  it("returns default when params empty", () => {
    expect(readState(new URLSearchParams())).toEqual(defaultState);
  });

  it("parses duration", () => {
    const s = readState(new URLSearchParams("duration=60"));
    expect(s.durationMinutes).toBe(60);
  });

  it("treats invalid duration as null", () => {
    const s = readState(new URLSearchParams("duration=abc"));
    expect(s.durationMinutes).toBeNull();
  });

  it("parses filter booleans", () => {
    const s = readState(new URLSearchParams("free=1&accessible=1&long=1"));
    expect(s.filters.free).toBe(true);
    expect(s.filters.accessible).toBe(true);
    expect(s.filters.longTerm).toBe(true);
  });

  it("parses max price", () => {
    const s = readState(new URLSearchParams("max=30"));
    expect(s.filters.maxPricePerHour).toBe(30);
  });
});

describe("writeState", () => {
  it("returns empty string for default state", () => {
    expect(writeState(defaultState).toString()).toBe("");
  });

  it("encodes duration", () => {
    const params = writeState({ ...defaultState, durationMinutes: 120 });
    expect(params.get("duration")).toBe("120");
  });

  it("encodes filters as 1 when true", () => {
    const params = writeState({
      ...defaultState,
      filters: { free: true, accessible: false, longTerm: true, maxPricePerHour: null },
    });
    expect(params.get("free")).toBe("1");
    expect(params.get("accessible")).toBeNull();
    expect(params.get("long")).toBe("1");
  });

  it("encodes max price", () => {
    const params = writeState({
      ...defaultState,
      filters: { ...defaultState.filters, maxPricePerHour: 25 },
    });
    expect(params.get("max")).toBe("25");
  });

  it("round-trips arbitrary state", () => {
    const original = {
      durationMinutes: 90,
      filters: { free: true, accessible: false, longTerm: true, maxPricePerHour: 40 },
    };
    const params = writeState(original);
    expect(readState(params)).toEqual(original);
  });
});
